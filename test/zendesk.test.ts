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

import axios from 'axios';
import test from 'ava';
import { config } from '../dist/config.js';
import { connect } from '@oada/client';
import { pollZd, handleTicket, watchZendesk, run } from '../dist/index.js';
import md5 from 'md5';
const { token, domain } = config.get('oada');
const { password, username, domain: ZD_DOMAIN } = config.get('zendesk');

const oada = await connect({domain, token});
const CENT_TEST_ORG = 12909020494349;

//test.before('Setup connection and test ticket data', async (t)=> {
  // TODO: Ensure a trading-partner exists with the sap id of the organization in the sandbox
//})

//test.after('clean up', async(t)=> {
//})

test('pollZd should regularly poll for closed tickets (those having SAPIDs; those without are ignored anyways)', async (t:any) => {
  const { ticket } = await postTicket();
  const tickets = await pollZd();

  const tick = tickets.find(t => t.id === ticket.id);
  t.assert(tick)
  t.assert(tick?.organization !== null)
})

test.only('Unit Test - handleTicket', async(t: any) => {
  const { ticket } = await postTicket();
  ticket.organization = {
    url: 'https://smithfielddocs1675786857.zendesk.com/api/v2/organizations/12909020494349.json',
    id: 12909020494349,
    name: 'Centricity',
    shared_tickets: false,
    shared_comments: false,
    external_id: null,
    created_at: '2023-02-07T16:24:14Z',
    updated_at: '2023-07-16T18:44:03Z',
    domain_names: [
      'centricity.us'
    ],
    details: '',
    notes: '',
    group_id: null,
    tags: [],
    organization_fields: {
      sap_id: '999999999'
    }
  };
  const resultPath = await handleTicket(ticket, oada);
  t.assert(resultPath);
})

/*
test('Unit Test - watchZendesk', async(t: any) => {

})

test('Unit Test - run', async(t: any) => {

})

test('Unit Test - ', async(t) => {

})

test.only('Should create a folder for each ticket', async (t) => {

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

async function postTicket() {
  return (await axios({
    method: 'post',
    url: `${ZD_DOMAIN}/api/v2/tickets.json`,
    auth: {
      username,
      password,
    },
    data: {
      ticket: {
        via: {
          channel: 'email',
          source: {
            from: {
              address: 'noel.samuel.a@gmail.com',
              name: 'Sam Noel',
            },
            to: {
              name: 'SF Sandbox',
              address: 'support@smithfielddocs1675786857.zendesk.com',
            },
            rel: null
          }
        },
        subject: 'Test Subject',
        comment: {
          body: 'This is a test message used while testing the zendesk-sync service. Thanks.',
        },
        priority: 'normal',
        status: 'solved',
        recipient: 'support@smithfielddocs1675786857.zendesk.com',
      },
    }
  })).data;
}