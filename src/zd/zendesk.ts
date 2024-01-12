import axios from 'axios';
import pThrottle from 'p-throttle';

import { config } from '../config.js';
const {
  username,
  password,
  domain: ZD_DOMAIN,
  api_limit: API_LIMIT,
  org_field_id: ORG_FIELD_ID,
} = config.get('zendesk');

const throttle = pThrottle({
  limit: API_LIMIT,
  interval: 60 * 1000, // 1 minute
  strict: true,
});

export async function getTicket(ticket: number | Ticket): Promise<Ticket> {
  let id = typeof ticket === 'number' ? ticket : ticket.id;

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

export async function getTicketArchive(
  tix: number | Ticket,
): Promise<TicketArchive> {
  // Fetch even if we have ticket JSON to include the "?included=" fields
  const ticket = await getTicket(tix);
  const orgs = await getOrgsFromTicket(ticket);

  // check for customer org
  const orgId =
    ticket.custom_fields.find((f) => f.id === ORG_FIELD_ID && f.value !== null)
      ?.id ??
    ticket.organization_id ??
    null;

  let org = (orgId && orgs[orgId]) || null;

  ////////////////////
  // Fetch comments //
  ///////////////////
  const comments = await getCommentsFromTicket(ticket);

  const attachments = indexById(
    comments
      .map((c) => c.attachments)
      .flat()
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  //////////////////////////////
  // Fetch side conversations //
  //////////////////////////////
  let sideConversations = await getSideConversationsFromTicket(ticket);

  /////////////////
  // Fetch users //
  /////////////////
  let ids = comments
    .map((c) => [c.author_id, ...(c.via.source.to.email_ccs || [])])
    .concat(
      sideConversations.map((s) =>
        s.side_conversation.participants.map((p) => p.user_id),
      ),
    )
    .flat()
    .filter((user, index, array) => array.indexOf(user) === index);

  const users = await getUsers(ids);

  //////////////////
  // Fetch groups //
  //////////////////
  let groups = await getGroups();

  //////////////////
  // Fetch fields //
  //////////////////
  let ticketFields = await getTicketFields();

  return {
    ticket,
    comments,
    attachments,
    org,
    users,
    orgs,
    groups,
    ticketFields,
    sideConversations,
  };
}

export async function searchTickets(status: string): Promise<Array<Ticket>> {
  let tickets: Array<Ticket> = [];

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

  tickets.push(...r.data.results);

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

export async function getOrgsFromTicket(
  ticket: Ticket,
): Promise<Record<string, Org>> {
  let ids = [];

  // check for ticket org
  if (ticket.organization_id) {
    ids.push(ticket.organization_id);
  }

  // check for customer org
  const f = ticket.custom_fields.find(
    (f) => f.id === ORG_FIELD_ID && f.value !== null,
  );

  if (f) {
    ids.push(f.id);
  }

  return getOrgs(ids);
}

export async function getCommentsFromTicket(
  ticket: Ticket,
): Promise<Array<Comment>> {
  let comments: Array<Comment> = [];

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

  comments.push(...r.data.comments);

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

export async function getSideConversationsFromTicket(
  ticket: Ticket,
): Promise<Array<SideConversationWithEvents>> {
  let sideConvos: Array<SideConversation> = [];

  let r = await throttle(
    async () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.id}/side_conversations`,
        auth: {
          username,
          password,
        },
      }) as Promise<{ data: SideConversationResponse }>,
  )();

  sideConvos.push(...r.data.side_conversations);

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

  // Replace all the side conversation objects with on where `events` is side loaded expanded
  return Promise.all(
    sideConvos.map(async (sideConv) => {
      let r = await throttle(
        async () =>
          axios({
            method: 'get',
            url: `${ZD_DOMAIN}/api/v2/tickets/${ticket.id}/side_conversations/${sideConv.id}?include=events`,
            auth: {
              username,
              password,
            },
          }) as Promise<{ data: SideConversationWithEvents }>,
      )();

      return r.data;
    }),
  );
}

export async function getOrgs(
  orgs: Array<number | null>,
): Promise<Record<string, Org>> {
  if (!orgs.length) {
    return {};
  }

  let organizations: Array<Org> = [];

  let r = await throttle(
    () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/organizations/show_many.json`,
        auth: {
          username,
          password,
        },
        params: {
          ids: orgs.join(','),
        },
      }) as unknown as { data: OrgManyResponse },
  )();

  organizations.push(...r.data.organizations);

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

export async function getUsers(
  ids: Array<number | null>,
): Promise<Record<string, User>> {
  if (!ids.length) {
    return {};
  }

  let users: Array<User> = [];

  let r = await throttle(
    () =>
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

  users.push(...r.data.users);

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

export async function getGroups(): Promise<Record<string, Group>> {
  let groups: Array<Group> = [];

  let r = await throttle(
    () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/groups`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: GroupManyResponse },
  )();

  groups.push(...r.data.groups);

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

export async function getTicketFields(): Promise<Record<string, TicketField>> {
  let ticketFields: Array<TicketField> = [];

  let r = await throttle(
    () =>
      axios({
        method: 'get',
        url: `${ZD_DOMAIN}/api/v2/ticket_fields`,
        auth: {
          username,
          password,
        },
      }) as unknown as { data: TicketFieldManyResponse },
  )();

  ticketFields.push(...r.data.ticket_fields);

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

function indexById<T extends { id: number }>(
  data: Array<T>,
): Record<string, T> {
  return data.reduce(
    (cur, next) => {
      cur[next.id] = next;
      return cur;
    },
    {} as Record<number, T>,
  );
}

// TYPES

export const SAP_FIELD = 'sap_id';

export interface TicketArchive {
  ticket: Ticket;
  comments: Array<Comment>;
  attachments: Record<number, Attachment>;
  org: Org | null;
  users: Record<number, User>;
  orgs: Record<number, Org>;
  groups: Record<number, Group>;
  ticketFields: Record<number, TicketField>;
  sideConversations: Array<SideConversationWithEvents>;
}

export interface Org {
  id: number;
  name: string;
  [SAP_FIELD]: string;
  organization_fields: {
    [SAP_FIELD]: string;
  };
}

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

export interface Ticket {
  url: string;
  id: number;
  external_id: number | null;
  via: {
    channel: number;
    source: {
      from: {
        address: string;
        name: string;
      };
      to: {
        name: string;
        address: string;
      };
      rel: string | null;
    };
  };
  created_at: string;
  updated_at: string;
  type: null;
  subject: string;
  raw_subject: string;
  description: string;
  priority: string;
  status: string;
  recipient: string;
  requester_id: number;
  submitter_id: number;
  assignee_id: number;
  organization_id: number | null;
  group_id: number;
  collaborator_ids: any[];
  follower_ids: any[];
  email_cc_ids: any[];
  forum_topic_id: null;
  problem_id: null;
  has_incidents: false;
  is_public: true;
  due_at: null;
  tags: any[];
  custom_fields: Array<{
    id: number;
    value: any;
  }>;
  satisfaction_rating: any;
  sharing_agreement_ids: any[];
  custom_status_id: number;
  fields: Array<{
    id: number;
    value: any;
  }>;
  followup_ids: string[];
  ticket_form_id: number;
  brand_id: number;
  allow_channelback: boolean;
  allow_attachments: boolean;
  from_messaging_channel: boolean;
  result_type: string;
}

export interface Attachment {
  url: string;
  id: number;
  file_name: string;
  content_url: string;
  mapped_content_url: string;
  content_type: string;
  size: number;
  width: null | string;
  height: null | string;
  inline: boolean;
  deleted: boolean;
  malware_access_override: boolean;
  malware_scan_result: string;
}

export type OrgTicket = Ticket & {
  organization: Org;
};

export type EnsureResult = {
  entry?: any;
  matches?: any[];
  exact?: boolean;
  new?: boolean;
};

export interface User {
  id: number;
  name: string;
}

interface UserManyResponse {
  users: Array<User>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

export interface Comment {
  id: number;
  type: 'Comment';
  author_id: number;
  body: string;
  html_body: string;
  plain_body: string;
  public: boolean;
  attachments: Array<Attachment>;
  audit_id: number;
  via: {
    channel: string;
    source: {
      from: {
        address: string;
        name: string | null;
        organization_recipients: Array<string> | null;
      };
      to: {
        name: string | null;
        address: string;
        email_ccs: Array<number>;
      };
    };
  };
  created_at: string;
}

interface CommentsResponse {
  comments: Array<Comment>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

export interface SideConversation {
  url: string;
  id: string;
  ticket_id: number;
  subject: string;
  preview_text: string;
  state: string;
  participants: Array<{
    user_id: number;
    name: string;
    email: string;
  }>;
  created_at: string;
  updated_at: string;
  message_added_at: string;
  state_updated_at: string;
  external_ids:
  | {}
  | {
    targetTicketId: number;
  };
}

interface SideConversationResponse {
  side_conversations: Array<SideConversation>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

export interface SideConversationWithEvents {
  side_conversation: SideConversation;
  events?: Array<{
    id: string;
    side_conversation_id: string;
    actor: {
      user_id: number;
      name: string;
      email: string;
    };
    type: string;
    via: string;
    created_at: string;
    message: {
      subject: string;
      preview_text: string;
      from: {
        user_id: number;
        name: string;
        email: string;
      };
      to: Array<{
        user_id: number;
        name: string;
        email: string;
      }>;
      body: string;
      html_body: string;
      external_ids: {
        ticketAuditId: string;
        outboundEmail?: string;
      };
      attachments: Array<{
        id: string;
        file_name: string;
        size: number;
        content_url: string;
        content_type: string;
        width: number;
        height: number;
        inline: boolean;
      }>;
      updates: {};
      ticket_id: number;
    };
  }>;
}

export interface TicketField {
  id: number;
  position: number;
  description: string;
  title: string;
  type: string;
}

interface TicketFieldManyResponse {
  ticket_fields: Array<TicketField>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}

export interface Group {
  description: string;
  id: number;
  name: string;
}

interface GroupManyResponse {
  groups: Array<Group>;
  next_page: string | null;
  previous_page: string | null;
  count: number;
}