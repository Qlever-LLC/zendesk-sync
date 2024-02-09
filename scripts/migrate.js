import axios from 'axios';
import esMain from 'es-main';
import { Readable } from 'stream';
import { Blob } from 'buffer';
import FormData from 'form-data';
import fs from 'node:fs';
import { config } from '../dist/config.js';
const {
  domain: from,
  username,
  password,
  newDomain: to,
  newUsername: toUsername,
  newPassword: toPassword,
  api_limit: API_LIMIT,
} = config.get('zendesk');

import pThrottle from 'p-throttle';
const throttle = pThrottle({
  limit: API_LIMIT,
  interval: 60 * 1000, // 1 minute
  strict: true,
});
let throttled = throttle(axios);
const mappingsFilePath = './scripts/migrationMappings.json';

const ASSIGNEE_FIELD = 21334256018061;
const QLEVER_USER = 22123868209293;
const DEFAULT_ASSIGNEE = 22123672268045;
const ORG_FIELD = 21727554026381;
const DEFAULT_ORG = 23331110657933;
const DEFAULT_GROUP = 21728652739085;
let counter = 0;
setInterval(() => counter++, 3000)

let allMaps = JSON.parse(fs.readFileSync(mappingsFilePath, {encoding: 'utf8'}));
allMaps[21] = {
  type: 'tickets',
  data: {
    "url": "https://smithfield-fsqa.zendesk.com/api/v2/tickets/44.json",
    "id": 44,
    "external_id": null,
    "via": {
      "channel": "web",
      "source": {
        "from": {},
        "to": {},
        "rel": null
      }
    },
    "created_at": "2022-11-29T18:41:20Z",
    "updated_at": "2022-12-12T18:58:18Z",
    "type": null,
    "subject": "COI Request",
    "raw_subject": "COI Request",
    "description": "Hi,\nCan you send me your current COI?\n\nThanks,\nSam\n\n\n\n\n\nThis communication and any accompanying documents is confidential and is intended to be privileged pursuant to applicable law. If you are not the intended recipient, or the employee or agent responsible for delivering it to the intended recipient, then you are hereby notified that the dissemination, distribution or copying of this communication is prohibited. If you received this communication in error, please notify Centricity, LLC immediately by telephone (+1 888-778-9994) and then delete this communication and destroy all copies. Thank you.",
    "priority": null,
    "status": "solved",
    "recipient": "support@centricity.zendesk.com",
    "requester_id": 23332445790093,
    "submitter_id": 22123868209293,
    "assignee_id": 22123672268045,
    "organization_id": 23331081088269,
    "group_id": 21728652739085,
    "collaborator_ids": [],
    "follower_ids": [],
    "email_cc_ids": [],
    "forum_topic_id": null,
    "problem_id": null,
    "has_incidents": false,
    "is_public": true,
    "due_at": null,
    "tags": [],
    "custom_fields": [
      {
        "id": 21334393856269,
        "value": null
      },
      {
        "id": 21727779166861,
        "value": null
      },
      {
        "id": 21727625521805,
        "value": null
      },
      {
        "id": 21727554026381,
        "value": "23331110657933"
      },
      {
        "id": 21727674687629,
        "value": null
      },
      {
        "id": 21334407636109,
        "value": null
      },
      {
        "id": 21727648479885,
        "value": null
      }
    ],
    "satisfaction_rating": null,
    "sharing_agreement_ids": [],
    "custom_status_id": 21334256240781,
    "fields": [
      {
        "id": 21334393856269,
        "value": null
      },
      {
        "id": 21727779166861,
        "value": null
      },
      {
        "id": 21727625521805,
        "value": null
      },
      {
        "id": 21727554026381,
        "value": "23331110657933"
      },
      {
        "id": 21727674687629,
        "value": null
      },
      {
        "id": 21334407636109,
        "value": null
      },
      {
        "id": 21727648479885,
        "value": null
      }
    ],
    "followup_ids": [],
    "ticket_form_id": 21727840365197,
    "brand_id": 21334264746381,
    "allow_channelback": false,
    "allow_attachments": true,
    "from_messaging_channel": false
  }
}
allMaps['71d4ba1d-abda-11ed-8999-0154f27c2bdb'] = {
  type: 'side_conversations',
  data: {
    "side_conversation": {
      "url": "https://smithfield-fsqa.zendesk.com/api/v2/tickets/44/side_conversations/71d4ba1d-abda-11ed-8999-0154f27c2bdb",
      "id": "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
      "ticket_id": 44,
      "subject": "Formula",
      "preview_text": "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401",
      "state": "closed",
      "participants": [
        {
          "user_id": 22123546059277,
          "name": "Christopher Pantaleo",
          "email": "cpantaleo@smithfield.com"
        },
        {
          "user_id": 22123672268045,
          "name": "Lisa Strong",
          "email": "lstrong@smithfield.com"
        }
      ],
      "created_at": "2023-02-13T20:10:21.934Z",
      "updated_at": "2023-02-13T20:20:21.000Z",
      "message_added_at": "2023-02-13T20:20:21.000Z",
      "state_updated_at": "2023-02-13T20:10:21.934Z",
      "external_ids": {}
    },
    "events": [
      {
        "id": "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        "side_conversation_id": "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        "actor": {
          "user_id": 22123672268045,
          "name": "Lisa Strong",
          "email": "lstrong@smithfield.com"
        },
        "type": "create",
        "via": "api",
        "created_at": "2023-02-13T20:10:21.934Z",
        "message": {
          "subject": "Formula",
          "preview_text": "Can you please tell me if these products contain Rosemary? Thanks!",
          "from": {
            "user_id": 22123672268045,
            "name": "Lisa Strong",
            "email": "lstrong@smithfield.com"
          },
          "to": [
            {
              "user_id": 22123546059277,
              "name": "Christopher Pantaleo",
              "email": "cpantaleo@smithfield.com"
            }
          ],
          "body": "Can you please tell me if these products contain Rosemary? Thanks!",
          "html_body": "<div class=\"zd-comment\">\n<div data-comment-type=\"body\">\n<div>Can you please tell me if these products contain Rosemary? </div>\n<div>Thanks!</div>\n</div>\n</div>",
          "external_ids": {},
          "attachments": []
        },
        "updates": {},
        "ticket_id": 44
      },
      {
        "id": "d6e6f1be-abdb-11ed-a30e-d9b1500f3f34",
        "side_conversation_id": "71d4ba1d-abda-11ed-8999-0154f27c2bdb",
        "actor": {
          "user_id": 22123546059277,
          "name": "Christopher Pantaleo",
          "email": "cpantaleo@smithfield.com"
        },
        "type": "reply",
        "via": "api",
        "created_at": "2023-02-13T20:20:21.000Z",
        "message": {
          "subject": null,
          "preview_text": "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401",
          "from": {
            "user_id": 22123546059277,
            "name": "Christopher Pantaleo",
            "email": "cpantaleo@smithfield.com"
          },
          "to": [
            {
              "user_id": 22123672268045,
              "name": "Lisa Strong",
              "email": "lstrong@smithfield.com"
            },
            {
              "user_id": 22123546059277,
              "name": "Christopher Pantaleo",
              "email": "cpantaleo@smithfield.com"
            }
          ],
          "body": "Hi Lisa, I just looked up the ingredients for each product code and neither contain Rosemary. Thanks! Chris [image ?name=unnamed_attachment_1.png] Christopher Pantaleo FSQA Customer & Supplier Compliance Manager p: (757) 365-3529 c: (757) 810-1794 e: cpantaleo@smithfield.com 401 North Church Street Smithfield, VA 23430 smithfieldfoods.com",
          "html_body": "<div class=\"zd-comment\">\n<div class=\"zd-comment\" dir=\"auto\">\n<div style=\"page: WordSection1\">\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\">Hi Lisa,</p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\"> </p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\">I just looked up the ingredients for each product code and neither contain Rosemary.</p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\"> </p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\">Thanks!</p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\">Chris</p>\n<p dir=\"auto\" style=\" font-size: 11.0pt; margin: 0in\"> </p>\n\n<p dir=\"auto\"> </p>\n<table border=\"0\" cellpadding=\"1\" cellspacing=\"1\" style=\"border: medium; border-collapse: collapse; border-image: none; border-spacing: 0px; color: rgb(107, 107, 107);  font-size: 9pt; font-weight: 600; page-break-inside: avoid; width: 620px\">\n<tbody>\n<tr>\n<td style=\"border-right-color: #CB5B0F; border-right-style: solid; border-right-width: 2px; padding: 0 12px; text-align: left; vertical-align: middle\" align=\"left\">\n<img src=\"https://smithfield-docs.trellis.one/attachments/token/3tT77ewJ3rR5m9Uml8anvCkQX/?name=unnamed_attachment_1.png\" /></td>\n<td style=\"padding: 0px 12px; vertical-align: top; width: 434px\"><span><span style=\"font-size: 10pt\"><span style=\"color: rgb(203, 91, 15); line-height: 1\">Christopher Pantaleo</span></span></span><br />\n<span>FSQA Customer &amp; Supplier Compliance Manager</span><br />\n<span><span style=\"white-space: nowrap\"><b><span style=\"color: #CB5B0F;  font-size: 9pt\">p:\n</span></b></span><a style=\"color: #6B6B6B;  font-size: 9pt;  text-decoration: none\" href=\"tel:+1%20(757)%20365-3529\" rel=\"noreferrer\">(757) 365-3529</a><span style=\"color: #000000;  font-size: 9pt\"></span>\n<b><span style=\"color: #CB5B0F;  font-size: 9pt\">c: </span></b></span><a style=\"color: #6B6B6B;  font-size: 9pt;  text-decoration: none\" href=\"tel:+1%20(757)%20810-1794\" rel=\"noreferrer\">(757) 810-1794</a><span style=\"color: #000000;  font-size: 9pt\"></span>\n<div style=\"display: block; margin: 0; padding: 0\"><span style=\"color: #CB5B0F\">e: <a href=\"mailto:cpantaleo@smithfield.com\" style=\"color: #6B6B6B;  text-decoration: none\" rel=\"noreferrer\">\ncpantaleo@smithfield.com</a></span></div>\n<div style=\"display: block; margin: 5px 0 0; padding: 0\">401 North Church Street<br />\nSmithfield, VA 23430</div>\n<div style=\"display: block; margin: 5px 0 0; padding: 0\"><a href=\"http://www.smithfieldfoods.com\" style=\"color: #CB5B0F;  text-decoration: none\" rel=\"noreferrer\">smithfieldfoods.com</a></div>\n</td>\n</tr>\n</tbody>\n</table>\n<p dir=\"auto\"> </p>\n<div>\n\n</div>\n\n\n\n\n\n</div>\n</div>\n</div>",
          "external_ids": {},
          "attachments": []
        },
        "updates": {},
        "ticket_id": 44
      }
    ],
    "next_page": null,
    "previous_page": null,
    "count": 2
  }
}
function getMappings(type, from, to, comparatorKey) {
  let map = {};
  for (const a of from) {
    const b = to.find((i) => a[comparatorKey]=== i[comparatorKey]);
    if (b) map[a.id] = {
      type,
      data: b
    }
  }
  storeMappings(map);
  return;
}

