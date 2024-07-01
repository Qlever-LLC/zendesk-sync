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
import { type Job, type Json, postJob } from '@oada/jobs';
import {
  getTicket,
  getTicketFieldValue,
  setCustomField,
  setTicketStatus,
  setTrellisState,
} from '../zd/zendesk.js';
import type { LFCloserConfig } from '../types.js';
import type { OADAClient } from '@oada/client';
import type { WorkerContext } from '@oada/jobs/dist/Service.js';
import { config } from '../config.js';
import { doJob } from '@oada/client/jobs';
import { makeLoggers } from '../logger.js';

const log = makeLoggers('service:lfCloser');

// FIXME: Really should be importing this from somewhere...
interface GetLFEntryJobConfig {
  doc: string;
}

interface VDocEntry {
  fields: {
    'Original Filename': string;
  };
  LaserficheEntryID: number;
  path: string;
}

type GetLFEntryJobResult = Record<string, VDocEntry>;

export async function makeLfCloserJob(
  oada: OADAClient,
  jobConfig: LFCloserConfig,
) {
  await postJob(oada, `/bookmarks/services/zendesk-sync/jobs/pending`, {
    service: 'zendesk-sync',
    type: config.get('service.lfCloser.name'),
    config: jobConfig as unknown as Json,
  });
}

export async function lfCloserService(
  job: Job,
  context: WorkerContext,
): Promise<Json> {
  const jobConfig = job.config as unknown as LFCloserConfig;
  const { ticketId } = jobConfig;

  log.info({ ticketId }, 'Starting a Laserfiche closer job.');

  const ticket = await getTicket(ticketId);

  if (ticket.status === 'closed') {
    log.warn({ ticketId }, 'Trying to close a ticket that is already closed?');
    return {};
  }

  const currentState = getTicketFieldValue(
    ticket,
    config.get('zendesk.fields.state'),
  );

  // Logical check on service's joint state machine
  if (currentState !== 'trellis-archived') {
    log.warn({ ticketId }, 'Closeing ticket not yet archived?');
    throw new Error('Ticket not yet archived!');
  }

  log.debug({ ticketId }, 'Creating get-lf-entry job to learn LF state');
  const getLFEntryJobConfig: GetLFEntryJobConfig = { doc: jobConfig.doc };

  const getLfJob = await doJob(context.oada, {
    service: 'lf-sync',
    type: 'get-lf-entry',
    // Types around @oada/jobs and doJob aren't consistent
    config: getLFEntryJobConfig as unknown as Record<string, unknown>,
  });
  const entities = getLfJob.result as unknown as GetLFEntryJobResult;

  // Find ticket PDF vDoc
  const ticketVdocKey = Object.keys(entities).find((k) =>
    entities[k]?.fields['Original Filename'].match(/Ticket-\d+.pdf/),
  );

  if (!ticketVdocKey) {
    log.error({ ticketId, ticketVdocKey }, 'Could not find Ticket PDF vDoc?');
    throw new Error('No ticket PDF vDoc in Ticket Trellis resource?');
  }

  const lfId = entities[ticketVdocKey]?.LaserficheEntryID;
  if (!lfId) {
    log.error({ ticketId }, 'No Laserfiche ID for ticket PDF?');
    throw new Error('Could not determine Laserfiche ID for ticket PDF!');
  }

  /* FIXME: Disable path field until lf-sync support the filing workflow
  const path = entities[ticketVdocKey]?.path
    .split('\\')
    .slice(0, -1)
    .join('\\');
  if (!path) {
    log.error({ ticketId }, 'No Laserfiche path for ticket PDF?');
    throw new Error('Could not determine Laserfiche path for ticket folder!');
  }
  */

  log.info({ ticketId }, 'Ticket is in LF. Update Zendesk state and status');
  await setTrellisState(ticket, {
    state: 'trellis-lf-archived',
    status: undefined,
  });

  if (config.get('service.lfCloser.pathFieldId') > 0) {
    log.debug({ ticketId }, 'Add LF path meta data back to Zendesk');
    await setCustomField(ticket, [
      /* FIXME: Disable path field until lf-sync support the filing workflow
      {
        id: config.get('service.lfCloser.pathFieldId'),
        value: path,
      },
      */
      {
        id: config.get('service.lfCloser.lfIdFieldId'),
        value: `${lfId}`,
      },
    ]);
  }

  log.info({ ticketId }, `Done. Closing ticket.`);

  if (config.get('mode') === 'production') {
    await setTicketStatus(ticket, 'closed');
  } else {
    log.debug({ ticketId }, `Testing mode, don't actually closing ticket.`);
  }

  return {};
}