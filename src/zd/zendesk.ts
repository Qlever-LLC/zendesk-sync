import Debug from 'debug';
import Axios from 'axios';
import { buildMemoryStorage, setupCache } from 'axios-cache-interceptor';
import pThrottle from 'p-throttle';

import { config } from '../config.js';
import {
  Comment,
  Group,
  Org,
  SideConversation,
  SideConversationEvent,
  Ticket,
  Field,
  User,
  TicketArchive,
  SideConversationArchive,
  SideConversationAttachment,
  Attachment,
} from '../types.js';
const {
  username,
  password,
  domain: ZD_DOMAIN,
  api_limit: API_LIMIT,
  api_limit_interval: API_LIMIT_INTERVAL,
  org_field_id: ORG_FIELD_ID,
  default_org_id: DEFAULT_ORG_ID,
} = config.get('zendesk');

const debug = Debug('zendesk-sync:zendesk:debug');

const throttle = pThrottle({
  limit: API_LIMIT,
  interval: API_LIMIT_INTERVAL,
  strict: true,
});

const axiosInstance = Axios.create();
const axios = setupCache(axiosInstance, {
  storage: buildMemoryStorage(true, 20 * 1000, 5000),
});

export async function searchTickets(status: string): Promise<Array<Ticket>> {
  debug(`Searching for tickets with status: ${status}`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/search.json`,
        auth: {
          username,
          password,
        },
        params: {
          type: 'ticket',
          query: `type:ticket status:${status}`,
        },
      }) as Promise<{ data: SearchResponse }>,
  )();

  let tickets = r.data.results;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
        auth: {
          username,
          password,
        },
      }),
    )();

    tickets.push(...r.data.results);
  }

  return tickets;
}

// Returns a ticket archive including the ticket JSON, metadata, and assoicated binary resources
export async function getTicketArchive({ id }: Ticket): Promise<TicketArchive> {
  // Fetch the ticket JSON
  const ticket = await getTicket(id);

  // Fetch orgs assoicated with ticke
  const orgs = await getTicketOrgs(ticket);

  // Fetch the customer org
  const custOrgId = getCustomerOrgId(ticket);
  let org = (custOrgId && orgs[custOrgId]) || (await getOrg(DEFAULT_ORG_ID));

  // Fetch ticket comments
  const comments = await getTicketComments(ticket);

  // Fetch users
  const users = await getUsers(
    comments
      .map((c) => [
        c.author_id,
        ...('email_ccs' in c.via.source.to ? c.via.source.to.email_ccs : []),
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
  let groups = await getGroups();

  // Fetch ticket fields
  let fields = await getFields();

  // Collect all ticket attachments
  let attachments = indexById(
    comments
      .map((c) => c.attachments)
      .flat()
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  // Fetch attachment binary
  let sideConversations = await Promise.all(
    (await getSideConversations(ticket)).map((convo) =>
      getSideConversationArchive(convo),
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
    sideConversations,
  };
}

export async function getAttachmentBuffer(attach: Attachment): Promise<Buffer> {
  debug(`Fetching attachment ${attach.id}`);
  const buf = (await axios({
    method: 'get',
    url: attach.content_url,
    responseType: 'arraybuffer',
  })) as unknown as { data: string };

  return Buffer.from(buf.data, 'utf-8');
}

export async function doCredentialedApiRequest(url: string): Promise<Buffer> {
  debug({}, `Making credentialed API request to ${url}`);
  const buf = (await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    auth: {
      username,
      password,
    },
  })) as unknown as { data: string };

  return Buffer.from(buf.data, 'utf-8');
}

// Fetch a ticket by ID from Zendesk API
export async function getTicket(id: number | string): Promise<Ticket> {
  debug({ ticket_id: id }, `[Ticket ${id}] Fetching.`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/tickets/${id}?include=dates,ticket_forms`,
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
  debug(`[Ticket ${ticket.id}] Fetching organizations`);

  let ids: Array<number> = [];

  // check for ticket org
  if (ticket.organization_id) {
    ids.push(ticket.organization_id);
  }

  ids.push(getCustomerOrgId(ticket) ?? DEFAULT_ORG_ID);

  return getOrgs(ids);
}

export async function getTicketComments(
  ticket: Ticket,
): Promise<Array<Comment>> {
  debug(`[Ticket ${ticket.id}] Fetching comments`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.id}/comments`,
        auth: {
          username,
          password,
        },
      }) as Promise<{ data: CommentsResponse }>,
  )();

  let comments = r.data.comments;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
        auth: {
          username,
          password,
        },
      }),
    )();

    comments.push(...r.data.comments);
  }

  return comments;
}

// Returns an array of all side conversations assoicated with a ticket id
export async function getSideConversations(
  ticket: Ticket,
): Promise<Array<SideConversation>> {
  debug(`[Ticket ${ticket.id}] Fetching side conversations.`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.id}/side_conversations`,
        auth: {
          username,
          password,
        },
      }) as Promise<{ data: SideConversationsResponse }>,
  )();

  let sideConvos = r.data.side_conversations;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
        auth: {
          username,
          password,
        },
      }),
    )();

    sideConvos.push(...r.data.side_conversations);
  }

  return sideConvos;
}

