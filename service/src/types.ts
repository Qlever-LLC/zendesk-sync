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

// State machine
export const STATE_PROCESSING = 'trellis-processing';
export const STATE_PENDING = 'trellis-pending';
export const STATE_HOLD = 'trellis-hold';
export const STATE_ARCHIVED = 'trellis-archived';

// ArchiveTicket Service
export type Closer = 'none' | 'immediate' | 'laserfiche';
export interface ArchiveConfig {
  ticketId: number;
  closer: Closer;
}
export function isCloser(c: string): Closer {
  const closer = c as unknown as Closer;
  const closers: Closer[] = ['none', 'immediate', 'laserfiche'];

  if (!closers.includes(closer)) {
    throw new Error('Invalid closer type!');
  }

  return closer;
}

// LFCloser service
export interface LFCloserConfig {
  ticketId: number;
  doc: string;
}

// Trellis-Data-Manager
export interface Entry {
  name: string;
  externalIds: string[];
  masterid: string;
  bookmarks: string;
}

export interface EnsureResult {
  entry?: Entry;
  matches?: Array<{ item: Entry }>;
  exact?: boolean;
  new?: boolean;
}

// Archive
export interface TicketArchive {
  ticket: Ticket;
  org: Org;
  comments: Comment[];
  orgs: Record<string | number, Org>;
  groups: Record<string | number, Group>;
  users: Record<string | number, User>;
  fields: Record<string | number, Field>;
  attachments: Record<string | number, Attachment>;
  sideConversations: SideConversationArchive[];
}

export interface SideConversationArchive {
  sideConversation: SideConversation;
  events: SideConversationEvent[];
  users: Record<string | number, User>;
  attachments: Record<string | number, SideConversationAttachment>;
}

// Tickets
export interface Ticket {
  url: string;
  id: number;
  external_id: number | string | undefined;
  via: {
    channel: string | number;
    source: {
      from:
        | Record<string, unknown>
        | {
            name: string;
            address: string;
          };
      to:
        | Record<string, unknown>
        | {
            name: string;
            address: string;
          };
      rel: string | undefined;
    };
  };
  created_at: string;
  updated_at: string;
  type: undefined;
  subject: string;
  raw_subject: string;
  description: string;
  priority: string;
  status: string;
  recipient: string | undefined;
  requester_id: number;
  submitter_id: number;
  assignee_id: number;
  organization_id: number;
  group_id: number;
  collaborator_ids: number[];
  follower_ids: number[];
  email_cc_ids: number[];
  forum_topic_id: undefined;
  problem_id: undefined;
  has_incidents: false;
  is_public: true;
  due_at: undefined;
  tags: unknown[];
  custom_fields: Array<{
    id: number;
    value: unknown;
  }>;
  satisfaction_rating: unknown;
  sharing_agreement_ids: unknown[];
  custom_status_id: number;
  fields: Array<{
    id: number;
    value: unknown;
  }>;
  followup_ids: string[];
  ticket_form_id: number;
  brand_id: number;
  dates: {
    assignee_updated_at: string;
    requester_updated_at: string;
    status_updated_at: string;
    initially_assigned_at: string;
    assigned_at: string;
    solved_at: string;
    latest_comment_added_at: string;
  };
  allow_channelback: boolean;
  allow_attachments: boolean;
  from_messaging_channel: boolean;
  result_type?: string;
}

export type OrgTicket = Ticket & {
  organization: Org;
};

export interface Field {
  url: string;
  id: number;
  type: string;
  title: string;
  raw_title: string;
  description: string;
  raw_description: string;
  position: number;
  active: boolean;
  required: boolean;
  collapsed_for_agents: boolean;
  regexp_for_validation: undefined;
  title_in_portal: string;
  raw_title_in_portal: string;
  visible_in_portal: boolean;
  editable_in_portal: boolean;
  required_in_portal: boolean;
  tag: undefined;
  created_at: string;
  updated_at: string;
  removable: boolean;
  key: undefined;
  agent_description: undefined | string;
  system_field_options?: Array<{ name: string; value: string }>;
  custom_statuses?: Array<{
    url: string;
    id: number;
    status_category: string;
    agent_label: string;
    end_user_label: string;
    description: string;
    end_user_description: string;
    active: boolean;
    default: boolean;
    created_at: string;
    updated_at: string;
  }>;
  custom_field_options?: Array<{
    id: number;
    name: string;
    raw_name: string;
    value: string;
    default: boolean;
  }>;
  sub_type_id?: number;
  relationship_target_type?: string;
  relationship_filter?: { all: unknown[]; any: unknown[] };
}

