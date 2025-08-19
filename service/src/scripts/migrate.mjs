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
/* eslint-disable unicorn/no-null */
/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */

import fs from "node:fs/promises";
import axios from "axios";
import esMain from "es-main";
import pThrottle from "p-throttle";
import { config } from "../../dist/config.js";

const {
  domain: from,
  username,
  password,
  newDomain: to,
  newUsername: toUsername,
  newPassword: toPassword,
  api_limit: API_LIMIT,
} = config.get("zendesk");
const throttle = pThrottle({
  limit: API_LIMIT,
  interval: 60 * 1000, // 1 minute
  strict: true,
});
const throttled = throttle(axios);
const mappingsFilePath = "./scripts/migrationMappings.json";

const ASSIGNEE_FIELD = 21_334_256_018_061;
const QLEVER_USER = 22_123_868_209_293;
const DEFAULT_ASSIGNEE = 22_123_672_268_045;
const ORG_FIELD = 21_727_554_026_381;
const DEFAULT_ORG = 23_331_110_657_933;
const DEFAULT_GROUP = 21_728_652_739_085;
let counter = 0;
setInterval(() => counter++, 3000);

let allMaps = JSON.parse(
  await fs.readFile(mappingsFilePath, { encoding: "utf8" }),
);
allMaps[21] = {
  type: "tickets",
  data: {
    url: "https://smithfield-fsqa.zendesk.com/api/v2/tickets/44.json",
    id: 44,
    external_id: null,
    via: {
      channel: "web",
      source: {
        from: {},
        to: {},
        rel: null,
      },
    },
    created_at: "2022-11-29T18:41:20Z",
    updated_at: "2022-12-12T18:58:18Z",
    type: null,
    subject: "COI Request",
    raw_subject: "COI Request",
    description:
      "Hi,\nCan you send me your current COI?\n\nThanks,\nSam\n\n\n\n\n\nThis communication and any accompanying documents is confidential and is intended to be privileged pursuant to applicable law. If you are not the intended recipient, or the employee or agent responsible for delivering it to the intended recipient, then you are hereby notified that the dissemination, distribution or copying of this communication is prohibited. If you received this communication in error, please notify Centricity, LLC immediately by telephone (+1 888-778-9994) and then delete this communication and destroy all copies. Thank you.",
    priority: null,
    status: "solved",
    recipient: "support@centricity.zendesk.com",
    requester_id: 23_332_445_790_093,
    submitter_id: 22_123_868_209_293,
    assignee_id: 22_123_672_268_045,
    organization_id: 23_331_081_088_269,
    group_id: 21_728_652_739_085,
    collaborator_ids: [],
    follower_ids: [],
    email_cc_ids: [],
    forum_topic_id: null,
    problem_id: null,
    has_incidents: false,
    is_public: true,
    due_at: null,
    tags: [],
    custom_fields: [
      {
        id: 21_334_393_856_269,
        value: null,
      },
      {
        id: 21_727_779_166_861,
        value: null,
      },
      {
        id: 21_727_625_521_805,
        value: null,
      },
      {
        id: 21_727_554_026_381,
        value: "23331110657933",
      },
      {
        id: 21_727_674_687_629,
        value: null,
      },
      {
        id: 21_334_407_636_109,
        value: null,
      },
      {
        id: 21_727_648_479_885,
        value: null,
      },
    ],
    satisfaction_rating: null,
    sharing_agreement_ids: [],
    custom_status_id: 21_334_256_240_781,
    fields: [
      {
        id: 21_334_393_856_269,
        value: null,
      },
      {
        id: 21_727_779_166_861,
        value: null,
      },
      {
        id: 21_727_625_521_805,
        value: null,
      },
      {
        id: 21_727_554_026_381,
        value: "23331110657933",
      },
      {
        id: 21_727_674_687_629,
        value: null,
      },
      {
        id: 21_334_407_636_109,
        value: null,
      },
      {
        id: 21_727_648_479_885,
        value: null,
      },
    ],
    followup_ids: [],
    ticket_form_id: 21_727_840_365_197,
    brand_id: 21_334_264_746_381,
    allow_channelback: false,
    allow_attachments: true,
    from_messaging_channel: false,
  },
};
allMaps["71d4ba1d-abda-11ed-8999-0154f27c2bdb"] = {
  type: "side_conversations",
  data: {
    side_conversation: {
      url: "https://smithfield-fsqa.zendesk.com/api/v2/tickets/44/side_conversations/71d4ba1d-abda-11ed-8999-0154f27c2bdb",
      id: "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
      ticket_id: 44,
      subject: "Formula",
      preview_text:
        "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401",
      state: "closed",
      participants: [
        {
          user_id: 22_123_546_059_277,
          name: "Christopher Pantaleo",
          email: "cpantaleo@smithfield.com",
        },
        {
          user_id: 22_123_672_268_045,
          name: "Lisa Strong",
          email: "lstrong@smithfield.com",
        },
      ],
      created_at: "2023-02-13T20:10:21.934Z",
      updated_at: "2023-02-13T20:20:21.000Z",
      message_added_at: "2023-02-13T20:20:21.000Z",
      state_updated_at: "2023-02-13T20:10:21.934Z",
      external_ids: {},
    },
    events: [
      {
        id: "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        side_conversation_id: "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        actor: {
          user_id: 22_123_672_268_045,
          name: "Lisa Strong",
          email: "lstrong@smithfield.com",
        },
        type: "create",
        via: "api",
        created_at: "2023-02-13T20:10:21.934Z",
        message: {
          subject: "Formula",
          preview_text:
            "Can you please tell me if these products contain Rosemary? Thanks!",
          from: {
            user_id: 22_123_672_268_045,
            name: "Lisa Strong",
            email: "lstrong@smithfield.com",
          },
          to: [
            {
              user_id: 22_123_546_059_277,
              name: "Christopher Pantaleo",
              email: "cpantaleo@smithfield.com",
            },
          ],
          body: "Can you please tell me if these products contain Rosemary? Thanks!",
          html_body:
            '<div class="zd-comment">\n<div data-comment-type="body">\n<div>Can you please tell me if these products contain Rosemary? </div>\n<div>Thanks!</div>\n</div>\n</div>',
          external_ids: {},
          attachments: [],
        },
        updates: {},
        ticket_id: 44,
      },
      {
        id: "d6e6f1be-abdb-11ed-a30e-d9b1500f3f34",
        side_conversation_id: "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        actor: {
          user_id: 22_123_546_059_277,
          name: "Christopher Pantaleo",
          email: "cpantaleo@smithfield.com",
        },
        type: "reply",
        via: "api",
        created_at: "2023-02-13T20:20:21.000Z",
        message: {
          subject: null,
          preview_text:
            "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401",
          from: {
            user_id: 22_123_546_059_277,
            name: "Christopher Pantaleo",
            email: "cpantaleo@smithfield.com",
          },
          to: [
            {
              user_id: 22_123_672_268_045,
              name: "Lisa Strong",
              email: "lstrong@smithfield.com",
            },
            {
              user_id: 22_123_546_059_277,
              name: "Christopher Pantaleo",
              email: "cpantaleo@smithfield.com",
            },
          ],
          body: "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401 North Church Street Smithfield, VA 23430 smithfieldfoods.com",
          html_body: /* html */ `<div class="zd-comment">
<div class="zd-comment" dir="auto">
<div style="page: WordSection1">
<p dir="auto" style=" font-size: 11.0pt; margin: 0in">Hi Lisa,</p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in"> </p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in">I just looked up the ingredients for each product code and neither contain Rosemary.</p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in"> </p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in">Thanks!</p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in">Chris</p>
<p dir="auto" style=" font-size: 11.0pt; margin: 0in"> </p>

<p dir="auto"> </p>
<table border="0" cellpadding="1" cellspacing="1" style="border: medium; border-collapse: collapse; border-image: none; border-spacing: 0px; color: rgb(107, 107, 107);  font-size: 9pt; font-weight: 600; page-break-inside: avoid; width: 620px">
<tbody>
<tr>
<td style="border-right-color: #CB5B0F; border-right-style: solid; border-right-width: 2px; padding: 0 12px; text-align: left; vertical-align: middle" align="left">
<img src="https://smithfield-docs.trellis.one/attachments/token/3tT77ewJ3rR5m9Uml8anvCkQX/?name=unnamed_attachment_1.png" /></td>
<td style="padding: 0px 12px; vertical-align: top; width: 434px"><span><span style="font-size: 10pt"><span style="color: rgb(203, 91, 15); line-height: 1">Christopher Pantaleo</span></span></span><br />
<span>FSQA Customer &amp; Supplier Compliance Manager</span><br />
<span><span style="white-space: nowrap"><b><span style="color: #CB5B0F;  font-size: 9pt">p:
</span></b></span><a style="color: #6B6B6B;  font-size: 9pt;  text-decoration: none" href="tel:+1%20(757)%20365-3529" rel="noreferrer">(757) 365-3529</a><span style="color: #000000;  font-size: 9pt"></span>
<b><span style="color: #CB5B0F;  font-size: 9pt">c: </span></b></span><a style="color: #6B6B6B;  font-size: 9pt;  text-decoration: none" href="tel:+1%20(757)%20810-1794" rel="noreferrer">(757) 810-1794</a><span style="color: #000000;  font-size: 9pt"></span>
<div style="display: block; margin: 0; padding: 0"><span style="color: #CB5B0F">e: <a href="mailto:cpantaleo@smithfield.com" style="color: #6B6B6B;  text-decoration: none" rel="noreferrer">
cpantaleo@smithfield.com</a></span></div>
<div style="display: block; margin: 5px 0 0; padding: 0">401 North Church Street<br />
Smithfield, VA 23430</div>
<div style="display: block; margin: 5px 0 0; padding: 0"><a href="http://www.smithfieldfoods.com" style="color: #CB5B0F;  text-decoration: none" rel="noreferrer">smithfieldfoods.com</a></div>
</td>
</tr>
</tbody>
</table>
<p dir="auto"> </p>
<div>

</div>

</div>
</div>
</div>`,
          external_ids: {},
          attachments: [],
        },
        updates: {},
        ticket_id: 44,
      },
    ],
    next_page: null,
    previous_page: null,
    count: 2,
  },
};
async function getMappings(type, from, to, comparatorKey) {
  const map = {};
  for (const a of from) {
    const b = to.find((index) => a[comparatorKey] === index[comparatorKey]);
    if (b)
      map[a.id] = {
        type,
        data: b,
      };
  }

  await storeMappings(map);
}

