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
 * limitations under the License.
 */

// Import this first to setup the environment
import { config } from './config.js';

// Import this _before_ pino and/or DEBUG
import '@oada/pino-debug';

import { connect, doJob, type OADAClient, type JsonObject } from '@oada/client';
import axios from 'axios';
import { CronJob } from 'cron';
import cloneDeep from 'clone-deep';
import debug from 'debug';
import esMain from 'es-main';
import md5 from 'md5';
import PQueue from 'p-queue';
import { tpDocTypesTree } from './tree.js';
import {
  EnsureResult,
  getOrgs,
  getTicketArchive,
  SAP_FIELD,
  searchTickets,
  Ticket,
} from './zd/zendesk.js';
import { generatePdf } from './zd/pdf.js';
// Stuff from config
const { token, domain } = config.get('oada');
const {
  username,
  password,
  domain: ZD_DOMAIN,
  org_field_id: ORG_FIELD_ID,
} = config.get('zendesk');
const CONCURRENCY = config.get('concurrency');
const TIMEOUT = config.get('timeout');
const JOB_TIMEOUT= config.get('timeout');
const POLL_RATE = config.get('poll-rate');

const info = debug('zendesk-sync:info');
const warn = debug('zendesk-sync:warn');
const trace = debug('zendesk-sync:trace');
const error = debug('zendesk-sync:error');

// TODO: Temporary: remove after running closed jobs
const ticks = {};

const workQueue = new Map<number, number>();
const work = new PQueue({ concurrency: CONCURRENCY });
let cleanup: (id: number) => void | undefined;
tpDocTypesTree['resources'] = cloneDeep(
  tpDocTypesTree?.bookmarks?.trellisfw?.['trading-partners'] ?? {}
);

export async function run() {
  const oada = await connect({ token, domain });
  cleanup = watchZendesk(async (ticket: Ticket) => {
    work.add(async () => {
      handleTicket(ticket, oada)
    });
  });
}

/**
 * Get the current set of solved tickets for which the associated
 * organization has an SAP ID assigned. Called on a regular interval.
 **/
export async function pollZd(): Promise<Array<Ticket>> {
  const tickets = await searchTickets('closed');

  if (tickets.length > 0)
    trace(`Got tickets: ${tickets.map((t) => t.id).join(',')}`);

  // Now get the set of tickets with an organization
  let tixWithOrgs = tickets.filter(
    (t) => t?.custom_fields?.[ORG_FIELD_ID] ?? t.organization_id
  )

  const picked = tixWithOrgs.map(
    (t) => (t?.custom_fields?.[ORG_FIELD_ID] ?? t.organization_id) as unknown as number
  );

  // Get all mentioned organizations
  const orgs = await getOrgs(
    Array.from(new Set(tixWithOrgs.map((t) => t.organization_id)))
  );

  tixWithOrgs = tixWithOrgs.map(
    (t) => ({
      ...t,
      organization: orgs[(t?.custom_fields?.[ORG_FIELD_ID] ?? t.organization_id) as unknown as string],
    })
  );

  // Return only those with an SAP_FIELD value
  return tixWithOrgs.filter(
    (t, i) =>
      // falseys are already filtered out
      orgs[picked[i]!]?.organization_fields[SAP_FIELD] ||
      // Close after 27 days without SAP ID. Otherwise, Zendesk will close it themselves and
      // it won't show up under this query for solved tickets.
      ((Date.now() - (new Date(t.updated_at) as unknown as number))/24/3_600_000 > 27.0)
  );
}

/**
 * Sync a ticket to trellis, triggering lf-sync over to LF.
 * @param ticket
 * @param oada
 */
