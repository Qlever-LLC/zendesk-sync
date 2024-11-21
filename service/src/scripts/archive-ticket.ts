/**
 * @license
 * Copyright 2022 Qlever LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console, no-process-exit, unicorn/no-process-exit */
import '@oada/pino-debug';

import { argv } from 'node:process';
import { connect } from '@oada/client';
import { doSyncTicketJob } from '../services/syncTicket.js';

import { config } from '../config.js';

const { token, domain } = config.get('oada');
const oada = await connect({ token, domain });

/* A quick script to move an EntryId to a new location */

if (argv.length !== 3) {
  console.error('USAGE: node archive-ticket.js ticketId');
  process.exit(1);
}

const ticketId = Number(argv[2]); // As unknown as EntryId;
await doSyncTicketJob(oada, {
  ticketId,
  archivers: config.get('service.poller.archivers'),
});

console.info(`Created archive job for ticket ${ticketId}`);
process.exit(0);