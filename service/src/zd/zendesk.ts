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
 o * limitations under the License.
 */

import { config } from '../config.js';

import { buildMemoryStorage, setupCache } from 'axios-cache-interceptor';
import axiosLibrary from 'axios';
import pThrottle from 'p-throttle';

import type {
  Attachment,
  Comment,
  Field,
  Group,
  Org,
  SideConversation,
  SideConversationArchive,
  SideConversationEvent,
  Ticket,
  TicketArchive,
  User,
} from '../types.js';
import { makeLoggers } from '../logger.js';

const { username, password, domain } = config.get('zendesk');

const log = makeLoggers('zendesk');

const throttle = pThrottle({
  limit: config.get('zendesk.api_limit'),
  interval: config.get('zendesk.api_limit_interval'),
  strict: true,
});

// Replace axios with a memory cache wrapper
const axios = setupCache(axiosLibrary.create(), {
  storage: buildMemoryStorage(true, 20 * 1000, 5000),
});

export async function searchTickets(query: string): Promise<Ticket[]> {
  log.debug({}, `Searching for tickets with query: type:ticket ${query}`);

  let r = await throttle(async () =>
    axios({
      method: 'get',
      url: `${domain}/api/v2/search.json`,
      auth: {
        username,
        password,
      },
      params: {
        type: 'ticket',
        query: `type:ticket ${query}`,
      },
    }),
  )();

  const tickets = (r.data as SearchResponse).results;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    tickets.push(...(r.data as SearchResponse).results);
  }

  return tickets;
}

// Returns a ticket archive including the ticket JSON, metadata, and associated binary resources
export async function getTicketArchive(
  ticketId: number,
): Promise<TicketArchive> {
  log.trace({ ticketId }, 'Generating ticket archive');

  // Fetch the ticket JSON
  const ticket = await getTicket(ticketId);

  // Fetch orgs associated with ticket
  const orgs = await getTicketOrgs(ticket);

  // Fetch the customer org
  const customerOrgId = getCustomerOrgId(ticket);
  const org =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    (customerOrgId && orgs[customerOrgId]) ||
    (await getOrg(ticket, config.get('zendesk.default_org')));

  // Fetch ticket comments
  const comments = await getTicketComments(ticket);

  // Fetch users
  const users = await getUsers(
    ticket,
    comments
      .map((c) => [
        c.author_id,
        ...(c.via.source.to && 'email_ccs' in c.via.source.to
          ? c.via.source.to.email_ccs
          : []),
      ])
      .concat([
        ticket.assignee_id,
        ticket.requester_id,
        ticket.submitter_id,
        ticket.assignee_id,
      ])
      .concat(ticket.collaborator_ids)
      .concat(ticket.follower_ids)
      .concat(ticket.email_cc_ids)
      .flat()
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  // Fetch groups
  const groups = await getGroups(ticket);

  // Fetch ticket fields
  const fields = await getFields(ticket);

  // Collect all ticket attachments
  const attachments = indexById(
    comments
      .flatMap((c) => c.attachments)
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  // Fetch attachment binary
  const sideConversations = await getSideConversations(ticket);
  const sideConversationsArchive = await Promise.all(
    sideConversations.map(async (conversation) =>
      getSideConversationArchive(ticket, conversation),
    ),
  );

  return {
    ticket,
    comments,
    attachments,
    org,
    users,
    orgs,
    groups,
    fields,
    sideConversations: sideConversationsArchive,
  };
}

export async function getAttachmentBuffer(
  ticket: Ticket,
  attach: Attachment,
): Promise<Uint8Array> {
  log.trace(
    { ticketId: ticket.id, attachmentId: attach.id },
    `Fetching attachment`,
  );
  const buf = (await axios({
    method: 'get',
    url: attach.content_url,
    responseType: 'arraybuffer',
  })) as unknown as { data: string };

  return Buffer.from(buf.data, 'utf8');
}

export async function doCredentialedApiRequest(
  ticket: Ticket,
  url: string,
): Promise<Uint8Array> {
  log.trace({ ticketId: ticket.id, url }, `Making credentialed API request`);
  const buf = (await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    auth: {
      username,
      password,
    },
  })) as unknown as { data: string };

  return Buffer.from(buf.data, 'utf8');
}