export async function getSideConversationArchive(
  sideConvo: SideConversation,
): Promise<SideConversationArchive> {
  // Fetch events
  let events = await getSideConversationEvents(sideConvo);

  // Collect all ticket attachments
  let attachments = indexById(
    events
      .map((e) => e.message?.attachments)
      .filter((e): e is SideConversationAttachment[] => !!e)
      .flat()
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  debug(
    `[Ticket ${sideConvo.ticket_id}] Fetching side conversation attachments.`,
  );

  // Fetch users
  let users = await getUsers(sideConvo.participants.map((p) => p.user_id));

  let archive: SideConversationArchive = {
    sideConversation: sideConvo,
    events,
    attachments,
    users,
  };

  return archive;
}

// Fetch the events of a side conversation from Zendesk
export async function getSideConversationEvents(
  sideConvo: SideConversation,
): Promise<Array<SideConversationEvent>> {
  debug(
    `[Ticket ${sideConvo.ticket_id}] Fetching side conversations ${sideConvo.id} events`,
  );

  // Fetch side converstation events
  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/tickets/${sideConvo.ticket_id}/side_conversations/${sideConvo.id}/events`,
        auth: {
          username,
          password,
        },
      }) as Promise<{ data: SideConversationEventsResponse }>,
  )();

  let events = r.data.events;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
        auth: {
          username,
          password,
        },
      }),
    )();

    events.push(...r.data.events);
  }

  return events;
}

// Bulk fetch a set of Orgs from ZD
export async function getOrgs(
  ids: Array<number>,
): Promise<Record<number, Org>> {
  if (!ids.length) {
    return {};
  }

  debug(`Fetching orgs: ${ids.join(',')}.`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/organizations/show_many.json`,
        auth: {
          username,
          password,
        },
        params: {
          ids: ids.join(','),
        },
      }) as unknown as { data: OrgManyResponse },
  )();

  let organizations = r.data.organizations;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
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
export async function getOrg(orgId: number): Promise<Org> {
  const org = (await getOrgs([orgId]))[orgId];

  if (!org) {
    throw Error(`Org ${orgId} does not exist?`);
  }

  return org;
}

// Bulk fetch users from ZD API
export async function getUsers(
  ids: Array<number>,
): Promise<Record<string, User>> {
  if (!ids.length) {
    return {};
  }

  debug(`Fetching users: ${ids.join(',')}.`);

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/users/show_many.json`,
        auth: {
          username,
          password,
        },
        params: {
          ids: ids.join(','),
        },
      }) as unknown as { data: UserManyResponse },
  )();

  let users = r.data.users;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
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
export async function getGroups(): Promise<Record<string, Group>> {
  debug('Fetching groups');

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/groups`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: GroupManyResponse },
  )();

  let groups = r.data.groups;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
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
export async function getFields(): Promise<Record<string, Field>> {
  debug('Fetch ticket fields');

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/ticket_fields`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: TicketFieldManyResponse },
  )();

  let ticketFields = r.data.ticket_fields;

  while (r.data.next_page) {
    r = await throttle(async () =>
      axios({
        method: 'get',
        url: r.data.next_page as unknown as string,
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

///////////////////////
// Utility functions //
///////////////////////

// Find customer org id from ZD custom field
export function getCustomerOrgId(ticket: Ticket): number | undefined {
  const f = ticket.custom_fields.find(
    (f) => f.id === ORG_FIELD_ID && f.value !== null,
  );

  return f?.value;
}

// Map an array of objects with key '`d` to an object indexed by `id`
function indexById<T extends { id: number | string }>(
  data: Array<T>,
): Record<string, T> {
  return data.reduce(
    (cur, next) => {
      cur[next.id] = next;
      return cur;
    },
    {} as Record<number | string, T>,
  );
}

// TYPES

interface OrgManyResponse {
  organizations: Array<Org>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface SearchResponse {
  results: Array<Ticket>;
  next_page: string | null;
  previous_page: string | null;
  facets: null | any;
  count: number;
}

export type EnsureResult = {
  entry?: any;
  matches?: any[];
  exact?: boolean;
  new?: boolean;
};

interface UserManyResponse {
  users: Array<User>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface CommentsResponse {
  comments: Array<Comment>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface SideConversationsResponse {
  side_conversations: Array<SideConversation>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface SideConversationEventsResponse {
  events: Array<SideConversationEvent>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface TicketFieldManyResponse {
  ticket_fields: Array<Field>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

interface GroupManyResponse {
  groups: Array<Group>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}