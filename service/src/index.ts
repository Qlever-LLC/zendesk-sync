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

import { readFileSync } from "node:fs";

import { pino } from "@oada/pino-debug";
import { config } from "./config.js";

import { type OADAClient, connect } from "@oada/client";
import { Service } from "@oada/jobs";
import type { CronJob } from "cron";
import esMain from "es-main";
import { pollerService } from "./services/poller.js";
import { syncTicketService } from "./services/syncTicket.js";

// FIXME: Can @oada/pino-debug set `service` automatically from package.json name?
const log = pino({ base: { service: "zendesk-sync" } });

// Stuff from config
const { token, domain } = config.get("oada");

// 1. Poller:
//    - Polls ZenDesk for tickets with "closed" and tag "trellis-pending".
//    - Creates "archive" jobs for each ticket
//    - Setting ZD field to "processing"
// 2. @oada/jobs `archive`
//    - Pull ticket data and meta data
//    - Generates PDF
//    - Puts data and PDF into trellis
//    - Updates ZD field to "Trellis Archived"
//    - Runs through all archivers
//    - Updates ZD field to "Trellis Finished"

async function run() {
  let oada: OADAClient;
  let service: Service;
  let poller: CronJob;

  try {
    log.info("Connecting to Trellis");
    oada = await connect({ token, domain });

    log.info("Creating Zendesk-sync service");
    service = new Service({
      name: "zendesk-sync",
      oada,
      log,
      concurrency: config.get("zendesk.concurrency"),
    });

    if (config.get("service.syncTicket.enable")) {
      log.info("Initialize `syncTicket` service");
      service.on(
        "syncTicket",
        config.get("service.syncTicket.timeout"),
        syncTicketService,
      );
    } else {
      log.info("syncTicket service disabled.");
    }

    log.info("Start @oada/jobs based services");
    await service.start();

    if (config.get("service.poller.enable")) {
      log.info("Start polling ZenDesk polling service");
      poller = pollerService(log, oada);
    } else {
      log.info("ZenDesk polling disabled.");
    }
  } catch (error) {
    log.fatal({ error }, `Failed to start service: ${error}`);

    // @ts-expect-error Try to stop poller, if needed
    if (poller) {
      poller.stop();
    }

    // @ts-expect-error Try to stop @oada/jobs services, if needed
    if (service) {
      await service.stop();
    }

    // @ts-expect-error Try to disconnect from Trellis, if needed
    if (oada) {
      await oada.disconnect();
    }
  }
}

if (esMain(import.meta)) {
  log.trace("esMain determined to run the service");

  const { name, version } = JSON.parse(
    readFileSync("./package.json", "utf8"),
  ) as { name: string; version: string };

  log.info({ name, version }, `Starting ${name}, version ${version}`);

  await run();
}
