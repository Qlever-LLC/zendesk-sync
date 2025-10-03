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

import type { JsonObject, OADAClient, PUTRequest } from "@oada/client";
import { doJob } from "@oada/client/jobs";
import { type Job, type Json, postJob } from "@oada/jobs";
import type { WorkerContext } from "@oada/jobs/dist/Service.js";
import type { Logger } from "@oada/pino-debug";

import { doLfSync } from "../archivers/laserfiche.js";
import { config } from "../config.js";
import { DOCS_LIST } from "../tree.js";
import {
  type Attachment,
  assertIsArchiverArray,
  type EnsureResult,
  type SideConversationAttachment,
  State,
  type SyncConfig,
  type Ticket,
  type TicketArchive,
} from "../types.js";
import { generateTicketPdf } from "../zd/pdf.js";
import { callTypedApi } from "../zd/utils.js";
import {
  getTicketArchive,
  getTicketFieldValue,
  setTicketStatus,
  setTrellisState,
} from "../zd/zendesk.js";

const JOB_TYPE = "syncTicket";

export async function makeSyncTicketJob(
  oada: OADAClient,
  jobConfig: SyncConfig,
) {
  await postJob(oada, "/bookmarks/services/zendesk-sync/jobs/pending", {
    service: "zendesk-sync",
    type: JOB_TYPE,
    config: jobConfig as unknown as Json,
  });
}

export async function doSyncTicketJob(oada: OADAClient, jobConfig: SyncConfig) {
  await doJob(oada, {
    service: "zendesk-sync",
    type: JOB_TYPE,
    config: jobConfig as unknown as Record<string, unknown>,
  });
}

