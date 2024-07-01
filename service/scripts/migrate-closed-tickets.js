import esMain from 'es-main';
import { writeFileSync } from 'node:fs';

import {
  doCredentialedApiRequest,
  getTicket,
  getTicketArchive,
} from '../dist/zd/zendesk.js';
import { generateTicketPdf } from '../dist/zd/pdf.js';

import pTimeout from 'p-timeout';

const abortController = new AbortController();

async function doFileArchive(i, signal) {
  return new Promise(async function (resolve, reject) {
    signal.addEventListener('abort', () => {
      reject(new Error('Uncaught Error'));
    });

    console.log(`====== Starting ticket: ${i}`);

    try {
      let ticket;
      try {
        ticket = await getTicket(i);
      } catch (e) {
        console.log(`=== Not a ticket: ${i}`);
        return resolve();
      }

      console.log(`====== Starting ticket: ${i}`);
      console.log(`====== Ticket found.  Archiving`);

      console.log('Fetching ticket archive');
      const archive = await getTicketArchive(ticket);

      writeFileSync(`./log/${ticket.id}.json`, JSON.stringify(archive));

      console.log('Creating ticket pdf');
      const ticketPdf = await generateTicketPdf(archive);

      console.log('Writing ticket pdf');
      writeFileSync(`./log/Ticket_${ticket.id}.pdf`, ticketPdf);

      // ticket attachments
      for await (const attach of Object.values(archive.attachments)) {
        console.log(`Writing attachment: ${attach.file_name}`);
        const buff = await doCredentialedApiRequest(attach.content_url);
        writeFileSync(`./log/Ticket_${ticket.id}_${attach.file_name}`, buff);
      }

      // Side ticket attachments
      for (const sideConvoArchive of archive.sideConversations) {
        console.log(`Processing side conversation`);

        for await (const attach of Object.values(
          sideConvoArchive.attachments,
        )) {
          console.log(`Wtriting attachment: ${attach.file_name}`);
          const buff = await doCredentialedApiRequest(attach.content_url);

          writeFileSync(
            `./log/Ticket_${ticket.id}_Side_${sideConvoArchive.sideConversation.id}_${attach.file_name}`,
            buff,
          );
        }
      }
    } catch (e) {
      console.error(`***** ERORR: ${e} `);
      return;
    }

    return resolve();
  });
}

process.on('uncaughtException', (e) => {
  console.log(`***** ERROR: ${e}`);
  abortController.abort();
});

//let throttled = throttle(doFileArchive);
if (esMain(import.meta)) {
  //3410
  for (let i = 3810; i <= 8000; i++) {
    try {
      await pTimeout(doFileArchive(i, abortController.signal), {
        milliseconds: 60000,
      });
    } catch (e) {
      console.log(`***** ERROR: ${e}`);
    }
  }

  console.log('DONE');
  process.exit();
}