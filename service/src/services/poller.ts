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

import type { OADAClient } from "@oada/client";
import type { Logger } from "@oada/pino-debug";
import { CronJob } from "cron";

import { config } from "../config.js";
import {
  State,
  type Ticket,
} from "../types.js";
import type { TrellisState } from "../zd/utils.js";
import {
  getCustomerOrgId,
  getTicket,
  getTicketFieldValue,
  searchTickets,
  setTrellisState,
} from "../zd/zendesk.js";
import { makeSyncTicketJob } from "./syncTicket.js";

let pollRunning = false;

export function pollerService(logger: Logger, oada: OADAClient): CronJob {
  const logOrig = logger.child({ service: "poller" });

  const cron = CronJob.from({
    cronTime: `*/${config.get("service.poller.pollRate")} * * * * *`,
    start: true,
    runOnInit: true,
    async onTick() {
      if (pollRunning) {
        logOrig.warn({}, "Poller ticks overlapped?");
        return;
      }

      pollRunning = true;

      try {
        logOrig.info("Polling ZenDesk for eligible tickets");

        const tickets = await searchTickets(logOrig, "status:solved");

        logOrig.trace({}, `Found ${tickets.length} tickets.`);

        // Process them in new to old order, where old is likely to still have the same
        // issues that held it up prior
        // TODO: Check the potential tickets in parallel?
        for await (const { id: ticketId } of tickets.reverse()) {
          const log = logOrig.child({ ticketId });
          log.info("Checking ticket");

          // NOTE: The ticket that is returned by the search can be out of date.
          //       Even thought we already have the ticket, we need to get it a
          //       fresh copy from the API to make the following tests are done
          //       against the current ticket state rather than some old cache
          //       from the search API.
          const ticket = await getTicket(log, ticketId);

          const nextState = await computeNextState(log, ticket);
          const currentState = getTicketFieldValue(
            ticket,
            config.get("zendesk.fields.state"),
          );
          const currentStatus = getTicketFieldValue(
            ticket,
            config.get("zendesk.fields.status"),
          );

          // Update Zendesk with the new state, but only if changed. Otherwise, Zendesk tickets are flodded with "useless" updates
          if (
            (nextState.state !== undefined &&
              currentState !== nextState.state) ||
            (nextState.status !== undefined &&
              currentStatus !== nextState.status)
          ) {
            await setTrellisState(log, ticket, nextState);
          }

          // Make a job to move forward in the state machine
          if (nextState.state === State.Processing) {
            log.info({ ticketId: ticket.id }, "Creating an archive job");

            await makeSyncTicketJob(oada, {
              ticketId: ticket.id,
              archivers: config.get("service.poller.archivers"),
            });
          }
        }
      } catch (error: unknown) {
        logOrig.error(error, `Error polling ZenDesk: ${error} `);
      } finally {
        pollRunning = false;
      }
    },
  });

  return cron;
}

async function computeNextState(
  log: Logger,
  ticket: Ticket,
): Promise<TrellisState> {
  const currentState =
    getTicketFieldValue(ticket, config.get("zendesk.fields.state")) ?? "";

  log.trace({ currentState }, "Lookup ticket currentState");

  if (currentState !== "" && currentState !== State.Pending) {
    log.trace(
      { currentState },
      `Poller found a ticket already post ${State.Pending}. Keeping current state.`,
    );

    return { state: undefined, status: undefined };
  }

  // **Should** always have a customer ID if ZenDesk is configured correctly (i.e., a trigger that requires it to "solve")
  const customerId = getCustomerOrgId(ticket);
  if (!customerId) {
    log.error("No customer organization associated. Logic error!");
    return {
      state: State.Hold,
      status: "Ticket solved without assigned customer.",
    };
  }

  return {
    state: State.Processing,
    status: "Creating ticket archive.",
  };
}