// Sync a ticket to trellis, triggering lf-sync over to LF.
export async function syncTicketService(
  job: Job,
  { oada, jobId, log }: WorkerContext,
): Promise<Json> {
  const { ticketId, archivers } = job.config as unknown as SyncConfig;
  assertIsArchiverArray(archivers);
  log = log.child({ ticketId });

  log.info(`Starting ${JOB_TYPE} job`);

  log.debug("Generating ticket archive");
  const ticketArchive = await getTicketArchive(log, ticketId);

  if (getState(ticketArchive.ticket) === State.Archived) {
    log.warn("Re-processing an archived ticket.");
  }

  log.debug("Generating ticket pdf");
  const ticketPdf = await generateTicketPdf(ticketArchive, log);

  log.debug("Resolve trading partner with trellis-data-manager");
  const tp = await lookupTradingPartner(oada, ticketArchive);
  log.debug({ masterid: tp.masterid }, "Found trading partner");

  log.info("Creating ticket in Trellis");
  const trellisPath = `${tp.masterid}${DOCS_LIST}/tickets/zendesk-ticket-${ticketId}`;
  await ensureTicketsRoot(oada, tp.masterid);

  log.debug("Uploading ticket JSON");
  await ensureLinkPut(oada, {
    path: trellisPath,
    data: ticketArchive as unknown as JsonObject,
    headers: { "x-oada-ensure-link": "versioned" },
    contentType: "application/vnd.zendesk.ticket.1+json",
  });

  // Mark resource is shared to customer. Make's LF show as "shared from"
  log.debug("Mark archive as outgoing share.");
  await oada.put({
    path: `${trellisPath}/_meta`,
    data: {
      shared: "outgoing",
    },
  });

  log.debug("Uploading ticket pdf");
  await ensureLinkPut(oada, {
    path: `/${trellisPath}/_meta/vdoc/pdf/email_archive`,
    data: ticketPdf,
    headers: { "x-oada-ensure-link": "unversioned" },
    contentType: "application/pdf",
  });

  log.trace("Set ticket pdf filename");
  await oada.put({
    path: `/${trellisPath}/_meta/vdoc/pdf/email_archive/_meta`,
    data: { filename: "Conversation.pdf" },
  });

  // Main ticket attachments
  for await (const [
    commentNumber,
    comment,
  ] of ticketArchive.comments.entries()) {
    for await (const attach of comment.attachments) {
      await uploadAttachment(
        log,
        oada,
        attach,
        trellisPath,
        `attach_${attach.id}`,
        { commentNumber: commentNumber + 1 }, // Don't zero index for normal people
      );
    }
  }

  // Side ticket attachments
  for await (const [
    sideConversationNumber,
    sideConversation,
  ] of ticketArchive.sideConversations.entries()) {
    const sideConversationId = sideConversation.sideConversation.id;
    for await (const [
      commentNumber,
      event,
    ] of sideConversation.events.entries()) {
      if (event.message) {
        for await (const attach of event.message.attachments) {
          await uploadAttachment(
            log,
            oada,
            attach,
            trellisPath,
            `sideConv_${sideConversationId}_attach_${attach.id}`,
            { sideConversationNumber, commentNumber },
          );
        }
      }
    }
  }

  log.debug("Updating Zendesk ticket Trellis state/status");
  // Update state on Zendesk ticket
  await setTrellisState(log, ticketArchive.ticket, {
    state: State.Archived,
    status: jobId,
  });

  log.trace("Running requested archivers");
  if (archivers.length > 0) {
    log.debug(`'${archivers.join("','")}' archiver(s) requested.`);

    if (archivers.includes("laserfiche")) {
      log.debug("Creating lf-sync job to archive ticket to LaserFiche.");

      const r = await oada.head({ path: trellisPath });
      const trellisId = r.headers["content-location"]?.replace(/^\//, "") ?? "";

      await doLfSync(log, oada, ticketArchive.ticket, {
        trellisId,
        tradingPartner: tp.masterid,
      });
    }
  }

  log.debug("All archivers are complete. Closing ticket.");
  await closeTicket(log, ticketArchive.ticket);

  log.info("Ticket done");

  return {
    state: State.Finished,
    masterId: tp.masterid,
    location: trellisPath,
  };
}

// eslint-disable-next-line max-params
async function uploadAttachment(
  logger: Logger,
  oada: OADAClient,
  attach: Attachment | SideConversationAttachment,
  trellisPath: string,
  attachmentName: string,
  metadata: { sideConversationNumber?: number; commentNumber: number },
) {
  const log = logger.child({
    attachmentId: attach.id,
    attachmentName,
    filename: attach.file_name,
  });

  log.debug("Fetching attachment from ZenDesk");
  const buff = await callTypedApi<Uint8Array>(
    log,
    attach.content_url,
    "buffer",
    {
      responseType: "arraybuffer",
    },
  );

  log.debug("Uploading attachment");
  await ensureLinkPut(oada, {
    path: `/${trellisPath}/_meta/vdoc/pdf/${attachmentName}`,
    data: buff,
    headers: { "x-oada-ensure-link": "unversioned" },
    contentType: attach.content_type,
  });

  log.trace("Set attachment name");
  await oada.put({
    path: `/${trellisPath}/_meta/vdoc/pdf/${attachmentName}/_meta`,
    data: { filename: attach.file_name, ...metadata },
  });
}

async function lookupTradingPartner(oada: OADAClient, ticket: TicketArchive) {
  const { result } = (await doJob(oada, {
    service: "trellis-data-manager",
    type: "trading-partners-ensure",
    config: {
      element: {
        name: ticket.org.name,
        externalIds: [`zendesk:${ticket.org.id}`],
      },
    },
  })) as unknown as { result: EnsureResult };

  // Note: This should never be a problem
  const tp = result.entry ?? result.matches?.[0]?.item;
  if (!tp) {
    throw new Error("Ticket has no trading partner? trellis-data-manager bug?");
  }

  return tp;
}

function getState(ticket: Ticket) {
  return getTicketFieldValue(ticket, config.get("zendesk.fields.state"));
}

async function closeTicket(log: Logger, ticket: Ticket) {
  log.info("Closing ticket in ZenDesk.");

  if (config.get("mode") === "production") {
    await setTicketStatus(log, ticket, "closed");
  } else {
    log.debug("Testing mode. Not actually closing ticket.");
  }
}

// FIXME: @oada/client tree put is not working, quick fix
async function ensureTicketsRoot(oada: OADAClient, masterId: string) {
  await ensurePath(
    oada,
    `/${masterId}/bookmarks/trellisfw`,
    "application/vnd.oada.trellisfw.1+json",
  );
  await ensurePath(
    oada,
    `/${masterId}/bookmarks/trellisfw/documents`,
    "application/vnd.oada.trellisfw.documentType.1+json",
  );
  await ensurePath(
    oada,
    `/${masterId}/bookmarks/trellisfw/documents/tickets`,
    "application/vnd.oada.trellisfw.documents.1+json",
  );
}

// FIXME: @oada/client tree put is not working, quick fix
async function ensurePath(oada: OADAClient, path: string, contentType: string) {
  try {
    await oada.head({ path });
  } catch (error: unknown) {
    if ((error as { status: number })?.status === 404) {
      await oada.put({
        path,
        data: {},
        headers: { "x-oada-ensure-link": "unversioned" },
        contentType,
      });
    }
  }
}

// FIXME: Remove when OADA supports x-oada-ensure-link for PUTs
async function ensureLinkPut(oada: OADAClient, request: PUTRequest) {
  let linkType = "unversioned";
  if (request.headers?.["x-oada-ensure-link"]) {
    linkType = request?.headers["x-oada-ensure-link"];
    delete request.headers["x-oada-ensure-link"];
  }

  try {
    await oada.head({ path: request.path });
  } catch (error: unknown) {
    if ((error as { status: number })?.status === 404) {
      request.headers = { ...request.headers, "x-oada-ensure-link": linkType };
    }
  }

  return oada.put(request);
}