async function createThings(type, input) {
  for await (const value of input) {
    // Const val = input[0];
    const { id } = value;
    if (allMaps[id]) continue;
    /* Use this when just running one thing
    if (allMaps[id]) {
      console.log(`Finished ${type}`);
      return;
    }
    */
    // Prep the object
    value.id = undefined;
    value.url = undefined;
    const typeKey = type.replace(/s$/, "");
    try {
      const response = await throttled({
        method: "post",
        url: `${to}/api/v2/${type}`,
        data: { [typeKey]: value },
        auth: {
          username: toUsername,
          password: toPassword,
        },
      });
      allMaps[id] = {
        type,
        data: response.data[typeKey],
      };
    } catch (error) {
      console.log(error);
    }
  }

  await storeMappings(allMaps);
  console.log(`Finished ${type}`);
}

export async function getThings(type) {
  const fromThings = [];
  const toThings = [];
  try {
    let r = await throttled({
      method: "get",
      url: `${from}/api/v2/${type}`,
      auth: {
        username,
        password,
      },
    });

    fromThings.push(...r.data[type]);

    while (r.data.next_page) {
      // eslint-disable-next-line no-await-in-loop
      r = await throttled({
        method: "get",
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
      });
      fromThings.push(...r.data[type]);
    }

    // Now get them from the destination
    r = await throttled({
      method: "get",
      url: `${to}/api/v2/${type}`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
    });

    toThings.push(...r.data[type]);

    while (r.data.next_page) {
      // eslint-disable-next-line no-await-in-loop
      r = await throttled({
        method: "get",
        url: r.data.next_page,
        default_group_id: undefined,
        // Custom_role_id:,
        auth: {
          username: toUsername,
          password: toPassword,
        },
      });
      toThings.push(...r.data[type]);
    }
  } catch (error) {
    // Something 404?? keep going
    console.log(error);
  }

  return [fromThings, toThings];
}

