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
import {
  archiveTicketService,
  makeArchiveTicketJob,
} from './services/archiveTicket.js';
import { Service } from '@oada/jobs';
import { config } from './config.js';
import { connect } from '@oada/client';
import esMain from 'es-main';
import { lfCloserService } from './services/lfCloser.js';
import { makeLoggers } from './logger.js';
import { pollerService } from './services/poller.js';
import { readFileSync } from 'node:fs';
import { isCloser } from './types.js';

const log = makeLoggers('');

// Stuff from config
const { token, domain } = config.get('oada');

// 1. Poller:
//    - Polls ZenDesk for tickets with "closed" and tag "trellis-pending".
//    - Creates "archive" jobs for each ticket
//    - Setings ZD field to "processing"
// 2. @oada/jobs `archive`
//    - Pull ticket data and meta data
//    - Generates PDF
//    - Puts data and PDF into trellis
//    - Updates ZD field to "Trellis Archived"
//    - Creates an fl-closer job if configured to do so, otherwise close ticket
// 3. @oada/jobs `lfCloser`
//    - Askes fl-sync for final location data and archive confirmation
//    - Updates ZD field to "FoodLogiq Archived"
//    - Closes ZD Ticket

async function run() {
  let oada;
  let service;
  let poller;

  try {
    log.info({}, 'Connecting to Trellis');
    oada = await connect({ token, domain });

    log.info({}, 'Creating Zendesk-sync service');
    service = new Service({
      name: 'zendesk-sync',
      oada,
      concurrency: config.get('zendesk.concurrency'),
    });

    log.info({}, 'Initialize `archiveTicket` service');
    service.on(
      config.get('service.archiveTicket.name'),
      config.get('service.archiveTicket.timeout'),
      archiveTicketService,
    );

    log.info({}, 'Initialize `lfCloser` service');
    service.on(
      config.get('service.lfCloser.name'),
      config.get('service.lfCloser.timeout'),
      lfCloserService,
    );

    log.info({}, 'Start @oada/jobs based services');
    await service.start();

    log.info({}, 'Start polling ZenDesk polling service');
    poller = pollerService(oada);
    //
  } catch (error) {
    log.fatal({ error }, `Failed to start service: ${error}`);
    // Try to stop poller, if needed
    if (poller) {
      poller.stop();
    }

    // Try to stop @oada/jobs services, if needed
    if (service) {
      await service.stop();
    }

    // Try to disconnect from Trellis, if needed
    if (oada) {
      await oada.disconnect();
    }
  }
}

if (esMain(import.meta)) {
  log.trace({}, 'esMain determined to run the service');

  const { name, version } = JSON.parse(
    readFileSync('./package.json', 'utf8'),
  ) as { name: string; version: string };

  log.info({ name, version }, `Starting ${name}, version ${version}`);

  await run();
}