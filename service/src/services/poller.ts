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
import { type Ticket, isCloser } from '../types.js';
import {
  type TrellisState,
  getCustomerOrgId,
  getOrg,
  getTicket,
  getTicketFieldValue,
  searchTickets,
  setTrellisState,
} from '../zd/zendesk.js';
import { CronJob } from 'cron';
import type { OADAClient } from '@oada/client';
import { config } from '../config.js';
import { makeArchiveTicketJob } from './archiveTicket.js';
import { makeLoggers } from '../logger.js';

const log = makeLoggers('service:poll');

let pollRunning = false;

export function pollerService(oada: OADAClient): CronJob {
  const cron = CronJob.from({
    cronTime: `*/${config.get('service.poller.poll-rate')} * * * * *`,
    start: true,
    runOnInit: true,
    async onTick() {
      if (pollRunning) {
        log.warn({}, 'Poller ticks overlapped?');
        return;
      }

      pollRunning = true;

      try {
        log.info('Polling ZenDesk for eligible tickets');

        let tickets = await searchTickets('status:solved');
        // Process them in new to old order, where old is likely to still have the same
        // issues that held it up prior
        tickets = tickets.reverse();

        log.trace({}, `Found ${tickets.length} tickets.`);

        // TODO: Check the potential tickets in parallel?
        for await (const t of tickets) {
          log.info({ ticketId: t.id }, 'Checking ticket');

          // NOTE: The ticket that is returned by the search can be out of date.
          //       Even thought we already have the ticket, we need to get it a
          //       fresh copy from the API to make the following tests are done
          //       against the current ticket state rather than some old cache
          //       from the search API.
          const ticket = await getTicket(t.id);

          const nextState = await computeNextState(ticket);
          const currentState = getTicketFieldValue(
            ticket,
            config.get('zendesk.fields.state'),
          );
          const currentStatus = getTicketFieldValue(
            ticket,
            config.get('zendesk.fields.status'),
          );

          // Update Zendesk with the new state, but only if changed. Otherwise, Zendesk tickets are flodded with "useless" updates
          if (
            currentState !== nextState.state ||
            currentStatus !== nextState.status
          ) {
            await setTrellisState(ticket, nextState);
          }

          // Make a job to move foward in the state machine
          if (nextState.state === 'trellis-processing') {
            log.info({ ticketId: ticket.id }, 'Creating an archive job');

            await makeArchiveTicketJob(oada, {
              ticketId: ticket.id,
              closer: isCloser(config.get('service.poller.closer')),
            });
          }
        }
      } catch (error) {
        log.error({ error }, `Error polling ZenDesk: ${error} `);
      } finally {
        pollRunning = false;
      }
    },
  });

  return cron;
}

async function computeNextState(ticket: Ticket): Promise<TrellisState> {
  const ticketId = ticket.id;
  const currentState =
    getTicketFieldValue(ticket, config.get('zendesk.fields.state')) ?? '';

  if (currentState !== '' && currentState !== 'trellis-pending') {
    log.warn({ ticketId }, 'Poller found a ticket not yet at trellis-pending?');

    return { state: currentState, status: undefined };
  }

  // **Should** always have a customer ID if ZenDesk is configured correctly (i.e., a trigger that requires it to "solve")
  const customerId = getCustomerOrgId(ticket);
  if (!customerId) {
    log.warn({ ticketId }, 'No customer organization associated. Logic error!');
    return {
      state: 'trellis-hold',
      status:
        'Ticket has tag tag:trellis-pending, but does not have an assigned customer. ZenDesk misconfigured?',
    };
  }

  // Get Zendesk's info on that customer
  const org = await getOrg(ticket, customerId);

  const sapId = org.organization_fields[config.get('zendesk.fields.SAPId')];
  const age = (Date.now() - new Date(ticket.updated_at).getTime()) / 1000;

  // If we have an SAP ID, then directly archive it
  if (sapId !== undefined) {
    log.trace({ ticketId }, 'Archiving ticket with SAPID');
    return {
      state: 'trellis-processing',
      status: `Archiving under ${org.name}, SAPID: ${sapId}`,
    };

    // If the ticket is yound, wait for someone to set the SAP ID on the organization
  }

  if (age <= config.get('service.poller.force-age')) {
    log.trace({ ticketId }, 'Skipping young ticket with no SAPID.');
    return {
      state: 'trellis-pending',
      status: `The ticket's organization does not have an SAP ID. Please set one at ${config.get('zendesk.domain')}/agent/organizations/${customerId}`,
    };

    // The ticket is too old, and will be auto-closed by ZenDesk. Force an archive without an SAP ID.
  }

  log.trace(
    { ticketId },
    `Archive old ticket (> ${(config.get('service.poller.force-age') / (24 * 60 * 60)).toFixed(1)} days old)`,
  );

  return {
    state: 'trellis-processing',
    status: `Forced archive due to age (> ${(config.get('service.poller.force-age') / (24 * 60 * 60)).toFixed(1)} days old)`,
  };
}