async function createThings(type, input) {
  for await (const val of input) {
    //const val = input[0];
    const id = val.id;
    if (allMaps[id]) continue;
    /* Use this when just running one thing
    if (allMaps[id]) {
      console.log(`Finished ${type}`);
      return;
    }
    */
    // Prep the object
    delete val.id;
    delete val.url;
    const typeKey = type.replace(/s$/, '');
    try {
      let response = await throttled({
        method: 'post',
        url: `${to}/api/v2/${type}`,
        data: { [typeKey]: val },
        auth: {
          username: toUsername,
          password: toPassword,
        }
      })
      allMaps[id] = {
        type,
        data: response.data[typeKey],
      }
    } catch(err) {
      console.log(err);
    }
  };
  storeMappings(allMaps);
  console.log(`Finished ${type}`);
  return
}

export async function getThings(type) {
  let fromThings = [];
  let toThings = [];
  try {
    let r = await throttled({
      method: 'get',
      url: `${from}/api/v2/${type}`,
      auth: {
        username,
        password,
      },
    })

    fromThings.push(...r.data[type]);

    while (r.data.next_page) {
      r = await throttled({
        method: 'get',
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
      })
      fromThings.push(...r.data[type]);
    }

    // Now get them from the destination
    r = await throttled({
      method: 'get',
      url: `${to}/api/v2/${type}`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
    })

    toThings.push(...r.data[type]);

    while (r.data.next_page) {
      r = await throttled({
        method: 'get',
        url: r.data.next_page,
        default_group_id: undefined,
        //custom_role_id:,
        auth: {
          username: toUsername,
          password: toPassword,
        },
      })
      toThings.push(...r.data[type]);
    }
  } catch(err) {
    // something 404?? keep going
    console.log(err);
  }

  return [fromThings, toThings];
}