export async function main() {
  // 0. Groups
  const [groupsFrom, groupsTo] = await getThings("groups");
  await getMappings("groups", groupsFrom, groupsTo, "name");
  await createThings("groups", groupsFrom);

  /*
  //1. Organization fields
  const [orgFieldsFrom, orgFieldsTo] = await getThings('organization_fields');
  getMappings('organization_fields', orgFieldsFrom, orgFieldsTo, 'key');
  //1a. Copy orgs to the new environment and save org field mappings
  await createThings('organization_fields', orgFieldsFrom);


  //2. Organizations
  let [orgsFrom, orgsTo] = await getThings('organizations');
  getMappings('organizations', orgsFrom, orgsTo, 'name');
  //2a. Copy orgs to new environment and store org mappings
  await createThings('organizations', orgsFrom);

  //3. Users
  //FIXME: photos
  let [usersFrom, usersTo] = await getThings('users');
  usersFrom = usersFrom
    .filter(u => !(u.role !== 'end-user'))
    .map((u) => {
      delete u.custom_role_id;
      return {
        ...u,
        skip_verify_email: true,
        ...mapObjectContent(u, {
          organization_id: undefined,
          default_group_id: undefined,
          //custom_role_id:
        }),
      }
    });
  getMappings('users', usersFrom, usersTo, 'name');
  //3a. Copy users to the new environment and store user mappings
  await createThings('users', usersFrom);

  //4. Ticket fields
  */
  const [ticketFieldsFrom, ticketFieldsTo] = await getThings("ticket_fields");
  /*
  //4a. Copy ticket fields to the new environment
  getMappings('ticket_fields', ticketFieldsFrom, ticketFieldsTo, 'title');
  await createThings('ticket_fields', ticketFieldsFrom);

  //4.5. Ticket forms
  let [ticketFormsFrom, ticketFormsTo] = await getThings('ticket_forms');
  ticketFormsFrom = ticketFormsFrom.filter(tf => tf.name !== 'Centricity Support Request');
  //4.5a. Copy ticket forms to the new environment
  getMappings('ticket_forms', ticketFormsFrom, ticketFormsTo, 'name');
  await createThings('ticket_forms', ticketFormsFrom);


  //5. Ticket statuses
  let [ticketStatusesFrom, ticketStatusesTo] = await getThings('custom_statuses');
  //5a. Copy ticket statuses to the new environment
  getMappings('custom_statuses', ticketFieldsFrom, ticketFieldsTo, 'agent_label');
  await createThings('custom_statuses', ticketFieldsFrom);
*/

  // 6. Tickets
  // let [allTicketsFrom, ticketsTo] = await getThings('tickets');
  // let [_, ticketsTo] = await getThings('tickets');
  /*
  let allTicketsFrom = await getTickets();
  let ticketsFrom = allTicketsFrom.filter(
    (t) => t.status !== 'pending' && t.status !== 'open' && t.status !== 'new' && t.status !== 'hold'
  ).filter(
    (t) => !(t.via && t.via.channel === 'side_conversation')
  )
  for await (let t of ticketsFrom) {
    await handleTicket(t);
  };
  */

  // Go one at a time;
  // for await (let id of [21]) {
  const MAX_TICKET_ID = 6110;
  for await (const id of Array.from({ length: MAX_TICKET_ID }).keys()) {
    if (id < allMaps.startTicket) continue;
    allMaps.startTicket = id;
    await storeMappings({ startTicket: id });
    console.log(
      `starting id ${id} (${Math.round((100 * id) / MAX_TICKET_ID)}%)`,
    );
    const t = await getTicket(id);
    if (!t) {
      console.log(`ticket ${id} no longer exists`);
      continue;
    }

    if (t.group_id === 10_518_621_514_381) {
      console.log(`ticket ${id} belongs to centricity support group`);
      continue;
    }

    if (
      t.status === "pending" ||
      t.status === "open" ||
      t.status === "new" ||
      t.status === "hold"
    ) {
      // If (t.status !== 'pending' && t.status !== 'open' && t.status !== 'new' && t.status !== 'hold') {
      if (t.via && t.via.channel === "side_conversation") {
        console.log(`ticket ${id} was side conversation`);
      } else {
        await handleTicket(t);
      }
    } else {
      console.log(`ticket ${id} was not closed status`);
    }
  }
}

