import type { PageServerLoad } from './$types';
import type { Ticket, Users, Comment, Fields, Groups } from './zendesk';

export const load: PageServerLoad = async ({ fetch, url }) => {
  let ticketId = url.searchParams.get('ticketId');
  let token = url.searchParams.get('token');

  let headers = new Headers({
    Authorization: 'Basic ' + btoa(`dev_3pty@centricity.us/token:${token}`),
  });

  //////////////////
  // Fetch ticket //
  //////////////////
  let res = await fetch(
    `https://smithfield-docs.zendesk.com/api/v2/tickets/${ticketId}?include=dates,ticket_forms`,
    { headers }
  );
  let ticket = (await res.json()) as {
    ticket: Ticket;
  };

  ////////////////////
  // Fetch comments //
  ///////////////////
  // FIXME: Response can be pagignated!
  // Request the ticket comments
  res = await fetch(
    `https://smithfield-docs.zendesk.com/api/v2/tickets/${ticketId}/comments`,
    { headers }
  );
  let comments = (await res.json()) as { comments: Array<Comment> };

  /////////////////
  // Fetch users //
  /////////////////
  let ids = comments.comments
    .map((c) => [c.author_id, ...(c.via.source.to.email_ccs || [])])
    .filter((user, index, array) => array.indexOf(user) === index)
    .join(',');

  res = await fetch(
    `https://smithfield-docs.zendesk.com/api/v2/users/show_many?${new URLSearchParams(
      { ids }
    )}`,
    { headers }
  );
  let users = invertArray((await res.json()).users) as Users;

  //////////////////
  // Fetch groups //
  //////////////////
  res = await fetch(`https://smithfield-docs.zendesk.com/api/v2/groups`, {
    headers,
  });
  let groups = invertArray((await res.json()).groups) as Groups;

  //////////////////
  // Fetch fields //
  //////////////////
  res = await fetch(
    `https://smithfield-docs.zendesk.com/api/v2/ticket_fields`,
    { headers }
  );
  let fields = invertArray((await res.json()).ticket_fields) as Fields;

  return {
    ticket: ticket.ticket,
    users,
    //    orgs,
    comments: comments.comments,
    groups,
    fields,
  };
};

function invertArray(data: Array<{ id: number }>): Record<number, Object> {
  return data.reduce((cur, next) => {
    cur[next.id] = next;
    return cur;
  }, {} as Record<number, Object>);
}