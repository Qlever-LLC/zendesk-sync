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

/* eslint-disable unicorn/no-null */

import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { connect } from "@oada/client";
import test from "ava";

import axios from "axios";
import md5 from "md5";
import PQueue from "p-queue";
import { config } from "../dist/config.js";

import { handleTicket, pollZd, watchZendesk } from "../dist/index.js";
import type { Ticket } from "../dist/types.js";
import { generateTicketPdf } from "../dist/zd/pdf.js";
import { getTicketArchive } from "../dist/zd/zendesk.js";

const { token, domain } = config.get("oada");
const { password, username, domain: ZD_DOMAIN } = config.get("zendesk");
const CONCURRENCY = config.get("concurrency");
const { email1, email2 } = config.get("testing");
const POLL_RATE = config.get("poll-rate");

const oada = await connect({ domain, token });
const _CENT_TEST_ORG = 12_909_020_494_349;
const MASTERID = "resources/2ShqFzJoJ1yxjFe9zGSUVuEIBoa";
console.log(
  `TESTING WITH THE FOLLOWING TICKET POLL RATE: every ${POLL_RATE} seconds. ADJUST IF NECESSARY.`,
);

// Test.before('Setup connection and test ticket data', async (t)=> {
// TODO: Ensure a trading-partner exists with the sap id of the organization in the sandbox
// })

// test.after('clean up', async(t)=> {
// })

test("Should make ticket from PDF", async (t) => {
  t.timeout(100_000);
  const archive = await getTicketArchive(2459);
  t.assert(archive);
  // T.assert(archive.org !== null);
  const pdf = await generateTicketPdf(archive);

  await writeFile("./test/output.pdf", pdf);
});

test.skip("pollZd should regularly poll for closed tickets (those having SAPIDs; those without are ignored anyways)", async (t) => {
  const { ticket } = await postTicket({});
  const tickets = await pollZd();

  const tick = tickets.find((t) => t.is === ticket.id);
  t.assert(tick);
  t.assert(tick?.organization_id !== null);
});

test.skip("Unit Test - handleTicket", async (t) => {
  const { ticket } = await postTicket({});
  ticket.organization = organization;
  const resultPath = await handleTicket(ticket, oada);
  t.assert(resultPath);
});

test.skip("Unit Test - handleTicket should fail when the customer org is missing SAPID", async (t) => {
  const { ticket } = await postTicket({ from: email2 });
  ticket.organization = organization;
  const resultPath = await handleTicket(ticket, oada);
  t.assert(resultPath);
});

test.skip("Unit Test - watchZendesk (this is essentially the run() method)", async (t) => {
  t.timeout(140_000);
  const work = new PQueue({ concurrency: CONCURRENCY });
  await watchZendesk(async (ticket: Ticket) => {
    work.add(async () => handleTicket(ticket, oada));
  });
  const { ticket } = await postTicket({});
  ticket.result_type = "ticket";
  ticket.organization = organization;
  await setTimeout(120_000);

  const trellisname = `${ticket.id}-${md5(JSON.stringify(ticket))}`;
  const { data: resp } = (await oada.get({
    path: `/${MASTERID}/bookmarks/trellisfw/documents/tickets/${trellisname}`,
  })) as unknown as { data: { _type: string; id: string } };
  const { data: meta } = await oada.get({
    path: `/${MASTERID}/bookmarks/trellisfw/documents/tickets/${trellisname}/_meta/vdoc/pdfs`,
  });
  t.is(resp.id, ticket.id);
  t.is(Object.keys(meta ?? {}).length, 2);
  t.is(resp._type, "application/vnd.zendesk.ticket.1+json");
});

/*
Test.only('Should create a folder for each ticket', async (t) => {

});

test('Should put all attachments into the folder (as well as the main trading-partner folder??)', (t) => {

})

test('Should find trading partners if sapid and zendesk id are new', (t) => {

})

test('Should find trading partners if sapid is modified', (t) => {

})

test('Should find trading partners if name is modified', (t) => {

})




test('Should close all tickets that ', (t) => {

})


})

test('Should maintain a listing of all zendesk organizations and their trellis trading-partners', (t) => {

})
*/

async function postTicket({
  status,
  from,
}: {
  status?: string;
  from?: { address: string; name: string };
}) {
  const ticket = (
    await axios({
      method: "post",
      url: `${ZD_DOMAIN}/api/v2/tickets.json`,
      auth: {
        username,
        password,
      },
      data: {
        ticket: {
          via: {
            channel: "email",
            source: {
              from: from ?? email2,
              to: {
                name: "SF Sandbox",
                address: "support@smithfielddocs1675786857.zendesk.com",
              },
              rel: null,
            },
          },
          subject: "Test Subject",
          comment: {
            body: "This is a test message used while testing the zendesk-sync service. Thanks.",
          },
          priority: "normal",
          status: status ?? "solved",
          recipient: "support@smithfielddocs1675786857.zendesk.com",
        },
      },
    })
  ).data;

  await axios({
    method: "put",
    url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.ticket.id}`,
    auth: {
      username,
      password,
    },
    data: {
      ticket: {
        comment: {
          body: "Here is the attachment",
          uploads: ["gvHKUYycZZygimOGNrd4G6ctF"], // TODO: These expire.
        },
      },
    },
  });

  return ticket;
}
/*
Async function postUpload() {
  return (await axios.post({
    method: 'post',
    url: `${ZD_DOMAIN}/api/v2/uploads.json`,
    auth: {
      username,
      password,
    },
    data: {
    }
  })).data;
}
*/

const organization = {
  url: "https://smithfielddocs1675786857.zendesk.com/api/v2/organizations/12909020494349.json",
  id: 12_909_020_494_349,
  name: "Centricity",
  shared_tickets: false,
  shared_comments: false,
  external_id: null,
  created_at: "2023-02-07T16:24:14Z",
  updated_at: "2023-07-16T18:44:03Z",
  domain_names: ["centricity.us"],
  details: "",
  notes: "",
  group_id: null,
  tags: [],
  organization_fields: {
    sap_id: "999999999",
  },
};