async function handleTicket(ticket) {
  const { id } = ticket;
  const mapT = await mapTicket(ticket);
  await importTicket(mapT, id);
  const newId = getMap(id).id;
  await handleSideConversations(id, newId);
}

async function mapTicket(t) {
  const { id } = t;
  // Remove read-only keys we can't use in import
  t.attachments = undefined;
  t.audit_id = undefined;
  t.brand_id = undefined;
  t.id = undefined;
  t.url = undefined;
  //  Let assignee_id = t.assignee_id;

  t = {
    ...mapObjectContent(t, {
      assignee_id: undefined,
      // Attribute_value_ids: ?? no old tickets seem to have these
      // brand_id //brandsMap
      collaborator_ids: undefined,
      custom_fields: (f) => handleFields(f, allMaps),
      custom_status_id: undefined,
      email_cc_ids: undefined,
      fields: (f) => handleFields(f, allMaps),
      follower_ids: undefined,
      followup_ids: undefined, // E.g.
      // forum_topic_id: ??
      group_id: undefined,
      // Macro_id: ??
      // macro_ids: ??
      organization_id: undefined,
      // Problem_id: ?? something about problem id linked to incident
      requester_id: undefined,
      // Sharing_agreement_ids: ?? we don't seem to have any with length > 0
      submitter_id: undefined,
      ticket_form_id: undefined,
    }),
    // Status: 'solved',
    // Add a marker to remember it was imported
    tags: t.tags.push(`imported-ticket-${id}`),
    // Handle comments and attachments
    comments: await handleComments(id),
    via: mapVia(t.via),
    group_id: DEFAULT_GROUP,
  };

  // Fix invalid assignees
  const invalids = [22_123_868_209_293];
  if (invalids.includes(t.assignee_id)) {
    t.assignee_id = QLEVER_USER;
  }

  // The field can have a null value so just first add to list, then handle its value.
  let assign = t.fields.find((f) => f.id === ASSIGNEE_FIELD);
  if (!assign) {
    assign = {
      id: ASSIGNEE_FIELD,
      value: null,
    };
    t.fields.push(assign);
  }

  if (assign.value === null) {
    const newAssign = t.assignee_id || DEFAULT_ASSIGNEE;
    const correspondingGroup = getMap(newAssign).default_group_id;
    t.group_id = correspondingGroup || t.group_id;

    if (!t.assignee_id) {
      console.log("Using default assign id on ticket");
    }

    t.fields = t.fields.map(({ id, value }) => {
      if (id === ASSIGNEE_FIELD) return { id, value: newAssign };
      return { id, value };
    });
  }

  // The field can have a null value so just first add to list, then handle its value.
  let org = t.custom_fields.find((cf) => cf.id === ORG_FIELD);
  if (!org) {
    org = {
      id: ORG_FIELD,
      value: null,
    };
    t.custom_fields.push(org);
  }

  if (org.value === null) {
    const newOrg = t.organization_id || DEFAULT_ORG;
    if (!t.organization_id) {
      console.log("Using default org id on ticket");
    }

    t.custom_fields = t.custom_fields.map(({ id, value }) => {
      if (id === ORG_FIELD) return { id, value: newOrg };
      return { id, value };
    });
  }

  return t;
}

