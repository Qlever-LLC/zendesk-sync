export interface Ticket {
  id: number;
  via: {
    channel: string;
    source: {
      from: {
        address: string;
        name: string;
      };
    };
  };
  type: string;
  created_at: string;
  updated_at: string;
  subject: string;
  priority: string;
  status: string;
}

export interface User {
  id: number;
  name: string;
}
export type Users = Record<number, User>;

export interface Org {
  id: number;
  author_id: number;
  html_body: string;
  attachments: Array<{
    mapped_content_url: string;
    file_name: string;
    size: number;
  }>;
}
export type Orgs = Record<number, Org>;

export interface Comment {
  id: number;
  author_id: number;
  via: {
    source: {
      to: {
        email_ccs: Array<number>;
      };
      /** @type {import('./$types').PageLoad} */
    };
  };
}

export interface Field {
  id: number;
  position: number;
  description: string;
  title: string;
  type: string;
}
export type Fields = Record<number, Field>;

export interface Group {
  description: string;
  id: number;
  name: string;
}
export type Groups = Record<number, Group>;