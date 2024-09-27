/**
 * @license
 * Copyright 2024 Qlever LLC
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config } from '../config.js';

import md5 from 'md5';

import { type Job, type Json, postJob } from '@oada/jobs';
import type { JsonObject, OADAClient } from '@oada/client';
import type { WorkerContext } from '@oada/jobs/dist/Service.js';
import { doJob } from '@oada/client/jobs';

import { type ArchiveConfig, type EnsureResult, isCloser } from '../types.js';
import {
  doCredentialedApiRequest,
  getTicketArchive,
  getTicketFieldValue,
  setCustomField,
  setTicketStatus,
  setTrellisState,
} from '../zd/zendesk.js';
import { DOCS_LIST } from '../tree.js';
import { generateTicketPdf } from '../zd/pdf.js';
import { makeLoggers } from '../logger.js';

const log = makeLoggers('service:archiveTicket');
const JOB_TYPE = config.get('service.archiveTicket.name');
const PATH_FIELD_ID = config.get('service.archiveTicket.pathFieldId');
const LF_ID_FIELD_ID = config.get('service.archiveTicket.lfIdFieldId');

interface LFSyncDocJob extends JobSchema {
  service: 'lf-sync';
  type: 'sync-doc';
  config: {
    doc: { _id: string };
    tradingPartner: string;
  };
}

type LFSyncDocJobResult = Record<
  string,
  {
    LaserficheEntryID: number;
    Path: string;
    Name: string;
  }
>;

// Sync a ticket to trellis, triggering lf-sync over to LF.
export async function archiveTicketService(
  job: Job,
  context: WorkerContext,
): Promise<Json> {
  const jobConfig = job.config as unknown as ArchiveConfig;

  const { ticketId } = jobConfig;
  log.info({ ticketId }, `Starting ${JOB_TYPE} job`);

  log.debug({ ticketId }, 'Generating ticket archive');
  const ticketArchive = await getTicketArchive(ticketId);

  if (getState(ticketArchive.ticket) === STATE_ARCHIVED) {
    log.warn({ ticketId }, 'Re-processing an archived ticket.');
  }

  log.debug({ ticketId }, 'Generating ticket pdf');
  const ticketPdf = await generateTicketPdf(ticketArchive);

  log.debug({ ticketId }, 'Resolve trading partner with trellis-data-manager');
  const tp = await lookupTradingPartner(context.oada, ticketArchive);

  log.debug({ ticketId }, 'Syncing ticket to Trellis');
  const trellisName = `zendesk-ticket-${ticketId}`;
  const { headers } = await context.oada.post({
    path: `/resources`,
    data: ticketArchive as unknown as JsonObject,
    contentType: 'application/vnd.zendesk.ticket.1+json',
  });
  const trellisId = headers['content-location']!.replace(/^\//, '');

  // Mark resource is shared to customer. Make's LF show as "shared from"
  log.debug({ ticketId, trellisId }, 'Mark archive as outgoing share.');
  await context.oada.put({
    path: `/${trellisId}/_meta`,
    data: {
      shared: 'outgoing',
    },
  });

  log.debug({ ticketId, trellisId }, 'Uploading ticket pdf');
  await context.oada.put({
    path: `/${trellisId}/_meta/vdoc/pdf/${trellisName}`,
    data: ticketPdf,
    headers: { 'x-oada-ensure-link': 'unversioned' },
    contentType: 'application/pdf',
  });

  log.trace({ ticketId, trellisId }, 'Set ticket pdf filename');
  await context.oada.put({
    path: `/${trellisId}/_meta/vdoc/pdf/${trellisName}/_meta`,
    data: { filename: `Ticket${ticketId}.pdf` },
  });

  // Main ticket attachments
  for await (const [index, comment] of ticketArchive.comments.entries()) {
    for await (const attach of comment.attachments) {
      const attachmentId = attach.id;
      const filename = `[Ticket${ticketId}][Comment${index}]${attach.file_name}`;

    const buff = await doCredentialedApiRequest(
      ticketArchive.ticket,
      attach.content_url,
    );
    const hash = md5(buff.toString());
    // Blindly delete the fixed asset path to avoid a 422 bug in OADA if this attachment has been processed before
    await context.oada.delete({ path: `/${trellisId}/_meta/vdoc/pdf/${hash}` });

    await context.oada.put({
      path: `/${trellisId}/_meta/vdoc/pdf/${hash}`,
      data: buff,
      headers: { 'x-oada-ensure-link': 'unversioned' },
      contentType: attach.content_type,
    });
    await context.oada.put({
      path: `/${trellisId}/_meta/vdoc/pdf/${hash}/_meta`,
      data: { filename: attach.file_name },
    });
  }

  // Side ticket attachments
  for await (const sideConversationArchive of ticketArchive.sideConversations) {
    log.debug(
      {
        ticketId,
        trellisId,
        sideConversations: sideConversationArchive.sideConversation.id,
      },
      `Processing side conversation`,
    );
    for await (const attach of Object.values(
      sideConversationArchive.attachments,
    )) {
      log.trace(
        {
          ticketId,
          trellisId,
          sideConversations: sideConversationArchive.sideConversation.id,
          attachmentId: attach.id,
        },
        'Putting attachment',
      );
      const buff = await doCredentialedApiRequest(
        ticketArchive.ticket,
        attach.content_url,
      );

      log.debug(
        { ticketId, trellisId, attachmentId, filename },
        'Uploading attachment',
      );
      await context.oada.put({
        path: `/${trellisId}/_meta/vdoc/pdf/attach_${attachmentId}`,
        data: buff,
        headers: { 'x-oada-ensure-link': 'unversioned' },
        contentType: attach.content_type,
      });

      log.trace(
        { ticketId, trellisId, attachmentId, filename },
        `Set attachment name`,
      );
      await context.oada.put({
        path: `/${trellisId}/_meta/vdoc/pdf/attach_${attachmentId}/_meta`,
        data: { filename },
      });
    }
  }

  // Side ticket attachments
  for await (const [
    scIndex,
    sideConversation,
  ] of ticketArchive.sideConversations.entries()) {
    const sideConversationId = sideConversation.sideConversation.id;
    for await (const [eventIndex, event] of sideConversation.events.entries()) {
      if (event.message) {
        for await (const attach of event.message.attachments) {
          const attachmentId = attach.id;
          const filename = `[Ticket${ticketId}][SideConversation${scIndex}][Comment${eventIndex}]${attach.file_name}`;

          log.debug(
            { ticketId, trellisId, sideConversationId, attachmentId, filename },
            `Fetching attachment from ZenDesk`,
          );
          const buff = await doCredentialedApiRequest(
            ticketArchive.ticket,
            attach.content_url,
          );

          log.debug(
            { ticketId, trellisId, sideConversationId, attachmentId, filename },
            'Uploading attachment',
          );
          await context.oada.put({
            path: `/${trellisId}/_meta/vdoc/pdf/sideConv_${sideConversationId}_attach_${attachmentId}`,
            data: buff,
            headers: { 'x-oada-ensure-link': 'unversioned' },
            contentType: attach.content_type,
          });

          log.trace(
            { ticketId, trellisId, sideConversationId, attachmentId, filename },
            `Set attachment name`,
          );
          await context.oada.put({
            path: `/${trellisId}/_meta/vdoc/pdf/sideConv_${sideConversationId}_attach_${attachmentId}/_meta`,
            data: { filename },
          });
        }
      }
    }
  }

  log.debug(
    { ticketId, trellisId },
    "Linking ticket into trading partner's documents",
  );

  // FIXME: @oada/client tree put is not working, quick fix
  await ensurePath(
    context.oada,
    `/${tp.masterid}/bookmarks/trellisfw`,
    'application/vnd.oada.trellisfw.1+json',
  );
  await ensurePath(
    context.oada,
    `/${tp.masterid}/bookmarks/trellisfw/documents`,
    'application/vnd.oada.trellisfw.documentType.1+json',
  );
  await ensurePath(
    context.oada,
    `/${tp.masterid}/bookmarks/trellisfw/documents/tickets`,
    'application/vnd.oada.trellisfw.documents.1+json',
  );
  // FIXME: END: @oada/client tree put is not working, quick fix

  await context.oada.put({
    path: `/${tp.masterid}${DOCS_LIST}/tickets`,
    data: {
      [trellisName]: {
        _id: trellisId,
        _rev: 0,
      },
    },
    // FIXME: Reable tree after tree put fixed
    // tree: tpDocTypesTree,
  });

  log.debug({ ticketId }, 'Updating Zendesk ticket Trellis state/status');
  // Update state on Zendesk ticket
  await setTrellisState(ticketArchive.ticket, {
    state: STATE_ARCHIVED,
    status: context.jobId,
  });

  log.info({ ticketId }, 'Await Laserfiche sync job');

  log.debug({ ticketId }, 'Creating get-lf-entry job to learn LF state');
  const syncJob: LFSyncDocJob = {
    service: 'lf-sync',
    type: 'sync-doc',
    config: {
      doc: { _id: trellisId },
      tradingPartner: tp.masterid,
    },
  };

  const sync = await doJob(context.oada, syncJob);
  const entities = sync.result as unknown as LFSyncDocJobResult;

  // Find ticket PDF vDoc
  const ticketEntryKey = Object.keys(entities).find((k) =>
    entities[k]?.Name.match(/^Ticket\d+.pdf$/),
  );

  if (!ticketEntryKey) {
    log.error({ ticketId }, 'Can not find ticket pdf in LF after upload');
    throw new Error('No ticket PDF vDoc in Ticket Trellis resource?');
  }

  const lfId = entities[ticketEntryKey]?.LaserficheEntryID;
  if (!lfId) {
    log.error({ ticketId }, 'No Laserfiche ID for ticket PDF?');
    throw new Error('Could not determine Laserfiche ID for ticket PDF?');
  }

  const path = entities[ticketEntryKey]?.Path.split('\\')
    .slice(0, -1)
    .join('\\');
  if (!path) {
    log.error({ ticketId }, 'No Laserfiche path for ticket PDF?');
    throw new Error('Could not determine Laserfiche path for ticket folder?');
  }

  log.info({ ticketId }, 'Ticket is in LF. Update Zendesk state and status');
  await setTrellisState(ticketArchive.ticket, {
    state: STATE_ARCHIVED,
    status: undefined,
  });

  if (ticketArchive.ticket.status !== 'closed') {
    if (PATH_FIELD_ID > 0) {
      log.debug({ ticketId }, 'Add LF path meta data back to Zendesk');
      await setCustomField(ticketArchive.ticket, [
        { id: PATH_FIELD_ID, value: path },
      ]);
    }

    if (LF_ID_FIELD_ID > 0) {
      log.debug({ ticketId }, 'Add LF ID meta data back to Zendesk');
      await setCustomField(ticketArchive.ticket, [
        { id: LF_ID_FIELD_ID, value: `${lfId}` },
      ]);
    }

    log.info({ ticketId }, `Ticket is synced. Closing ticket in ZenDesk.`);

    if (config.get('mode') === 'production') {
      await setTicketStatus(ticketArchive.ticket, 'closed');
    } else {
      log.debug({ ticketId }, `Testing mode, don't actually closing ticket.`);
    }
  }

  log.info({ ticketId }, 'Ticket successfully archived to Trellis.');

  return {
    state: STATE_ARCHIVED,
    trellisId,
    masterId: tp.masterid,
    location: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisName}`,
  };
}

async function ensurePath(oada: OADAClient, path: string, contentType: string) {
  try {
    await oada.head({ path });
  } catch (error) {
    log.warn({ error, path }, 'ensurePath work?');
    if ((error as { status: number })?.status === 404) {
      await oada.put({
        path,
        data: {},
        headers: { 'x-oada-ensure-link': 'unversioned' },
        contentType,
      });
    }
  }
}
