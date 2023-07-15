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

test.before('Setup connection and test ticket data', async (t)=> {
  // TODO: Ensure a trading-partner exists with the sap id of the organization in the sandbox
  t.assert(true);
})

//test.after('clean up', async(t)=> {
//})

test('pollZd should regularly poll for closed tickets (those having SAPIDs; those without are ignored anyways)', async (t) => {
  const ticket = await postTicket();
  await pollZd();

  const tpid = '';
  const resp = await oada.get({
    path: `/bookmarks/trellisfw/trading-partners/${tpid}/bookmarks/trellisfw/documents/tickets/${tpid}`,
  }) as unknown as { data: Record<string, any> };

  const ticketid = md5(JSON.stringify(ticket));
  t.assert(resp.data[ticketid]);
})

/*
test('Unit Test - handleTicket', async(t) => {

})

test('Unit Test - watchZendesk', async(t) => {

})

test('Unit Test - run', async(t) => {

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
  await axios({
    method: 'post',
    url: `${ZD_DOMAIN}/api/v2/search.json`,
    auth: {
      username,
      password,
    },
    params: {
      type: 'ticket',
      query: 'type:ticket status:solved',
    }
  })
}