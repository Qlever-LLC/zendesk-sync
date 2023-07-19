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

import { connect, doJob, type OADAClient } from '@oada/client';
import axios from 'axios';
import { CronJob } from 'cron';
import cloneDeep from 'clone-deep';
import debug from 'debug';
import md5 from 'md5';
import PQueue from 'p-queue';
import { tpDocTypesTree } from './tree.js';
// Stuff from config
const { token, domain } = config.get('oada');
const { username, password, domain: ZD_DOMAIN } = config.get('zendesk');
const SAP_FIELD = 'sap_id';
const CONCURRENCY = config.get('concurrency');

const info = debug('zendesk-sync:info');
const warn = debug('zendesk-sync:warn');
const trace = debug('zendesk-sync:trace');

const POLL_RATE = 3;
const JOB_TIMEOUT = 100_000;
const ORG_FIELD_ID = 17666136440077; //TODO: This value is for the sandbox. Get the id for prod
const work = new PQueue({ concurrency: CONCURRENCY });
let cleanup: (id: number) => void | undefined
tpDocTypesTree['resources'] = cloneDeep(tpDocTypesTree?.bookmarks?.trellisfw?.['trading-partners'] ?? {});


//TODO: 1. -Watch for organization and SAP ID changes and handle these with trellis-data-manager updates and such.
//         -Update: should not need to do this with the way its comparing name and sapids then calling 'trading-partners-update'
//      2. -Error handling: what if any of the http requests in handleTicket fail?
export async function run() {
  const oada = await connect({ token, domain });
  cleanup = watchZendesk(async (ticket: OrgTicket) => {
    work.add(async () => handleTicket(ticket, oada));
  });
}

/**
 * Get the current set of solved tickets for which the associated
 * organization has an SAP ID assigned. Called on a regular interval.
**/
export async function pollZd(): Promise<Array<OrgTicket>> {
  const tickets : Array<Ticket> = [];
  let response: SearchResponse | { next: boolean } = { next: true };
  while (response.next) {
    response = ((await axios({
      method: 'get',
      url: `${ZD_DOMAIN}/api/v2/search.json` || response.next as unknown as string,
      auth: {
        username,
        password,
      },
      params: {
        type: 'ticket',
        query: 'type:ticket status:solved',
      }
    })) as unknown as { data: SearchResponse }).data;
    tickets.push(...response.results);
  }
  if (tickets.length > 0) info(`Got tickets: ${tickets.map(t => t.id).join(',')}`);

  // Now get the set of tickets with an organization
  const tixWithOrgs = tickets.filter(
    (t) => t?.custom_fields.find(field => field.id === ORG_FIELD_ID && field.value !== null)
    ?? t.organization_id !== null
  );

  const orgs = Array.from(new Set(tixWithOrgs.map((t) => t.organization_id)));
  const organizations: Org[] = [];

  if (orgs.length > 0) {
    const many = ((await axios({
      method: 'get',
      url: `${ZD_DOMAIN}/api/v2/organizations/show_many.json`,
      auth: {
        username,
        password,
      },
      params: {
        ids: orgs.join(','),
      }
    })) as unknown as { data: ManyResponse }).data;
    organizations.push(...many.organizations.filter((o) => o.organization_fields[SAP_FIELD]));
  }

  return tickets.map((ticket) => ({
    ...ticket,
    organization: organizations.find((o) => o.id === ticket.organization_id)
  })).filter(t => Boolean(t.organization)) as unknown as Array<OrgTicket>
}

/**
 * Sync a ticket to trellis, triggering lf-sync over to LF.
 * @param ticket
 * @param oada
 */
export async function handleTicket(ticket: OrgTicket, oada: OADAClient): Promise<void | string> {
  const { id, name } = ticket.organization;
  const sapids = ticket.organization.organization_fields[SAP_FIELD].split(',').map(id => `sap:${id}`);
  const zid = `zendesk:${id}`;
  const { result } = await doJob(oada, {
    service: 'trellis-data-manager',
    type: 'trading-partners-ensure',
    config: {
      element: {
        name: ticket.organization.name,
        externalIds: [zid],
      }
    }
  }) as unknown as { result: EnsureResult };
  const tp = result.entry;
  if (sapids.some(sapid => !tp.externalIds.includes(sapid)) || tp.name !== name) {
    await doJob(oada, {
      service: 'trellis-data-manager',
      type: 'trading-partners-update',
      config: {
        element: {
          masterid: tp.masterid,
          name: ticket.organization.name,
          externalIds: [zid, ...sapids],
        }
      }
    })
  }

  const pdf = await generatePdf(ticket, oada);

  // sync the pdf to Trellis
  //TODO: eliminate edge cases where an attachment may use the dirname or something...
  const trellisname = `${ticket.id}-${md5(JSON.stringify(ticket))}`;
  await oada.put({
    path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}`,
    // @ts-expect-error doesn't like union type?
    data: ticket,
    tree: tpDocTypesTree,
    contentType: 'application/vnd.zendesk.ticket.1+json',
  });

  let pdfid = md5(pdf.ticket.toString())
  await oada.put({
    path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}/_meta/vdoc/pdfs/${pdfid}`,
    data: pdf.ticket,
    tree: tpDocTypesTree,
    contentType: 'application/pdf',
  });
  await oada.put({
    path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}/_meta/vdoc/pdfs/${pdfid}/_meta`,
    data: { filename: `Ticket${trellisname}_MessageContent.pdf` },
  });

  for await (const attach of pdf.attachments) {
    const buff = ((await axios({
      method: 'get',
      url: attach.content_url,
      responseType: 'arraybuffer',
    })) as unknown as { data: string }).data;
    pdfid = md5(buff.toString()+' ;')
    await oada.put({
      path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}/_meta/vdoc/pdfs/${pdfid}`,
      data: Buffer.from(buff, 'utf-8'),
      tree: tpDocTypesTree,
      contentType: attach.content_type,
    });
    await oada.put({
      path: `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}/_meta/vdoc/pdfs/${pdfid}/_meta`,
      data: { filename: attach.file_name }
    });
  }

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
        status: 'closed'
      },
    }
  });

  if (cleanup) {
    trace(`Marked sync operation for ticket [${ticket.id}] as finished.`)
    cleanup(ticket.id);
  }
  return `/${tp.masterid}/bookmarks/trellisfw/documents/tickets/${trellisname}`;
}
/**
 * The main polling loop for running a task on zendesk tickets
 * @param task
 * @returns
 */
