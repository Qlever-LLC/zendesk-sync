/**
 * @license
 * Copyright 2022 Qlever LLC
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
 o * limitations under the License.
 */

// Import this _before_ pino and/or DEBUG
import '@oada/pino-debug';

import Debug from 'debug';

// Import this first to setup the environment
import { config } from './config.js';

import { connect, type OADAClient, type JsonObject } from '@oada/client';
import { doJob } from '@oada/client/jobs';
import axios from 'axios';
import { CronJob } from 'cron';
import cloneDeep from 'clone-deep';
import esMain from 'es-main';
import md5 from 'md5';
import PQueue from 'p-queue';
import { tpDocTypesTree } from './tree.js';
import {
  EnsureResult,
  doCredentialedApiRequest,
  getCustomerOrgId,
  getOrgs,
  getTicket,
  getTicketArchive,
  searchTickets,
} from './zd/zendesk.js';
import { generateTicketPdf } from './zd/pdf.js';
import { Ticket, SAP_FIELD, notUndefined } from './types.js';
// Stuff from config
const { token, domain } = config.get('oada');
const {
  username,
  password,
  domain: ZD_DOMAIN,
  org_field_id: ORG_FIELD_ID,
  delay: ZD_DELAY,
} = config.get('zendesk');
const concurrency = config.get('concurrency');
//const TIMEOUT = config.get('timeout');
const JOB_TIMEOUT = config.get('timeout');
const POLL_RATE = config.get('poll-rate');

const info = Debug('zendesk-sync:info');
const warn = Debug('zendesk-sync:warn');
const debug = Debug('zendesk-sync:info');
const error = Debug('zendesk-sync:error');
const fatal = Debug('zendesk-sync:fatal');

// TODO: Temporary: remove after running closed jobs
const workQueue = new Map<number, number>();
const work = new PQueue({ concurrency, timeout: JOB_TIMEOUT });
let cleanup: (id: number) => void | undefined;
tpDocTypesTree['resources'] = cloneDeep(
  tpDocTypesTree?.bookmarks?.trellisfw?.['trading-partners'] ?? {},
);

export async function run() {
  const oada = await connect({ token, domain });
  // FIXME: Uncomment
  // cleanup = watchZendesk(async (ticket: Ticket) => {
  //   work.add(async () => handleTicket(ticket, oada as OADAClient));
  // });
  info('Starting up...');
  try {
    handleTicket(await getTicket(2395), oada as OADAClient);
  } catch (e) {
    error(e);
  }
}

/**
 * Get the current set of solved tickets for which the associated
 * organization has an SAP ID assigned. Called on a regular interval.
 **/
export async function pollZd(): Promise<Array<Ticket>> {
  let candidates = await searchTickets('solved');
  debug(`Found ${candidates.length} candidate tickets`);

  // Get all unique Orgs covering all candidate tickets
  let orgs = await getOrgs(
    Array.from(
      new Set(candidates.map((t) => getCustomerOrgId(t)).filter(notUndefined)),
    ),
  );

  // Process tickets assigned to customer org with SAP ID or old tickets
  return candidates.filter((t) => {
    let custId = getCustomerOrgId(t);
    if (!custId) {
      debug({ ticket_id: t.id }, 'Missing customer organization.');
      return false;
    }

    let org = orgs[custId];
    if (!org) {
      fatal({ ticket: t.id }, `Can't find org ${custId} afer fetching it?`);
      return false;
    }

    // If assigned organization has an SAPID, then archive it.
    if (SAP_FIELD in org.organization_fields) {
      return true;
    }

    // If a solved ticket without an assigned customer, or the assigned customer does not have an SAPID,
    // AND it is over 27 days post solving, then archive it with the default customer.
    // This is to avoid Zendesk auto closing the ticket which drops it out of the polling results.
    if (
      (Date.now() - (new Date(t.updated_at) as unknown as number)) /
      24 /
      3_600_000 >
      27.0 // FIXME: Should this be a config option?
    ) {
      warn(
        { ticket_id: t.id },
        `Archiving without proper customer because of age!`,
      );
      return true;
    }

    // Ticket not ready. Solved, but assigned org needs an SAPID
    return false;
  });
}

/**
 * Sync a ticket to trellis, triggering lf-sync over to LF.
 * @param ticket
 * @param oada
 */