// Fetch a ticket by ID from Zendesk API
export async function getTicket(id: number | string): Promise<Ticket> {
  log.trace({ ticketId: id }, `Fetching ticket.`);

  const r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${domain}/api/v2/tickets/${id}?include=dates,ticket_forms`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: { ticket: Ticket } },
  )();

  return r.data.ticket;
}

export async function getTicketOrgs(
  ticket: Ticket,
): Promise<Record<string, Org>> {
  log.trace({ ticketId: ticket.id }, `Fetching organizations`);

  const ids: number[] = [];

  // Check for ticket org
  if (ticket.organization_id) {
    ids.push(ticket.organization_id);
  }

  ids.push(getCustomerOrgId(ticket) ?? config.get('zendesk.default_org'));

  return getOrgs(ticket, ids);
}

export async function getTicketComments(ticket: Ticket): Promise<Comment[]> {
  log.trace({ ticketId: ticket.id }, `Fetching comments`);

  let r = await throttle(async () =>
    axios({
      method: 'get',
      url: `${domain}/api/v2/tickets/${ticket.id}/comments`,
      auth: {
        username,
        password,
      },
    }),
  )();

  const { comments } = r.data as CommentsResponse;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    comments.push(...(r.data as CommentsResponse).comments);
  }

  return comments;
}

// Returns an array of all side conversations associated with a ticket id
export async function getSideConversations(
  ticket: Ticket,
): Promise<SideConversation[]> {
  log.trace({ ticketId: ticket.id }, `Fetching side conversations.`);

  let r = await throttle(async () =>
    axios({
      method: 'get',
      url: `${domain}/api/v2/tickets/${ticket.id}/side_conversations`,
      auth: {
        username,
        password,
      },
    }),
  )();

  const sideConversations = (r.data as SideConversationsResponse)
    .side_conversations;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    sideConversations.push(
      ...(r.data as SideConversationsResponse).side_conversations,
    );
  }

  return sideConversations;
}

export async function getSideConversationArchive(
  ticket: Ticket,
  sideConversation: SideConversation,
): Promise<SideConversationArchive> {
  // Fetch events
  const events = await getSideConversationEvents(sideConversation);

  // Collect all ticket attachments
  const attachments = indexById(
    events
      .flatMap((event) => event.message?.attachments)
      .filter((attachment) => attachment !== undefined)
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  log.trace({ ticketId: ticket.id }, `Fetching side conversation attachments.`);

  // Fetch users
  const users = await getUsers(
    ticket,
    sideConversation.participants.map((p) => p.user_id),
  );

  const archive: SideConversationArchive = {
    sideConversation,
    events,
    attachments,
    users,
  };

  return archive;
}

// Fetch the events of a side conversation from Zendesk
export async function getSideConversationEvents(
  sideConversation: SideConversation,
): Promise<SideConversationEvent[]> {
  log.trace(
    { ticketId: sideConversation.ticket_id },
    `Fetching side conversations ${sideConversation.id} events`,
  );

  // Fetch side converstation events
  let r = await throttle(async () =>
    axios({
      method: 'get',
      url: `${domain}/api/v2/tickets/${sideConversation.ticket_id}/side_conversations/${sideConversation.id}/events`,
      auth: {
        username,
        password,
      },
    }),
  )();

  const { events } = r.data as SideConversationEventsResponse;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    events.push(...(r.data as SideConversationEventsResponse).events);
  }

  return events;
}

// Bulk fetch a set of Orgs from ZD
export async function getOrgs(
  ticket: Ticket | undefined,
  ids: number[],
): Promise<Record<number, Org>> {
  if (ids.length === 0) {
    return {};
  }

  // Uniquify the list of ids to avoid asking for duplicate orgs
  ids = ids
    .filter((x, index, a) => a.indexOf(x) === index)
    .filter((x) => x !== undefined);
  log.trace({ ...(ticket && { ticketId: ticket.id }) }, `Fetching orgs.`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${domain}/api/v2/organizations/show_many.json`,
        auth: {
          username,
          password,
        },
        params: {
          ids: ids.join(','),
        },
      }) as unknown as { data: OrgManyResponse },
  )();

  const { organizations } = r.data;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    organizations.push(...r.data.organizations);
  }

  return indexById(organizations);
}

// Use bulk getOrgs to fetch a single org
export async function getOrg(ticket: Ticket, orgId: number): Promise<Org> {
  const orgs = await getOrgs(ticket, [orgId]);
  const org = orgs[orgId];

  if (!org) {
    throw new Error(`Org ${orgId} does not exist?`);
  }

  return org;
}

