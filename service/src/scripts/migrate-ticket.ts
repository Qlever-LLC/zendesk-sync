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

/* eslint-disable no-console, no-process-exit, unicorn/no-process-exit -- CLI script */

import { config } from '../config.js';

import { connect } from '@oada/client';
import { doJob } from '@oada/client/jobs';

import { getTicket } from '../zd/zendesk.js';

async function* ticketCounter() {
  for (let id = 7070; id <= 10_000; id++) {
    yield id;
  }
}

const oada = await connect({
  domain: config.get('oada.domain'),
  token: config.get('oada.token'),
});

for await (const id of ticketCounter()) {
  try {
    console.log(`Processing ticket ID: ${id}`);
    const ticket = await getTicket(id);

    if (ticket.status !== 'closed') {
      console.log('Skipping NOT closed ticket.');
      continue;
    }

    try {
      await doJob(oada, {
        service: 'zendesk-sync',
        type: config.get('service.archiveTicket.name'),
        config: {
          ticketId: ticket.id,
          closer: 'none',
        },
      });
    } catch (error) {
      console.log(`=== Error with ticket: ${id}!!`);
      console.error(error);

      process.exit();
    }
  } catch {
    console.log(`=== Not a ticket: ${id}`);
  }
}

console.log('DONE');