export async function handleTicket(
  ticket: Ticket,
  oada: OADAClient,
): Promise<void | string> {
  try {
    info({ ticket_id: ticket.id }, `Start processing`);

    workQueue.set(ticket.id, Date.now());
    const archive = await getTicketArchive(ticket);
    const ticketPdf = await generateTicketPdf(archive);

    const sapids = archive.org?.organization_fields?.[SAP_FIELD]
      ? archive.org?.organization_fields?.[SAP_FIELD].split(',').map(
        (id) => `sap:${id}`,
      )
      : [];
    const zid = `zendesk:${archive.org.id}`;

    const { result } = (await doJob(oada, {
      service: 'trellis-data-manager',
      type: 'trading-partners-ensure',
      config: {
        element: {
          name: archive.org.name,
          externalIds: [zid],
        },
      },
    })) as unknown as { result: EnsureResult };
    let tp = result.entry;
    if (!tp) {
      tp = result.matches![0].item;
      if (!tp) {
        error(
          `Failed to find single trading - partner for ticket ${ticket.id} organization ${archive.org.name} `,
        );
      }
    }

    debug({ tp }, 'Trading partner lookup finished.');

    // Upsert a Trellis TP to hold this ticket
    if (
      sapids.some((sapid) => !tp.externalIds.includes(sapid)) ||
      tp.name !== archive.org.name
    ) {
      await doJob(oada, {
        service: 'trellis-data-manager',
        type: 'trading-partners-update',
        config: {
          element: {
            masterid: tp.masterid,
            name: archive.org.name,
            externalIds: [zid, ...sapids],
          },
        },
      });

      debug({}, 'Trading partner upsert finished.');
    }

    debug({}, 'Creating ticket resource');

    // sync the pdf to Trellis
    const pdfid = md5(JSON.stringify(archive));
    const trellisname = `${ticket.id}-${pdfid}`;
    const { headers } = await oada.post({
      path: `/resources`,
      data: archive as unknown as JsonObject,
      contentType: 'application/vnd.zendesk.ticket.1+json',
    });
    const _id = headers['content-location']!.replace(/^\//, '');

    debug({ _id }, 'Created ticket resource');

    // Mark resource is shared to customer. Make's LF show as "shared from"
    await oada.put({
      path: `/${_id}/_meta`,
      data: {
        shared: 'outgoing',
      },
    });

    debug({}, 'Putting ticket pdf');
    await oada.put({
      path: `/${_id}/_meta/vdoc/pdf/${pdfid}`,
      data: ticketPdf,
      headers: { 'x-oada-ensure-link': 'unversioned' },
      contentType: 'application/pdf',
    });
    debug({}, 'Putting ticket pdf filename');
    await oada.put({
      path: `/${_id}/_meta/vdoc/pdf/${pdfid}/_meta`,
      data: { filename: `Ticket-${ticket.id}.pdf` },
    });

    // Main ticket attachments
    for await (const attach of Object.values(archive.attachments)) {
      debug({}, 'Putting attachment');
      const buff = await doCredentialedApiRequest(attach.content_url);
      const hash = md5(buff.toString());
      await oada.put({
        path: `/${_id}/_meta/vdoc/pdf/${hash}`,
        data: buff,
        headers: { 'x-oada-ensure-link': 'unversioned' },
        contentType: attach.content_type,
      });
      await oada.put({
        path: `/${_id}/_meta/vdoc/pdf/${hash}/_meta`,
        data: { filename: attach.file_name },
      });
    }

    // Side ticket attachments
    for (const sideConvoArchive of archive.sideConversations) {
      debug({}, `Processing side conversation`);
      for await (const attach of Object.values(sideConvoArchive.attachments)) {
        debug({}, 'Putting attachment');
        const buff = await doCredentialedApiRequest(attach.content_url);
        const hash = md5(buff.toString());
        await oada.put({
          path: `/${_id}/_meta/vdoc/pdf/${hash}`,
          data: buff,
          headers: { 'x-oada-ensure-link': 'unversioned' },
          contentType: attach.content_type,
        });
        await oada.put({
          path: `/${_id}/_meta/vdoc/pdf/${hash}/_meta`,
          data: { filename: attach.file_name },
        });
      }
    }

    await oada.put({
      path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets`,
      data: {
        [trellisname]: {
          _id,
          _rev: 0,
        },
      },
      tree: tpDocTypesTree,
    });

    /*
    await axios({
      method: 'put',
      url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.id}.json`,
      auth: {
        username,
        password,
      },
      data: {
        ticket: {
          status: 'closed',
        },
      },
    });
    */

    debug(`Marked sync operation for ticket [${ticket.id}] as finished.`);
    if (cleanup) {
      debug(`Marked sync operation for ticket [${ticket.id}] as finished.`);
      cleanup(ticket.id);
    }
  } catch (err) {
    error(err);
  }
}
/**
 * The main polling loop for running a task on zendesk tickets
 * @param task
 * @returns
 */
export function watchZendesk(
  task: (ticket: Ticket) => void,
): (id: number) => void {
  const job = new CronJob(`*/${POLL_RATE} * * * * *`, async () => {
    const start = new Date();

    // The work pqueue will separately time out things, but this prunes them from
    // workQueue limited to the nearest POLL_RATE interval check.
    for await (const [id, startTime] of workQueue.entries()) {
      if (startTime && start.getTime() > startTime + JOB_TIMEOUT) {
        warn(`Ticket ${id} sync timed out before completion.`);
        workQueue.delete(id);
      }
    }

    info(`${start.toISOString()} Polling Zendesk.`);

    // Queue additional items
    let tickets = await pollZd();
    tickets = tickets.filter((t) => !workQueue.has(t.id));
    info(`Current workQueue size: ${workQueue.size}`);
    if (tickets.length)
      info(
        `Adding tickets to work queue: ${tickets.map((t) => t.id).join(', ')}`,
      );
    for await (const ticket of tickets) {
      debug(`Adding ticket ${ticket.id} to work queue.`);
      workQueue.set(ticket.id, 0);
      // Do task
      task(ticket);
    }
  });

  job.start();

  return (id: number) => {
    // Zendesk does not promptly update tickets after closing them out. Use this to
    // avoid requeuing a recently-closed ticket.
    setTimeout(() => workQueue.delete(id), ZD_DELAY);
  };
}

if (esMain(import.meta)) {
  debug('esMain determined to run the service');
  await run();
}