async function getTicket(id) {
  try {
    const r = await throttled({
      method: "get",
      url: `${from}/api/v2/tickets/${id}`,
      auth: {
        username,
        password,
      },
    });
    return r.data.ticket;
  } catch {}
}

export async function getTickets() {
  const tickets = [];
  for await (const id of Array.from({ length: 3335 }).keys()) {
    const t = await getTicket(id);
    if (t) tickets.push(t);
  }

  return tickets;
}

async function importTicket(ticket, id) {
  if (allMaps[id]) return;
  let response;
  try {
    response = await throttled({
      method: "post",
      url: `${to}/api/v2/imports/tickets`,
      data: { ticket },
      auth: {
        username: toUsername,
        password: toPassword,
      },
    });
    allMaps[id] = {
      type: "tickets",
      data: response.data.ticket,
    };
    console.log(`finished importing ticket ${id}`);
  } catch (error) {
    console.log(error);
  }
}

async function importSideConversation(
  id,
  newTicketId,
  side_conversation,
  events,
) {
  if (allMaps[id]) return;
  try {
    const response = await throttled({
      method: "post",
      url: `${to}/api/v2/tickets/${newTicketId}/side_conversations/import`,
      data: { side_conversation, events },
      auth: {
        username: toUsername,
        password: toPassword,
      },
    });
    allMaps[id] = {
      type: "side_conversations",
      data: response.data,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function handleSideConvAttach(att) {
  if (allMaps[att.id]) return;
  // Fetch the binary
  let r;
  let p;
  let form;
  try {
    r = await throttled({
      method: "get",
      url: att.content_url,
      auth: {
        username,
        password,
      },
      responseType: "arraybuffer",
    });
  } catch (error) {
    // File missing? not much we can do here
    console.log(error);
  }

  try {
    form = new FormData();
    form.append("file", Buffer.from(r.data), {
      filename: att.file_name,
      content_type: att.content_type,
      knownLength: att.size,
    });
    // Form.append('file', new Blob([Buffer.from(r.data)]));
    p = await throttled({
      method: "post",
      url: `${to}/api/v2/tickets/side_conversations/attachments`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      headers: {
        "Content-Type": "multipart/form-data",
      },
      data: form,
    });
    allMaps[att.id] = {
      type: "side-conv-attachments",
      data: p.data,
    };
    return p.data;
  } catch (error) {
    // Failed to post; fix this;
    console.log(error);
    throw error;
  }
}

async function handleAttachment(att) {
  if (allMaps[att.id]) return;
  // Fetch the binary
  let r;
  let p;
  let data;
  try {
    r = await throttled({
      method: "get",
      url: att.content_url,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      responseType: "arraybuffer",
    });
  } catch (error) {
    // Failed to get, can't fix this
    console.log(error);
  }

  // Upload the binary
  try {
    p = await throttled({
      method: "post",
      url: `${to}/api/v2/uploads`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      headers: {
        "Content-Type": att.content_type,
      },
      params: {
        filename: att.file_name,
      },
      data: Buffer.from(r.data),
    });
    data = {
      ...p.data.upload.attachment,
      token: p.data.upload.token,
    };
    allMaps[att.id] = {
      type: "attachments",
      data,
    };
    return data;
  } catch (error) {
    // Failed to upload, fix this
    console.log(error);
    throw error;
  }
}

async function handleComments(ticketId) {
  let { attachments, comments } = await getComments(ticketId);
  const comms = [];
  // Ensure all of the attachments exist
  for await (const att of attachments) {
    await handleAttachment(att);
    const newAttach = getMap(att.id);
    if (newAttach) {
      comments = comments.map((c) => ({
        ...c,
        html_body: c.html_body
          .replace(att.content_url, newAttach.content_url)
          .replace(att.token, newAttach.token),
        // .replace("smithfield-docs", "smithfield-fsqa")
      }));
      if (att.mapped_content_url) {
        comments = comments.map((c) => ({
          ...c,
          html_body: c.html_body.replace(
            att.mapped_content_url,
            newAttach.content_url,
          ),
        }));
      }
    }
  }

  for (let c of comments) {
    // Gather up the attachment JSONs; They should now all be in allMaps
    c.uploads = c.attachments.map((att) => getMap(att.id).token);

    // Delete the read-only keys (some can be used in the Ticket Import endpoint)
    c.attachments = undefined;
    c.audit_id = undefined;
    c.body = undefined;
    c.id = undefined;
    c.plain_body = undefined;
    c.url = undefined;

    c = {
      ...mapObjectContent(c, {
        author_id: DEFAULT_ASSIGNEE,
      }),
      via: mapVia(c.via),
    };

    // Handle empty comment bodies
    comms.push(c);
  }

  return comms;
}

async function getComments(ticketId) {
  let r;
  const comments = [];
  const attachments = [];
  try {
    // Grab all the attachments including in-liners
    r = await throttled({
      method: "get",
      url: `${from}/api/v2/tickets/${ticketId}/comments`,
      auth: {
        username,
        password,
      },
      params: {
        // Include inline images (and other files?) in the array of attachments
        include_inline_images: true,
      },
    });
    for (const c of r.data.comments) {
      attachments.push(...c.attachments);
    }
  } catch (error) {
    console.log(error);
  }

  try {
    // Now grab a version of comments with in-line attachments left as-is
    r = await throttled({
      method: "get",
      url: `${from}/api/v2/tickets/${ticketId}/comments`,
      auth: {
        username,
        password,
      },
    });

    comments.push(...r.data.comments);
  } catch (error) {
    // Can't fix this; keep going
    console.log(error);
  }

  while (r.data.next_page) {
    try {
      // Grab all the attachments including in-liners
      // eslint-disable-next-line no-await-in-loop
      r = await throttled({
        method: "get",
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
        params: {
          // Include inline images (and other files?) in the array of attachments
          include_inline_images: true,
        },
      });
      for (const c of r.data.comments) {
        attachments.push(c);
      }

      // Now grab a version of comments with in-line attachments left as-is
      // eslint-disable-next-line no-await-in-loop
      r = await throttled({
        method: "get",
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
      });

      comments.push(...r.data.comments);
    } catch (error) {
      console.log(error);
    }
  }

  return { comments, attachments };
}

async function handleSideConversations(oldTicketId, newTicketId) {
  const { events, sideConversations } = await getSideConversations(oldTicketId);
  for await (let sideConversation of sideConversations) {
    const scId = sideConversation.id;
    sideConversation = await mapSideConversation(sideConversation, oldTicketId);

    const evts = await Promise.all(
      events
        // Find using the original id; no need to map to new id, we create sideConversation and events
        // simultaneously and ids get associated then
        .filter((e) => e.side_conversation_id === scId)
        .filter((e) => e.message)
        .map(async (e) => await mapEvent(e, newTicketId, scId)),
    );

    await importSideConversation(scId, newTicketId, sideConversation, evts);
  }

  return sideConversations;
}

async function mapSideConversation(sideConversation, ticketId) {
  // Remove read-only keys (only those we cannot keep)
  sideConversation.id = undefined;
  sideConversation.url = undefined;

  // Map/Prep the side conversation; if its a ticket, sub things out like a ticket?
  sideConversation = {
    ...mapObjectContent(sideConversation, {
      participants: undefined,
    }),
    ticket_id: allMaps[ticketId].data.id, // Uses the ticketId so cannot be used in mapObjectContent
  };

  // Side conversation is a ticket
  if (sideConversation.external_ids.targetTicketId) {
    console.log(
      `Recursing from ticket ${ticketId} to a side ticket ${sideConversation.external_ids.targetTicketId}`,
    );
    const ticket = await getTicket(
      sideConversation.external_ids.targetTicketId,
    );
    if (ticket) {
      await handleTicket(ticket);
      sideConversation.external_ids.targetTicketId = getMap(ticket.id).id;
    }
  }

  return sideConversation;
}

async function mapEvent(event, newTicketId, scid) {
  event.id = undefined;
  event.side_conversation_id = undefined;
  event.url = undefined;
  event = {
    ...event,
    actor: mapParticipant(event.actor),
    message: await mapMessage(event.message, scid),
    // Updates: e.updates.map(mapUpdate),
    ticket_id: newTicketId,
    // Via: mapVia(evt.via)
  };

  return event;
}

async function mapMessage(message) {
  if (!message) return;

  message.attachment_ids = [];
  for await (const att of message.attachments) {
    // Ensure it exists
    await handleSideConvAttach(att);
    const newAttach = getMap(att.id);
    if (newAttach) {
      message.html_body = message.html_body
        .replace(att.content_url, newAttach.content_url)
        .replace(att.id, newAttach.id);
      // .replace("smithfield-docs", "smithfield-fsqa")

      if (att.mapped_content_url)
        message.html_body = message.html_body.replace(
          att.content_url,
          newAttach.content_url,
        );

      if (!message.html_body.includes(newAttach.id))
        message.attachment_ids.push(newAttach.id);
    }
  }

  message.attachments = undefined;

  return {
    ...message,
    from: mapParticipant(message.from),
    to: message.to.map((element) => mapParticipant(element)),
    // External_ids: ??
  };
}

// TODO: According to docs, participants can be Support tickets???
function mapParticipant(part) {
  return {
    ...mapObjectContent(part, {
      user_id: undefined,
      // Slack_workspace_id:
      // slack_channel_id:
      // support_group_id
      // support_agent_id:
      // msteams_channel_id:
    }),
  };
}

function mapVia(via) {
  if (via.source.to?.id) {
    via.source.to.id = getMap(via.source.to.id).id || via.source.to.id;
  }

  if (via.source.to?.email_ccs) {
    via.source.to.email_ccs = via.source.to.email_ccs
      .map((e) => getMap(e).id)
      .filter(Boolean);
  }

  if (via.source.from?.id) {
    via.source.from.id &&= getMap(via.source.from.id).id || via.source.from.id;

    via.source.from.ticket_id &&=
      getMap(via.source.from.ticket_id).id || via.source.from.ticket_id;

    via.source.from.suspended_ticket_id &&=
      getMap(via.source.from.suspended_ticket_id).id ||
      via.source.from.suspended_ticket_id;
  }

  return via;
}

async function getSideConversations(ticketId) {
  const sideConversations = [];
  const events = [];
  let r;
  try {
    r = await throttled({
      method: "get",
      url: `${from}/api/v2/tickets/${ticketId}/side_conversations`,
      auth: {
        username,
        password,
      },
      params: {
        include: "events",
      },
    });

    sideConversations.push(...r.data.side_conversations);
    events.push(...r.data.events);

    while (r.data.next_page) {
      // eslint-disable-next-line no-await-in-loop
      r = await throttled({
        method: "get",
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
        params: {
          include: "events",
        },
      });
      sideConversations.push(...r.data.side_conversations);
      events.push(...r.data.events);
    }
  } catch (error) {
    // Something 404? keep going
    console.log(error);
  }

  return { events, sideConversations };
}

function handleFields(fields) {
  return fields.map(({ id, value }) => ({
    id: getMap(id).id,
    // If the value is an id in our map (i.e., its a Lookup type field), replace it, else use the value
    value: getMap(value).id || value,
  }));
}

// Content is an object of key-mapping function objects. if no mapping function is
// supplied, the value should either be a single id or or array of ids that can be
// mapped from allMaps.
function mapObjectContent(object, content) {
  return {
    ...object,
    ...Object.fromEntries(
      Object.entries(content).map(([key, mappingFunctionOrDefault]) => [
        key,
        mapValue(object[key], mappingFunctionOrDefault),
      ]),
    ),
  };
}

function mapValue(value, mappingFunctionOrDefault) {
  if (typeof mappingFunctionOrDefault === "function") {
    return mappingFunctionOrDefault(value);
  }

  // An array of IDs that need to be mapped
  if (Array.isArray(value)) {
    return value.map((index) => getMap(index).id).filter(Boolean);
  }

  // An ID that needs to be mapped, else the id
  return getMap(value).id || mappingFunctionOrDefault || value;
}

// Some resources like attachments are harder to match up after the fact, so
// just store the mapping immediately
async function storeMappings(mapObject) {
  allMaps = {
    ...allMaps,
    ...mapObject,
  };
  await fs.writeFile(mappingsFilePath, JSON.stringify(allMaps), {
    encoding: "utf8",
  });
}

function getMap(id) {
  return allMaps[id]?.data || {};
}

async function fixMigratedInlineImages() {
  const ticket = await getTicket(4370);
  const tick = await mapTicket(ticket);
  console.log(JSON.stringify(tick, null, 2));
}

if (esMain(import.meta)) {
  // Await main();
  await fixMigratedInlineImages();

  console.log("DONE");
  process.exit();
}