// Bulk fetch users from ZD API
export async function getUsers(
  ticket: Ticket,
  ids: number[],
): Promise<Record<string, User>> {
  if (ids.length === 0) {
    return {};
  }

  // Uniquify the list of ids to avoid asking for duplicate orgs
  ids = ids.filter((x, index, a) => a.indexOf(x) === index);
  log.trace({ ticketId: ticket.id }, `Fetching users`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${domain}/api/v2/users/show_many.json`,
        auth: {
          username,
          password,
        },
        params: {
          ids: ids.join(','),
        },
      }) as unknown as { data: UserManyResponse },
  )();

  const { users } = r.data;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    users.push(...r.data.users);
  }

  return indexById(users);
}

// Fetch all zendesk groups (typically not many)
export async function getGroups(
  ticket: Ticket,
): Promise<Record<string, Group>> {
  log.trace({ ticketId: ticket.id }, 'Fetching groups');

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${domain}/api/v2/groups`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: GroupManyResponse },
  )();

  const { groups } = r.data;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    groups.push(...r.data.groups);
  }

  return indexById(groups);
}

// Fetch all Zendesk fields used for ticket metadata
export async function getFields(
  ticket: Ticket,
): Promise<Record<string, Field>> {
  log.trace({ ticketId: ticket.id }, 'Fetch ticket fields');

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${domain}/api/v2/ticket_fields`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: TicketFieldManyResponse },
  )();

  const { ticket_fields: ticketFields } = r.data;

  while (r.data.next_page) {
    const url = `${r.data.next_page}`;
    // eslint-disable-next-line no-await-in-loop
    r = await throttle(async () =>
      axios({
        method: 'get',
        url,
        auth: {
          username,
          password,
        },
      }),
    )();

    ticketFields.push(...r.data.ticket_fields);
  }

  return indexById(ticketFields);
}

export async function setCustomField(
  ticket: Ticket,
  fields: Array<{ id: string | number; value: string | number }>,
) {
  log.trace(
    { ticketId: ticket.id, fields },
    'Updating Zendesk custom field value',
  );

  await throttle(async () =>
    axios({
      method: 'put',
      url: `${domain}/api/v2/tickets/${ticket.id}`,
      auth: {
        username,
        password,
      },
      data: {
        ticket: {
          custom_fields: fields,
        },
      },
    }),
  )();
}

export async function setTrellisState(ticket: Ticket, state: TrellisState) {
  if (ticket.status === 'closed') {
    log.warn(
      { ticketId: ticket.id },
      'Can not update a closed ticket. Skipping setting Trellis state.',
    );
    return;
  }

  const updates = [
    {
      id: config.get('zendesk.fields.state'),
      value: state.state,
    },
  ];

  if (state.status) {
    updates.push({
      id: config.get('zendesk.fields.status'),
      value: state.status,
    });
  }

  await setCustomField(ticket, updates);
}

export async function setTicketStatus(ticket: Ticket, status: string) {
  log.trace({ ticketId: ticket.id }, `Marking ticket as ${status}`);

  if (ticket.status === 'closed') {
    log.warn(
      { ticketId: ticket.id },
      'Can not update a closed ticket. Skipping status change.',
    );
    return;
  }

  await axios({
    method: 'put',
    url: `${config.get('zendesk.domain')}/api/v2/tickets/${ticket.id}.json`,
    auth: {
      username,
      password,
    },
    data: {
      ticket: {
        status,
      },
    },
  });
}

//
// Utility functions
//

// Find customer org id from ZD custom field
export function getCustomerOrgId(ticket: Ticket): number | undefined {
  const orgId = getTicketFieldValue(
    ticket,
    config.get('zendesk.fields.organization'),
  );

  return orgId ? Number(orgId) : undefined;
}

export function getTicketFieldValue(
  ticket: Ticket,
  fieldId: number,
): string | undefined {
  const field = ticket.custom_fields.find(
    (f) => f.id === fieldId && f.value !== null,
  );

  return field ? String(field.value) : undefined;
}

// Map an array of objects with key '`d` to an object indexed by `id`
function indexById<T extends { id: number | string }>(
  data: T[],
): Record<string, T> {
  const output: Record<string, T> = {};

  for (const element of data) {
    output[element.id] = element;
  }

  return output;
}

// TYPES
export interface TrellisState {
  state: string;
  status: string | undefined;
}

// Interfaces
interface OrgManyResponse {
  organizations: Org[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface SearchResponse {
  results: Ticket[];
  next_page: string | undefined;
  previous_page: string | undefined;
  facets: unknown;
  count: number;
}

interface UserManyResponse {
  users: User[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface CommentsResponse {
  comments: Comment[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface SideConversationsResponse {
  side_conversations: SideConversation[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface SideConversationEventsResponse {
  events: SideConversationEvent[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface TicketFieldManyResponse {
  ticket_fields: Field[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}

interface GroupManyResponse {
  groups: Group[];
  next_page: string | undefined;
  previous_page: string | undefined;
  count: number;
}