export function watchZendesk(task: (ticket: OrgTicket) => void): (id: number) => void {
  const workQueue = new Map<number, number>();

  const job = new CronJob(`*/${POLL_RATE} * * * * *`, async () => {
    const start = new Date();

    // Iterate over the queue
    for await (const [id, startTime] of workQueue.entries()) {
      if (start.getTime() > startTime + JOB_TIMEOUT) {
        warn(`Ticket ${id} sync never completed.`);
        workQueue.delete(id);
      }
    }

    trace(`${start.toISOString()} Polling Zendesk.`);

    // Queue additional items
    const tickets = await pollZd();
    for await (const ticket of tickets) {
      if (!workQueue.has(ticket.id)) {
        trace(`Adding ticket ${ticket.id} to work queue.`);
        workQueue.set(ticket.id, Date.now());

        // Do task
        task(ticket);
      }
    }
  });

  job.start();

  return (id: number) => {
    workQueue.delete(id);
  };
}

/**
 *
 * @param ticket
 * @returns
 */
export async function generatePdf(ticket: OrgTicket, oada: OADAClient): Promise<GenerateResponse> {
  if (ticket) {}
  const { data: pdf } = await oada.get({
    path: `/resources/2SWmnsBv0JaaQsjATksuSVs0Ynz`
  });

  return {
    ticket: pdf as unknown as Buffer,
    attachments: [{
      "url": "https://smithfielddocs1675786857.zendesk.com/api/v2/attachments/17698886938637.json",
      "id": 17698886938637,
      "file_name": "Get_trading_partners.pdf",
      "content_url": "https://smithfielddocs1675786857.zendesk.com/attachments/token/vqeBqaBsgjXG7r8hsct9yXbnD/?name=Get_trading_partners.pdf",
      "mapped_content_url": "https://smithfielddocs1675786857.zendesk.com/attachments/token/vqeBqaBsgjXG7r8hsct9yXbnD/?name=Get_trading_partners.pdf",
      "content_type": "application/pdf",
      "size": 112441,
      "width": null,
      "height": null,
      "inline": false,
      "deleted": false,
      "malware_access_override": false,
      "malware_scan_result": "malware_not_found",
      "thumbnails": []
    }],
  }
}

interface GenerateResponse {
  ticket: Buffer;
  attachments: Array<Attachment>;
}

export interface Org {
  id: number;
  name: string;
  [SAP_FIELD]: string;
  organization_fields: {
    [SAP_FIELD]: string;
  }
}

export interface ManyResponse {
  organizations: Array<Org>
};

export interface SearchResponse {
  results: Array<Ticket>;
  next: string | null;
  previous: string | null;
  facets: null | any;
  count: number;
}

export interface Ticket {
  "url": string;
  "id": number;
  "external_id": number | null,
  "via": {
    "channel": number;
    "source": {
      "from": {
        "address": string;
        "name": string;
      },
      "to": {
        "name": string;
        "address": string;
      },
      "rel": string | null;
    }
  },
  "created_at": string;
  "updated_at": string;
  "type": null,
  "subject": string;
  "raw_subject": string;
  "description": string;
  "priority": string;
  "status": string;
  "recipient": string;
  "requester_id": number;
  "submitter_id": number;
  "assignee_id": number;
  "organization_id": number | null;
  "group_id": number;
  "collaborator_ids": any[];
  "follower_ids": any[];
  "email_cc_ids": any[];
  "forum_topic_id": null;
  "problem_id": null;
  "has_incidents": false;
  "is_public": true;
  "due_at": null;
  "tags": any[];
  "custom_fields": Array<{
    "id": number;
    "value": any;
  }>;
  "satisfaction_rating": any;
  "sharing_agreement_ids": any[];
  "custom_status_id": number;
  "fields": Array<{
    "id": number;
    "value": any;
  }>;
  "followup_ids": string[],
  "ticket_form_id": number;
  "brand_id": number;
  "allow_channelback": boolean;
  "allow_attachments": boolean;
  "from_messaging_channel": boolean;
  "result_type": string;
}

export interface Attachment {
  "url": string;
  "id": number;
  "file_name": string;
  "content_url": string;
  "mapped_content_url": string;
  "content_type": string;
  "size": number;
  "width": null | string;
  "height": null | string;
  "inline": boolean;
  "deleted": boolean;
  "malware_access_override": boolean;
  "malware_scan_result": string;
  "thumbnails": []
}

export type OrgTicket = Ticket & {
  organization: Org
}

export type EnsureResult = {
  entry?: any;
  matches?: any[];
  exact?: boolean;
  new?: boolean;
};