export async function handleTicket(
  ticket: Ticket,
  oada: OADAClient
): Promise<void | string> {
  workQueue.set(ticket.id, Date.now());
  const archive = await getTicketArchive(ticket);
  if (archive.org === null) {
    error('A ticket without an organization is being archived?', archive);
    throw new Error('Ticket must have an organization to archive.');
  }
  console.log('PROCESSING TICKET', ticket.id);
  const pdf = await generatePdf(archive);

  const sapids = archive.org?.organization_fields?.[SAP_FIELD] ?
    archive.org?.organization_fields?.[SAP_FIELD].split(',').map(
      (id) => `sap:${id}`
    ) : [];
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
      console.log({tp})
    }
  }
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
  }

  // sync the pdf to Trellis
  //TODO: eliminate edge cases where an attachment may use the dirname or something...
  const trellisname = `${ticket.id}-${md5(JSON.stringify(archive))}`;
  /*
  const { headers } = await oada.post({
    path: `/resources`,
    data: ticket as unknown as JsonObject,
    contentType: 'application/vnd.zendesk.ticket.1+json',
  });
  const _id = headers['content-location']!.replace(/^\//, '');

  await oada.put({
    path: `/${_id}/_meta`,
    data: {
      shared: 'outgoing'
    },
  });

  let pdfid = md5(archive.toString());
  await oada.put({
    path: `/${_id}/_meta/vdoc/pdf/${pdfid}`,
    data: pdf,
    headers: { 'x-oada-ensure-link': 'unversioned' },
    contentType: 'application/pdf',
  });
  await oada.put({
    path: `/${_id}/_meta/vdoc/pdf/${pdfid}/_meta`,
    data: { filename: `Ticket${trellisname}_MessageContent.pdf` },
  });

  for await (const attach of Object.values(archive.attachments)) {
    const buff = (
      (await axios({
        method: 'get',
        url: attach.content_url,
        responseType: 'arraybuffer',
      })) as unknown as { data: string }
    ).data;
    pdfid = md5(buff.toString() + ' ;');
    await oada.put({
      path: `/${_id}/_meta/vdoc/pdf/${pdfid}`,
      data: Buffer.from(buff, 'utf-8'),
      headers: { 'x-oada-ensure-link': 'unversioned' },
      contentType: attach.content_type,
    });
    await oada.put({
      path: `/${_id}/_meta/vdoc/pdf/${pdfid}/_meta`,
      data: { filename: attach.file_name },
    });
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

  // Mark the ticket closed
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
  ) {
  });
  */

  if (cleanup) {
    trace(`Marked sync operation for ticket [${ticket.id}] as finished.`);
    cleanup(ticket.id);
    // TODO: Temporary: remove after running closed jobs
    // @ts-ignore
    ticks[ticket.id] = true;
  }
  return `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}`;
}
/**
 * The main polling loop for running a task on zendesk tickets
 * @param task
 * @returns
 */
export function watchZendesk(
  task: (ticket: Ticket) => void
): (id: number) => void {

  const job = new CronJob(`*/${POLL_RATE} * * * * *`, async () => {
    const start = new Date();

    // Iterate over the queue
    for await (const [id, startTime] of workQueue.entries()) {
      if (startTime && start.getTime() > startTime + JOB_TIMEOUT) {
        warn(`Ticket ${id} sync timed out before completion.`);
        workQueue.delete(id);
      }
    }

    trace(`${start.toISOString()} Polling Zendesk.`);

    // Queue additional items
    let tickets = await pollZd();
    tickets = tickets.filter(t => !workQueue.has(t.id));
    info(`Current workQueue size: ${workQueue.size}`);
    if (tickets.length) info(`Adding tickets to work queue: ${tickets.map(t => t.id).join(', ')}`);
    for await (const ticket of tickets) {
      if (tickets[ticket.id]) continue;
      trace(`Adding ticket ${ticket.id} to work queue.`);
      workQueue.set(ticket.id, 0);
      // Do task
      task(ticket);
    }
  });

  job.start();

  return (id: number) => {
    workQueue.delete(id);
  };
}

if (esMain(import.meta)) {
  trace('esMain determined to run the service');
  await run();
}