async function main() {

  //0. Groups
  const [groupsFrom, groupsTo] = await getThings('groups');
  getMappings('groups', groupsFrom, groupsTo, 'name');
  await createThings('groups', groupsFrom);

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
  let [ticketFieldsFrom, ticketFieldsTo] = await getThings('ticket_fields');
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

  //6. Tickets
  //let [allTicketsFrom, ticketsTo] = await getThings('tickets');
  //let [_, ticketsTo] = await getThings('tickets');
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
  //for await (let id of [21]) {
  let startTicket = allMaps['startTicket'];
  let MAX_TICKET_ID = 6110;
  for await (let id of [...Array(MAX_TICKET_ID).keys()]) {
    if (id < allMaps['startTicket']) continue;
    allMaps['startTicket'] = id;
    storeMappings({startTicket: id})
    console.log(`starting id ${id} (${Math.round(100*id/MAX_TICKET_ID)}%)`);
    let t = await getTicket(id);
    if (!t) {
      console.log(`ticket ${id} no longer exists`)
      continue;
    }
    if (t.group_id === 10518621514381) {
      console.log(`ticket ${id} belongs to centricity support group`)
      continue;
    }
    if (t.status === 'pending' || t.status === 'open' || t.status === 'new' || t.status === 'hold') {
    //if (t.status !== 'pending' && t.status !== 'open' && t.status !== 'new' && t.status !== 'hold') {
      if (!(t.via && t.via.channel === 'side_conversation')) {
        await handleTicket(t);
      } else console.log(`ticket ${id} was side conversation`)
    } else {
      console.log(`ticket ${id} was not clsoed status`)
      continue;
    }
  }
};

