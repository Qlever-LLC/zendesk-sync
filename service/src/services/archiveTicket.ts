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
  setTicketStatus,
  setTrellisState,
} from '../zd/zendesk.js';
import { DOCS_LIST } from '../tree.js';
import { generateTicketPdf } from '../zd/pdf.js';
import { makeLfCloserJob } from './lfCloser.js';
import { makeLoggers } from '../logger.js';

const log = makeLoggers('service:archiveTicket');

export async function makeArchiveTicketJob(
  oada: OADAClient,
  jobConfig: ArchiveConfig,
) {
  await postJob(oada, `/bookmarks/services/zendesk-sync/jobs/pending`, {
    service: 'zendesk-sync',
    type: config.get('service.archiveTicket.name'),
    config: jobConfig as unknown as Json,
  });
}

// Sync a ticket to trellis, triggering lf-sync over to LF.
export async function archiveTicketService(
  job: Job,
  context: WorkerContext,
): Promise<Json> {
  const jobConfig = job.config as unknown as ArchiveConfig;

  const { ticketId } = jobConfig;
  log.info(
    { ticketId },
    `Starting ${config.get('service.archiveTicket.name')} job`,
  );

  log.debug({}, 'Generating ticket archive');
  const ticketArchive = await getTicketArchive(ticketId);

  const currentState = getTicketFieldValue(
    ticketArchive.ticket,
    config.get('zendesk.fields.state'),
  );

  // Logical check on service's joint state machine
  if (
    currentState !== undefined &&
    currentState !== '' &&
    currentState !== 'trellis-pending' &&
    currentState !== 'trellis-processing'
  ) {
    log.warn({ ticketId }, 'Trying to archive already archived ticket?');
    throw new Error('Ticket already archived!');
  }

  log.debug({}, 'Creating ticket pdf');
  const ticketPdf = await generateTicketPdf(ticketArchive);
  log.trace({}, 'Done ticket pdf');

  const sapFieldId = config.get('zendesk.fields.SAPId');
  const sapField = ticketArchive.org?.organization_fields?.[sapFieldId];
  const sapids = sapField ? sapField.split(',').map((id) => `sap:${id}`) : [];
  const zid = `zendesk:${ticketArchive.org.id}`;

  log.debug({ ticketId }, 'Resolve trading partner with trellis-data-manager');
  const { result } = (await doJob(context.oada, {
    service: 'trellis-data-manager',
    type: 'trading-partners-ensure',
    config: {
      element: {
        name: ticketArchive.org.name,
        externalIds: [zid],
      },
    },
  })) as unknown as { result: EnsureResult };

  const tp = result.entry ?? result.matches?.[0]?.item;
  if (!tp) {
    throw new Error(
      `Ticket ${ticketId} has no trading partner (ZD Org: ${ticketArchive.org.name})`,
    );
  }

  log.trace(
    { ticketId, masterid: tp.masterid },
    'Trading partner lookup finished.',
  );

  // Upsert a Trellis TP to hold this ticket
  if (
    sapids.some((sapid) => !tp.externalIds.includes(sapid)) ||
    tp.name !== ticketArchive.org.name
  ) {
    log.trace(
      { tp, ticketId },
      'Upserting trading partner with ZD sourced data.',
    );

    await doJob(context.oada, {
      service: 'trellis-data-manager',
      type: 'trading-partners-update',
      config: {
        element: {
          masterid: tp.masterid,
          name: ticketArchive.org.name,
          externalIds: [zid, ...sapids],
        },
      },
    });

    log.trace({ tp, ticketId }, 'Trading partner upsert done.');
  }

  log.debug({ ticketId }, 'Creating ticket resource');

  // Sync the pdf to Trellis
  const trellisname = `zendesk-ticket-${ticketId}`;
  const { headers } = await context.oada.post({
    path: `/resources`,
    data: ticketArchive as unknown as JsonObject,
    contentType: 'application/vnd.zendesk.ticket.1+json',
  });
  const trellisId = headers['content-location']!.replace(/^\//, '');

  log.trace({ ticketId, trellisId }, 'Created ticket resource');

  // Mark resource is shared to customer. Make's LF show as "shared from"
  await context.oada.put({
    path: `/${trellisId}/_meta`,
    data: {
      shared: 'outgoing',
    },
  });

  log.debug({ ticketId, trellisId }, 'Putting ticket pdf');
  await context.oada.put({
    path: `/${trellisId}/_meta/vdoc/pdf/zendesk-ticket-${ticketId}`,
    data: ticketPdf,
    headers: { 'x-oada-ensure-link': 'unversioned' },
    contentType: 'application/pdf',
  });

  log.trace({ ticketId, trellisId }, 'Putting ticket pdf filename');
  await context.oada.put({
    path: `/${trellisId}/_meta/vdoc/pdf/zendesk-ticket-${ticketId}/_meta`,
    data: { filename: `Ticket-${ticketId}.pdf` },
  });

  // Main ticket attachments
  log.debug({ ticketId, trellisId }, 'Uploading attachments to Trellis');
  for await (const attach of Object.values(ticketArchive.attachments)) {
    log.trace(
      { ticketId, trellisId, attachmentId: attach.id },
      'Putting attachment',
    );

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
      const hash = md5(buff.toString());
      // Blindly delete the fixed asset path to avoid a 422 bug in OADA if this attachment has been processed before
      await context.oada.delete({
        path: `/${trellisId}/_meta/vdoc/pdf/${hash}`,
      });
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
      [trellisname]: {
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
    state: 'trellis-archived',
    status: context.jobId,
  });

  // Setup closer
  switch (isCloser(jobConfig.closer)) {
    // Close right away, don't wait for something else in Trellis to happen
    case 'immediate': {
      log.info({ ticketId }, `Immediate closer requested. Closing ticket now.`);

      if (config.get('mode') === 'production') {
        await setTicketStatus(ticketArchive.ticket, 'closed');
      } else {
        log.debug({ ticketId }, `Testing mode, don't actually closing ticket.`);
      }

      break;
    }

    // Wait for laserfiche to properly file the archive away before closing ZenDesk ticket
    case 'laserfiche': {
      log.info(
        { ticketId },
        `Laserfiche closer requested. Creating lsCloser job.`,
      );

      await makeLfCloserJob(context.oada, { ticketId, doc: trellisId });

      break;
    }

    // Don't try to close the ZenDesk ticket at all
    case 'none': {
      log.debug({ ticketId }, `No closer requested.`);

      break;
    }
  }

  log.info({ ticketId }, 'Ticket successfully archived to Trellis.');

  return {
    state: 'trellis-archived',
    trellisId,
    masterId: tp.masterid,
    location: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}`,
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
