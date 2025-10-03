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

/* eslint-disable no-process-exit, unicorn/no-process-exit */
import { argv } from "node:process";

import { connect } from "@oada/client";
import { doJob } from "@oada/client/jobs";
import { pino } from "@oada/pino-debug";

import { config } from "../config.js";
import { getTicket } from "../zd/zendesk.js";

const log = pino({ base: { script: argv[1] } });

if (argv.length !== 4) {
  log.error(
    "USAGE: node reprocess-closed-ticket-range.ts startTicketID stopTicketID",
  );
  process.exit(1);
}

const start = Number(argv[2]);
const stop = Number(argv[3]);

const { token, domain } = config.get("oada");
const oada = await connect({ token, domain });

async function* ticketCounter() {
  for (let id = start; id <= stop; id++) {
    yield id;
  }
}

log.info({ start, stop }, "Starting loop over tickets");
for await (const id of ticketCounter()) {
  try {
    log.info(`Checking ticket ID: ${id}`);
    const ticket = await getTicket(log, id);

    if (ticket.status !== "closed") {
      log.info("Skipping NOT closed ticket.");
      continue;
    }

    doJob(oada, {
      service: "zendesk-sync",
      type: "syncTicket",
      config: {
        ticketId: ticket.id,
        archivers: ["laserfiche"],
      },
    }).catch((error: unknown) => {
      log.error({ err: error, ticketId: id }, `${error}`);
    });
  } catch(error: unknown) {
    log.info({ err: error, ticketId: id }, "Not a ticket");
  }
}

log.info("DONE");
