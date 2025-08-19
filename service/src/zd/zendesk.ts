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

import type { Logger } from "@oada/pino-debug";
import { isAxiosError } from "axios";
import { config } from "../config.js";
import type {
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
} from "../types.js";
import {
  callTypedApi,
  callTypedPagedApi,
  indexById,
  makeCredentialedPutRequest,
  type TrellisState,
} from "./utils.js";

export async function searchTickets(
  log: Logger,
  query: string,
): Promise<Ticket[]> {
  log?.debug({}, `Searching for tickets with query: type:ticket ${query}`);

  const data = await callTypedPagedApi<Ticket>(
    log,
    "api/v2/search.json",
    "results",
    {
      params: {
        type: "ticket",
        query: `type:ticket ${query}`,
      },
    },
  );

  return data;
}

// Returns a ticket archive including the ticket JSON, metadata, and associated binary resources
export async function getTicketArchive(
  log: Logger,
  ticketId: number,
): Promise<TicketArchive> {
  log.trace("Fetching ticket archive");

  // Fetch the ticket JSON
  const ticket = await getTicket(log, ticketId);

  // Fetch orgs associated with ticke
  const orgs = await getTicketOrgs(log, ticket);

  // Fetch the customer org
  const custOrgId = getCustomerOrgId(ticket);
  const org =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    (custOrgId && orgs[custOrgId]) ||
    (await getOrg(config.get("zendesk.default_org"), log));

  // Fetch ticket comments
  const comments = await getTicketComments(ticket, log);

  const ids = comments
    .map((c) => [
      c.author_id,
      ...(c.via.source.to && "email_ccs" in c.via.source.to
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
    .filter((user, index, array) => array.indexOf(user) === index);

  // Fetch users
  const users = await getUsers(log, ids);

  // Fetch groups
  const groups = await getGroups(log);

  // Fetch ticket fields
  const fields = await getFields(log);

  // Collect all ticket attachments
  const attachments = indexById(
    comments
      .flatMap((c) => c.attachments)
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  // Fetch attachment binary
  const sideConversations = await getSideConversations(log, ticket);
  const sideConversationsArchive = await Promise.all(
    sideConversations.map(async (convo) =>
      getSideConversationArchive(log, convo),
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

// Fetch a ticket by ID from Zendesk API
export async function getTicket(
  log: Logger,
  id: number | string,
): Promise<Ticket> {
  log.trace("Fetching ticket.");

  try {
    return await callTypedApi(
      log,
      `api/v2/tickets/${id}?include=dates,ticket_forms`,
      "ticket",
    );
  } catch (error) {
    if (isAxiosError(error) && error.status === 404) {
      throw new Error(`Ticket ${id} not found.`);
    }

    throw error;
  }
}

export async function getTicketOrgs(
  log: Logger,
  ticket: Ticket,
): Promise<Record<string, Org>> {
  log.trace("Fetching organizations");

  const ids: number[] = [];

  // Check for ticket org
  if (ticket.organization_id) {
    ids.push(ticket.organization_id);
  }

  ids.push(getCustomerOrgId(ticket) ?? config.get("zendesk.default_org"));

  return getOrgs(log, ids);
}

export async function getTicketComments(
  ticket: Ticket,
  log: Logger,
): Promise<Comment[]> {
  log.trace("Fetching comments");

  return callTypedPagedApi(
    log,
    `api/v2/tickets/${ticket.id}/comments`,
    "comments",
  );
}

// Returns an array of all side conversations associated with a ticket id
export async function getSideConversations(
  log: Logger,
  ticket: Ticket,
): Promise<SideConversation[]> {
  log.trace("Fetching side conversations.");

  return callTypedPagedApi(
    log,
    `api/v2/tickets/${ticket.id}/side_conversations`,
    "side_conversations",
  );
}

export async function getSideConversationArchive(
  log: Logger,
  sideConvo: SideConversation,
): Promise<SideConversationArchive> {
  // Fetch events
  const events = await getSideConversationEvents(log, sideConvo);

  // Collect all ticket attachments
  const attachments = indexById(
    events
      .flatMap((event) => event.message?.attachments)
      .filter((attachment) => attachment !== undefined)
      .filter((user, index, array) => array.indexOf(user) === index),
  );

  log.trace("Fetching side conversation attachments.");

  // Fetch users
  const users = await getUsers(
    log,
    sideConvo.participants.map((p) => p.user_id),
  );

  const archive: SideConversationArchive = {
    sideConversation: sideConvo,
    events,
    attachments,
    users,
  };

  return archive;
}

// Fetch the events of a side conversation from Zendesk
export async function getSideConversationEvents(
  log: Logger,
  sideConvo: SideConversation,
): Promise<SideConversationEvent[]> {
  log.trace(`Fetching side conversations ${sideConvo.id} events`);

  // Fetch side conversation events
  return callTypedPagedApi(
    log,
    `api/v2/tickets/${sideConvo.ticket_id}/side_conversations/${sideConvo.id}/events`,
    "events",
  );
}

// Bulk fetch a set of Orgs from ZD
export async function getOrgs(
  log: Logger,
  ids: number[],
): Promise<Record<number, Org>> {
  if (ids.length === 0) {
    return {};
  }

  // Uniquify the list of ids to avoid asking for duplicate orgs
  const filteredIds = ids
    .filter((x, index, a) => a.indexOf(x) === index)
    .filter((x) => x !== undefined);
  log.trace("Fetching orgs.");

  const organizations = await callTypedPagedApi<Org>(
    log,
    "api/v2/organizations/show_many.json",
    "organizations",
    {
      params: {
        ids: filteredIds.join(","),
      },
    },
  );

  return indexById(organizations);
}

// Use bulk getOrgs API to fetch a single org
export async function getOrg(orgId: number, log: Logger): Promise<Org> {
  const orgs = await getOrgs(log, [orgId]);
  const org = orgs[orgId];

  if (!org) {
    throw new Error(`Org ${orgId} does not exist?`);
  }

  return org;
}

// Bulk fetch users from ZD API
export async function getUsers(
  log: Logger,
  ids: number[],
): Promise<Record<string, User>> {
  if (ids.length === 0) {
    return {};
  }

  // Uniquify the list of ids to avoid asking for duplicate orgs
  const filteredIds = ids.filter((x, index, a) => a.indexOf(x) === index);
  log.trace("Fetching users");

  const users = await callTypedPagedApi<User>(
    log,
    "api/v2/users/show_many.json",
    "users",
    {
      params: {
        ids: filteredIds.join(","),
      },
    },
  );

  return indexById(users);
}

// Fetch all zendesk groups (typically not many)
export async function getGroups(log: Logger): Promise<Record<string, Group>> {
  log.trace("Fetching groups");

  const groups = await callTypedPagedApi<Group>(log, "api/v2/groups", "groups");

  return indexById(groups);
}

// Fetch all Zendesk fields used for ticket metadata
export async function getFields(log: Logger): Promise<Record<string, Field>> {
  log.trace("Fetch ticket fields");

  const ticketFields = await callTypedPagedApi<Field>(
    log,
    "api/v2/ticket_fields",
    "ticket_fields",
  );

  return indexById(ticketFields);
}

export async function setCustomField(
  log: Logger,
  ticket: Ticket,
  fields: Array<{ id: string | number; value: string | number }>,
) {
  log.trace({ fields }, "Updating Zendesk custom fields value");

  await makeCredentialedPutRequest(log, `api/v2/tickets/${ticket.id}`, {
    data: {
      ticket: {
        custom_fields: fields,
      },
    },
  });
}

export async function setTrellisState(
  log: Logger,
  ticket: Ticket,
  state: TrellisState,
) {
  if (ticket.status === "closed") {
    log.warn("Can not update a closed ticket. Skipping setting Trellis state.");
    return;
  }

  const updates: Array<{ id: string | number; value: string | number }> = [];

  if (state.state) {
    updates.push({
      id: config.get("zendesk.fields.state"),
      value: state.state,
    });
  }

  if (state.status) {
    updates.push({
      id: config.get("zendesk.fields.status"),
      value: state.status,
    });
  }

  if (updates.length > 0) {
    await setCustomField(log, ticket, updates);
  } else {
    log.debug("No state change to update");
  }
}

export async function setTicketStatus(
  log: Logger,
  ticket: Ticket,
  status: string,
) {
  log.trace(`Marking ticket as ${status}`);

  if (ticket.status === "closed") {
    log.warn("Can not update a closed ticket. Skipping status change.");
    return;
  }

  await makeCredentialedPutRequest(log, `api/v2/tickets/${ticket.id}.json`, {
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
    config.get("zendesk.fields.organization"),
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