async function handleTicket(ticket) {
  const id = ticket.id;
  let mapT = await mapTicket(ticket);
  await importTicket(mapT, id);
  let newId = getMap(id).id;
  await handleSideConvos(id, newId);
}

async function mapTicket(t) {
  const id = t.id;
  // Remove read-only keys we can't use in import
  delete t.attachments;
  delete t.audit_id;
  delete t.brand_id;
  delete t.id;
  delete t.url;
//  let assignee_id = t.assignee_id;

  t = {
    ...mapObjectContent(t, {
      assignee_id: undefined,
      //attribute_value_ids: ?? no old tickets seem to have these
      //brand_id //brandsMap
      collaborator_ids: undefined,
      custom_fields: (f) => handleFields(f, allMaps),
      custom_status_id: undefined,
      email_cc_ids: undefined,
      fields: (f) => handleFields(f, allMaps),
      follower_ids: undefined,
      followup_ids: undefined, // e.g.
      //forum_topic_id: ??
      group_id: undefined,
      //macro_id: ??
      //macro_ids: ??
      organization_id: undefined,
      //problem_id: ?? something about problem id linked to incident
      requester_id: undefined,
      //sharing_agreement_ids: ?? we don't seem to have any with length > 0
      submitter_id: undefined,
      ticket_form_id: undefined,
    }),
    //status: 'solved',
    // Add a marker to remember it was imported
    tags: t.tags.push(...[`imported-ticket-${id}`]),
    // Handle coments and attachments
    comments: await handleComments(id),
    via: mapVia(t.via),
    group_id: DEFAULT_GROUP,
  };

  // Fix invalid assignees
  const invalids = [22123868209293];
  if (invalids.includes(t.assignee_id)) {
    t.assignee_id = QLEVER_USER;
  }

  // The field can have a null value so just first add to list, then handle its value.
  let assign = t.fields.find(f => f.id === ASSIGNEE_FIELD);
  if (!assign) {
    assign = {
      id: ASSIGNEE_FIELD,
      value: null
    }
    t.fields.push(assign)
  }
  if (assign.value === null) {
    let newAssign = t.assignee_id || DEFAULT_ASSIGNEE;
    let correspondingGroup = getMap(newAssign).default_group_id;
    t.group_id = correspondingGroup || t.group_id;

    if (!t.assignee_id) {
      console.log('Using default assign id on ticket')
    }

    t.fields = t.fields.map(({id, value}) => {
      if (id === ASSIGNEE_FIELD) return { id, value: newAssign }
      return { id, value };
    })
  }

  // The field can have a null value so just first add to list, then handle its value.
  let org = t.custom_fields.find(cf => cf.id === ORG_FIELD);
  if (!org) {
    org = {
      id: ORG_FIELD,
      value: null
    }
    t.custom_fields.push(org);
  }
  if (org.value === null) {
    let newOrg = t.organization_id || DEFAULT_ORG;
    if (!t.organization_id) {
      console.log('Using default org id on ticket')
    }

    t.custom_fields = t.custom_fields.map(({id, value}) => {
      if (id === ORG_FIELD) return { id, value: newOrg }
      return { id, value };
    })
  }

  return t;
}