export interface Attachment {
  url: string;
  id: number;
  file_name: string;
  content_url: string;
  mapped_content_url: string;
  content_type: string;
  size: number;
  width: undefined | string | number;
  height: undefined | string | number;
  inline: boolean;
  deleted: boolean;
  malware_access_override: boolean;
  malware_scan_result: string;
  thumbnails: Array<{
    url: string;
    id: number;
    file_name: string;
    content_url: string;
    mapped_content_url: string;
    content_type: string;
    size: number;
    width: number;
    height: number;
    inline: boolean;
    deleted: boolean;
    malware_access_override: boolean;
    malware_scan_result: string;
  }>;
}

export interface Comment {
  id: number;
  type: 'Comment';
  author_id: number;
  body: string;
  html_body: string;
  plain_body: string;
  public: boolean;
  attachments: Attachment[];
  audit_id: number;
  via: {
    channel: string;
    source: {
      from:
        | undefined
        | {
            address: string;
            name: string | undefined;
            organization_recipients: string[] | undefined;
          };
      to:
        | undefined
        | {
            name: string | undefined;
            address: string;
            email_ccs: number[];
          };
      rel: undefined;
    };
  };
  created_at: string;
}

// Side Conversation
export interface SideConversation {
  url: string;
  id: string;
  ticket_id: number;
  subject: string;
  preview_text: string;
  state: string;
  participants: Array<{
    user_id: number;
    group_id?: number;
    name: string;
    email: string;
  }>;
  created_at: string;
  updated_at: string;
  message_added_at: string;
  state_updated_at: string;
  external_ids: Record<string, unknown> | { targetTicketId: string };
}

export interface SideConversationAttachment {
  id: string;
  file_name: string;
  size: number;
  content_url: string;
  content_type: string;
  width: number;
  height: number;
  inline: boolean;
}

export interface SideConversationEvent {
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
  message:
    | undefined
    | {
        subject: string | undefined;
        preview_text: string;
        from: {
          user_id: number;
          group_id?: number;
          name: string;
          email: string;
        };
        to: Array<{
          user_id: number;
          group_id?: number;
          name: string;
          email: string;
        }>;
        body: string;
        html_body: string;
        external_ids: {
          ticketAuditId: string;
          targetTicketAuditId?: string;
          outboundEmail?: string;
          inboundEmail?: string;
        };
        attachments: SideConversationAttachment[];
      };
  updates: Record<string, unknown>;
  ticket_id: number;
}

// User
export interface User {
  id: number;
  name: string;
  url: string;
  email: string;
  created_at: string;
  updated_at: string;
  time_zone: string;
  iana_time_zone: string;
  phone: undefined;
  shared_phone_number: undefined;
  photo: undefined;
  locale_id: number;
  locale: string;
  organization_id: undefined | number;
  role: string;
  verified: boolean;
  external_id: undefined;
  tags: string[];
  alias: undefined;
  active: boolean;
  shared: boolean;
  shared_agent: boolean;
  last_login_at: string | undefined;
  two_factor_auth_enabled: undefined;
  signature: undefined;
  details: undefined;
  notes: undefined;
  role_type: number | undefined;
  custom_role_id: number | undefined;
  moderator: boolean;
  ticket_restriction: string | undefined;
  only_private_comments: boolean;
  restricted_agent: boolean;
  suspended: boolean;
  default_group_id: number | undefined;
  report_csv: boolean;
  user_fields: Record<string, unknown>;
}

// Group
export interface Group {
  url: string;
  id: number;
  is_public: boolean;
  name: string;
  description: string;
  default: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

// Organization
export interface Org {
  url: string;
  id: number;
  name: string;
  shared_tickets: boolean;
  shared_comments: boolean;
  external_id: undefined;
  created_at: string;
  updated_at: string;
  domain_names: string[];
  details: string;
  notes: string;
  group_id: undefined;
  tags: string[];
  organization_fields: Record<string, string | undefined>;
}
