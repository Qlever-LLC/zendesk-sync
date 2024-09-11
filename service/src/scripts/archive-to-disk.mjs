/**
 * @license
 * Copyright 2024 Qlever LLC
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

/* eslint-disable no-console, no-process-exit, unicorn/no-process-exit -- CLI script */

import { writeFile } from 'node:fs/promises';

import esMain from 'es-main';
import pTimeout from 'p-timeout';

import {
  doCredentialedApiRequest,
  getTicket,
  getTicketArchive,
} from '../../dist/zd/zendesk.js';
import { generateTicketPdf } from '../../dist/zd/pdf.js';

const abortController = new AbortController();

/*
Import pThrottle from 'p-throttle';
const throttle = pThrottle({
  limit: 200,
  interval: 60 * 1000, // 1 minute
  strict: true,
});
*/

async function doFileArchive(index, signal) {
  return new Promise(async function (resolve, reject) {
    signal.addEventListener('abort', () => {
      reject(new Error('Uncaught Error'));
    });

    console.log(`====== Starting ticket: ${index}`);

    try {
      let ticket;
      try {
        ticket = await getTicket(index);
      } catch {
        console.log(`=== Not a ticket: ${index}`);
        return resolve();
      }

      console.log(`====== Starting ticket: ${index}`);
      console.log(`====== Ticket found.  Archiving`);

      console.log('Fetching ticket archive');
      const archive = await getTicketArchive(ticket);

      await writeFile(`./log/${ticket.id}.json`, JSON.stringify(archive));

      console.log('Creating ticket pdf');
      const ticketPdf = await generateTicketPdf(archive);

      console.log('Writing ticket pdf');
      await writeFile(`./log/Ticket_${ticket.id}.pdf`, ticketPdf);

      // Ticket attachments
      for await (const attach of Object.values(archive.attachments)) {
        console.log(`Writing attachment: ${attach.file_name}`);
        const buff = await doCredentialedApiRequest(attach.content_url);
        await writeFile(`./log/Ticket_${ticket.id}_${attach.file_name}`, buff);
      }

      // Side ticket attachments
      for await (const sideConversationArchive of archive.sideConversations) {
        console.log(`Processing side conversation`);

        for await (const attach of Object.values(
          sideConversationArchive.attachments,
        )) {
          console.log(`Writing attachment: ${attach.file_name}`);
          const buff = await doCredentialedApiRequest(attach.content_url);

          await writeFile(
            `./log/Ticket_${ticket.id}_Side_${sideConversationArchive.sideConversation.id}_${attach.file_name}`,
            buff,
          );
        }
      }
    } catch (error) {
      console.error(`***** ERROR: ${error} `);
      return;
    }

    return resolve();
  });
}

process.on('uncaughtException', (e) => {
  console.log(`***** ERROR: ${e}`);
  abortController.abort();
});

// Let throttled = throttle(doFileArchive);
if (esMain(import.meta)) {
  // 3410
  for (let index = 3810; index <= 8000; index++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await pTimeout(doFileArchive(index, abortController.signal), {
        milliseconds: 60_000,
      });
    } catch (error) {
      console.log(`***** ERROR: ${error}`);
    }
  }

  console.log('DONE');
  process.exit();
}