async function getTicket(id) {
  try {
    let r = await throttled({
      method: 'get',
      url: `${from}/api/v2/tickets/${id}`,
      auth: {
        username,
        password,
      },
    });
    return r.data.ticket;
  } catch(err) {
  }
}

async function getTickets() {
  let tickets = [];
  let r;
  for await (let id of [...Array(3335).keys()]) {
    let t = await getTicket(id);
    if (t) tickets.push(t);
  }

  return tickets;
}


async function importTicket(ticket, id) {
  if (allMaps[id]) return;
  let response;
  try {
    response = await throttled({
      method: 'post',
      url: `${to}/api/v2/imports/tickets`,
      data: { ticket },
      auth: {
        username: toUsername,
        password: toPassword,
      }
    })
    allMaps[id] = {
      type: 'tickets',
      data: response.data.ticket,
    }
    console.log(`finished importing ticket ${id}`);
  } catch(err) {
    console.log(err);
  }
}

async function importSideConvo(id, newTicketId, side_conversation, events) {
  if (allMaps[id]) return;
  try {
    let response = await throttled({
      method: 'post',
      url: `${to}/api/v2/tickets/${newTicketId}/side_conversations/import`,
      data: { side_conversation, events },
      auth: {
        username: toUsername,
        password: toPassword,
      }
    })
    allMaps[id] = {
      type: 'side_conversations',
      data: response.data
    }
  } catch(err) {
    console.log(err);
    throw err;
  }
}

async function handleSideConvAttach(att) {
  if (allMaps[att.id]) return;
  // fetch the binary
  let r, p, form;
  try {
    r = await throttled({
      method: 'get',
      url: att.content_url,
      auth: {
        username,
        password,
      },
      responseType: 'arraybuffer'
    })
  } catch(err) {
    // file missing? not much we can do here
    console.log(err);
  }

  try {
    form = new FormData();
    form.append('file', Buffer.from(r.data), {
      filename: att.file_name,
      content_type: att.content_type,
      knownLength: att.size
    });
    //form.append('file', new Blob([Buffer.from(r.data)]));
    p = await throttled({
      method: 'post',
      url: `${to}/api/v2/tickets/side_conversations/attachments`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      data: form
    })
    allMaps[att.id] = {
      type: 'side-conv-attachments',
      data: p.data,
    }
    return p.data;
  } catch(err) {
    // failed to post; fix this;
    console.log(err);
    throw err;
  }
  return data;
}


async function handleAttachment(att) {
  if (allMaps[att.id]) return;
  // fetch the binary
  let r, p, data;
  try {
    r = await throttled({
      method: 'get',
      url: att.content_url,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      responseType: 'arraybuffer'
    })
  } catch(err) {
    // failed to get, can't fix this
    console.log(err);
  }

  // upload the binary
  try {
    p = await throttled({
      method: 'post',
      url: `${to}/api/v2/uploads`,
      auth: {
        username: toUsername,
        password: toPassword,
      },
      headers: {
        'Content-Type': att.content_type,
      },
      params: {
        filename: att.file_name
      },
      data: Buffer.from(r.data),
    })
    data = {
      ...p.data.upload.attachment,
      token: p.data.upload.token,
    };
    allMaps[att.id] = {
      type: 'attachments',
      data,
    }
    return data;
  } catch(err) {
    // failed to upload, fix this
    console.log(err);
    throw err;
  }
  return data;
}

async function handleComments(ticketId) {
  let {attachments, comments } = await getComments(ticketId);
  let comms = [];
  // Ensure all of the attachments exist
  for await (const att of attachments) {
    await handleAttachment(att);
    let newAttach = getMap(att.id);
    if (newAttach) {
      comments = comments.map(c => ({
        ...c,
        html_body: c.html_body
          .replace(att.content_url, newAttach.content_url)
          .replace(att.token, newAttach.token)
          //.replace("smithfield-docs", "smithfield-fsqa")
      }));
      if (att.mapped_content_url) {
        comments = comments.map(c => ({
          ...c,
          html_body: c.html_body
            .replace(att.mapped_content_url, newAttach.content_url),
        }));
      }
    }
  }
  for (let c of comments) {
    // Gather up the attachment jsons; They should now all be in allMaps
    c.uploads = c.attachments.map((att) => getMap(att.id).token)

    // delete the read-only keys (some can be used in the Ticket Import endpoint)
    delete c.attachments;
    delete c.audit_id;
    delete c.body;
    delete c.id;
    delete c.plain_body;
    delete c.url;



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
  let comments = [];
  let attachments = [];
  try {
    // Grab all the attachments including in-liners
    r = await throttled({
      method: 'get',
      url: `${from}/api/v2/tickets/${ticketId}/comments`,
      auth: {
        username,
        password,
      },
      params: {
        // include inline images (and other files?) in the array of attachments
        include_inline_images: true
      },
    })
    r.data.comments.forEach((c) => {
      attachments.push(...c.attachments);
    })
  } catch(err) {
    console.log(err);
  }

  try {
    // Now grab a version of comments with in-line attachments left as-is
    r = await throttled({
      method: 'get',
      url: `${from}/api/v2/tickets/${ticketId}/comments`,
      auth: {
        username,
        password,
      },
    })

    comments.push(...r.data.comments);
  } catch(err) {
    // can't fix this; keep going
    console.log(err);
  }

  while (r.data.next_page) {
    try {
      // Grab all the attachments including in-liners
      r = await throttled({
        method: 'get',
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
        params: {
          // include inline images (and other files?) in the array of attachments
          include_inline_images: true
        },
      })
      r.data.comments.forEach((c) => {
        attachments.push(c);
      })
      // Now grab a version of comments with in-line attachments left as-is
      r = await throttled({
        method: 'get',
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
      })

      comments.push(...r.data.comments);
    } catch(err) {
      console.log(err);
    }
  }
  return {comments, attachments};
}

async function handleSideConvos(oldTicketId, newTicketId) {
  let { events, sideConvos } = await getSideConvos(oldTicketId);
  for await (let sideConvo of sideConvos) {
    let scid = sideConvo.id;
    sideConvo = await mapSideConversation(sideConvo, oldTicketId);

    let evts = await Promise.all(events
      // find using the original id; no need to map to new id, we create sideConvo and events
      // simultaneously and ids get associated then
      .filter(e => e.side_conversation_id === scid)
      .filter(e => e.message)
      .map(async (e) => await mapEvent(e, newTicketId, scid)));

    await importSideConvo(scid, newTicketId, sideConvo, evts);
  }
  return sideConvos;
}

async function mapSideConversation(sideConvo, ticketId) {
  // remove read-only keys (only those we cannot keep)
  delete sideConvo.id;
  delete sideConvo.url;

  //Map/Prep the side conversation; if its a ticket, sub things out like a ticket?
  sideConvo = {
    ...mapObjectContent(sideConvo,{
      participants: undefined,
    }),
    ticket_id: allMaps[ticketId].data.id, // uses the ticketId so cannot be used in mapObjectContent
  };

  // Side convo is a ticket
  if (sideConvo.external_ids.targetTicketId) {
    console.log(`Recursing from ticket ${ticketId} to a side ticket ${sideConvo.external_ids.targetTicketId}`);
    let ticket = await getTicket(sideConvo.external_ids.targetTicketId);
    if (ticket) {
      await handleTicket(ticket);
      sideConvo.external_ids.targetTicketId = getMap(ticket.id).id;
    }
  }

  return sideConvo;
}

async function mapEvent(evt, newTicketId, scid) {
  let eid = evt.id;
  delete evt.id;
  delete evt.side_conversation_id;
  delete evt.url;
  evt = {
    ...evt,
    actor: mapParticipant(evt.actor),
    message: await mapMessage(evt.message, scid),
    //updates: e.updates.map(mapUpdate),
    ticket_id: newTicketId
    //via: mapVia(evt.via)
  };

  return evt
}

async function mapMessage(msg) {
  if (!msg) return;

  msg.attachment_ids = [];
  for await (const att of msg.attachments) {
    //ensure it exists
    await handleSideConvAttach(att);
    let newAttach = getMap(att.id);
    if (newAttach) {
      msg.html_body = msg.html_body
        .replace(att.content_url, newAttach.content_url)
        .replace(att.id, newAttach.id)
        //.replace("smithfield-docs", "smithfield-fsqa")

      if (att.mapped_content_url) msg.html_body = msg.html_body
        .replace(att.content_url, newAttach.content_url)

      if (!msg.html_body.includes(newAttach.id)) msg.attachment_ids.push(newAttach.id);
    }
  }

  delete msg.attachments

  return {
    ...msg,
    from: mapParticipant(msg.from),
    to: msg.to.map(mapParticipant),
    //external_ids: ??
  };
}

// TODO: According to docs, participants can be Support tickets???
function mapParticipant(part) {
  return {
    ...mapObjectContent(part, {
      user_id: undefined,
      //slack_workspace_id:
      //slack_channel_id:
      //support_group_id
      //support_agent_id:
      //msteams_channel_id:
    })
  }
}

function mapVia(via) {
  if (via.source.to && via.source.to.id) {
    via.source.to.id = getMap(via.source.to.id).id || via.source.to.id;
  }
  if (via.source.to && via.source.to.email_ccs) {
    via.source.to.email_ccs = via.source.to.email_ccs
      .map((e) => getMap(e).id)
      .filter((e) => e);
  }

  if (via.source.from && via.source.from.id) {
    if (via.source.from.id) {
      via.source.from.id = getMap(via.source.from.id).id || via.source.from.id;
    }
    if (via.source.from.ticket_id) {
      via.source.from.ticket_id = getMap(via.source.from.ticket_id).id || via.source.from.ticket_id;
    }
    if (via.source.from.suspended_ticket_id) {
      via.source.from.suspended_ticket_id = getMap(via.source.from.suspended_ticket_id).id || via.source.from.suspended_ticket_id;
    }
  }
  return via
}

async function getSideConvos(ticketId) {
  let sideConvos = [];
  let events = [];
  let r;
  try {
    r = await throttled({
      method: 'get',
      url: `${from}/api/v2/tickets/${ticketId}/side_conversations`,
      auth: {
        username,
        password,
      },
      params: {
        include: 'events'
      },
    })

    sideConvos.push(...r.data.side_conversations);
    events.push(...r.data.events);


    while (r.data.next_page) {
      r = await throttled({
        method: 'get',
        url: r.data.next_page,
        auth: {
          username,
          password,
        },
        params: {
          include: 'events'
        },
      })
      sideConvos.push(...r.data.side_conversations);
      events.push(...r.data.events);
    }
  } catch(err) {
    // something 404? keep going
    console.log(err);
  }
  return { events, sideConvos };
}


function handleFields(fields, mapping) {
  return fields.map(({id, value}) => ({
    id: getMap(id).id,
    // if the value is an id in our map (i.e., its a Lookup type field), replace it, else use the value
    value: getMap(value).id || value,
  }));
}

// content is an object of key-mapping function objects. if no mapping function is
// supplied, the value should either be a single id or or array of ids that can be
// mapped from allMaps.
function mapObjectContent(obj, content) {
  return {
    ...obj,
    ...Object.fromEntries(Object.entries(content).map(([key, mappingFuncOrDefault]) => ([
      key,
      mapValue(obj[key], mappingFuncOrDefault),
    ])))
  }
}

function mapValue(value, mappingFuncOrDefault) {
  if (typeof mappingFunc === 'function') {
    return mappingFuncOrDefault(value);
  }
  // an array of IDs that need to be mapped
  if (Array.isArray(value)) {
    return value
      .map(i => getMap(i).id)
      .filter(i => i)
  }
  // An ID that needs to be mapped, else the id
  return getMap(value).id || mappingFuncOrDefault || value;
}

// Some resources like attachments are harder to match up after the fact, so
// just store the mapping immediately
function storeMappings(mapObj) {
  allMaps = {
    ...allMaps,
    ...mapObj,
  }
  fs.writeFileSync(mappingsFilePath, JSON.stringify(allMaps), {encoding: 'utf8'})
}

function getMap(id) {
  return ((allMaps[id] || {}).data || {})
}

async function fixMigratedInlineImages() {
  let ticket = await getTicket(4370);
  let tick = await mapTicket(ticket);
  console.log(JSON.stringify(tick, null, 2))
}

if (esMain(import.meta)) {
  //await main();
  await fixMigratedInlineImages();

  console.log("DONE")
  process.exit();
}
