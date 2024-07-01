<script lang="ts">
  import '../app.css';
  import {
    formatLongDate,
    formatYMD,
    formatLongDate2,
    formatYMD2,
  } from '$lib/utils';

  import type { TicketArchive } from '../../../src/types';

  import Header from '$lib/components/Header.svelte';
  import InfoBadge from '$lib/components/InfoBadge.svelte';
  import CommentHeader from '$lib/components/CommentHeader.svelte';
  import ZDComment from '$lib/components/ZDComment.svelte';
  import Attachment from '$lib/components/Attachment.svelte';

  let parent_id: string | undefined;

  // import { data } from '$lib/sample';
  // let p = new Promise<TicketArchive>((resolve) => resolve(data))
  let p = fetch('http://127.0.0.1/_data')
    .then((data) => data.json() as Promise<TicketArchive>)
    .then((data) => {
      if (typeof data.ticket.external_id === 'string') {
        let parent = data.ticket.external_id.match(/^.*:ticket:(.*)$/);
        if (parent && parent.length == 2) {
          parent_id = parent[1];
        }
      }

      return data;
    });
</script>

<div class="w-full">
  {#await p then { ticket, comments, org, fields, users, groups, sideConversations }}
    {@const participants = comments
      .map((c) => c.author_id)
      .filter((value, index, array) => array.indexOf(value) === index)}
    <div>
      <Header
        type={ticket.via.channel === 'side_conversation'
          ? 'Side Ticket'
          : 'Ticket'}
        ticketId={ticket.id}
      />

      <InfoBadge>
        {comments.length || 0} messages
      </InfoBadge>
      <InfoBadge>
        {sideConversations.length || 0} side conversations
      </InfoBadge>
      <h1 class="my-1 font-bold text-3xl">
        #{ticket.id} - {ticket.subject || 'No Subject'}
      </h1>

      <div class="stats break-inside-avoid">
        <div class="stat">
          <div class="stat-title">Status</div>
          <div class="stat-value capitalize text-primary text-lg">
            {ticket.status || 'Unknown'}
          </div>
        </div>

        <div class="stat">
          <div class="stat-title">Priority</div>
          <div class="stat-value capitalize text-secondary text-base">
            {ticket.priority}
          </div>
        </div>

        <div class="stat">
          <div class="stat-title">Opened</div>
          <div class="stat-value text-secondary text-base">
            {ticket.created_at && formatYMD(ticket.created_at)}
          </div>
        </div>

        <div class="stat">
          <div class="stat-title">Last updated</div>
          <div class="stat-value text-secondary text-base">
            {ticket.updated_at && formatYMD(ticket.updated_at)}
          </div>
        </div>
      </div>

      {#if parent_id}
        <div role="alert" class="alert bg-amber-400/45 p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-secondary-focus shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            >
            </path>
          </svg>

          <span>
            <a
              href="https://smithfield-fsqa.zendesk.com/agent/tickets/{parent_id}"
              class="text-right"
            >
              Side conversation of Ticket #{parent_id}
            </a>
          </span>
        </div>
      {/if}

      {#if 'name' in ticket.via.source.from}
        <div class="pt-1 break-inside-avoid">
          <div class="text-sm">Opened by</div>
          <p class="mt-1 mx-2">
            {ticket.via.source.from.name || ''}
            {#if ticket.via.source.from.address}
              &lt;{ticket.via.source.from.address || ''}&gt;
            {/if}
          </p>
        </div>
      {/if}

      <div class="pt-1 break-inside-avoid">
        <h1 class="text-green-900 font-bold">Assigned to</h1>
        <p class="mt-1 mx-2">
          {groups[ticket.group_id]?.name || 'Unknown'}
          /
          {users[ticket.assignee_id]?.name || 'Unknown'}
        </p>
      </div>

      <div class="pt-1 break-inside-avoid">
        <h1 class="text-green-900 font-bold">Participants</h1>
        <div class="prose">
          <ol class="">
            {#each participants as u}
              <li class="my-0">
                {users[u]?.name || 'Unknown'}
                {users[u]?.email ? `<${users[u].email}>` : ''}
              </li>
            {/each}
          </ol>
        </div>
      </div>

      <div class="pt-1 break-inside-avoid">
        <h1 class="text-green-900 font-bold">Tags</h1>
        <div class="mt-1 badge badge-lg">
          {#if ticket.tags.length > 0}
            {#each ticket.tags || [] as tag}
              {tag}
            {/each}
          {:else}
            <span class="italic">None</span>
          {/if}
        </div>
      </div>

      <div class="pt-1 break-inside-avoid">
        <h1 class="text-green-900 font-bold">Request SAP ID</h1>
        <div class="mt-1 badge badge-lg">
          {#if org}
            {org.organization_fields.sap_id || '--'}
          {:else}
            <span class="italic">None</span>
          {/if}
        </div>
      </div>

      <div class="pt-1 max-w-lg break-inside-avoid">
        <h1 class="text-green-900 font-bold mb-2">Custom Fields</h1>
        <table class="table table-xs table-zebra min-w-full">
          <tbody>
            {#each ticket.custom_fields as field}
              {@const t = fields[field.id]}
              <tr>
                <th>{t.title || ''}</th>
                <td>
                  {(t.custom_field_options &&
                    t.custom_field_options.find((f) => f.value == field.value)
                      ?.name) ||
                    '--'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="pt-2 break-inside-avoid">
        <h1 class="text-lg text-green-900 font-bold mb-2">
          Side Conversations
        </h1>
        {#if sideConversations.length > 0}
          <table class="table table-sm table-zebra w-[90%]">
            <tbody>
              {#each sideConversations as { sideConversation: conv }}
                <tr>
                  <td class="w-20">{formatYMD2(conv.created_at)}</td>

                  <td class="w-20">
                    <div class="badge badge-secondary text-white font-bold p-2">
                      {conv.state}
                    </div>
                  </td>

                  <td class="text-lg">
                    <div class="text-xs">
                      {conv.participants
                        .filter((u) => users[u.user_id])
                        .map((u) => users[u.user_id]?.name)
                        .join(', ')}
                    </div>
                    <a href={conv.url}>{conv.subject}</a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="badge badge-lg">
            <span class="italic">None</span>
          </div>
        {/if}
      </div>

      <div class="divider mx-10 mt-10" />

      <div class="flex flex-col w-full text-sm">
        <!-- <h1 class="mb-2 text-lg text-green-900 font-bold">Conversation</h1> -->
        {#each comments as comment, i}
          <article
            class="flex flex-col py-2 gap-4 max-w-[90%]"
          >
            <!-- style={`page: Comments${i}`} -->
            <CommentHeader
              author={users[comment.author_id]}
              ccs={'email_ccs' in comment.via.source.to
                ? comment.via.source.to.email_ccs.map((id) => users[id])
                : []}
              created={formatLongDate(comment.created_at)}
            />

            <div class="pl-14">
              <div class="text-left">
                <ZDComment comment={comment.html_body}></ZDComment>
              </div>

              {#if comment.attachments.length > 0}
                <div class="break-inside-avoid">
                  <h1 class="pl-4 text-md text-green-900 font-bold">
                    Attachments
                  </h1>
                  <div class="pl-10 mt-2 flex flex-wrap flex-row gap-6">
                    {#each comment.attachments as attachment}
                      <Attachment
                        url={attachment.mapped_content_url}
                        contentType={attachment.content_type}
                        filename={attachment.file_name}
                        size={attachment.size}
                        thumbnail={attachment.thumbnails.length > 0
                          ? attachment.thumbnails[0].mapped_content_url
                          : undefined}
                      />
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </article>
          {#if i !== comments.length - 1}
            <div class="divider mx-10 my-0" />
          {/if}
        {/each}
      </div>
    </div>

    {#each sideConversations as sideConvoArchive}
      {@const { sideConversation, events, users } = sideConvoArchive}
      {@const numMessages = events.filter((e) => e.message).length}
      <div class="navbar bg-base-300 flex break-inside-avoid">
        <Header
          type={'Side ' +
            ('targetTicketId' in sideConversation.external_ids
              ? 'Ticket'
              : 'E-Mail')}
          ticketId={sideConversation.ticket_id}
          sideConversationId={sideConversation.id}
        />
      </div>

      <InfoBadge>
        {numMessages} messages
      </InfoBadge>
      <h1 class="my-1 font-bold text-3xl">
        {sideConversation.subject || 'No Subject'}
      </h1>

      <div class="stats break-inside-avoid">
        <div class="stat">
          <div class="stat-title">Status</div>
          <div class="stat-value capitalize text-primary text-lg">
            {sideConversation.state || 'Unknown'}
          </div>
        </div>

        <div class="stat">
          <div class="stat-title">Opened</div>
          <div class="stat-value text-secondary text-base">
            {sideConversation.created_at &&
              formatYMD2(sideConversation.created_at)}
          </div>
        </div>

        <div class="stat">
          <div class="stat-title">Last updated</div>
          <div class="stat-value text-secondary text-base">
            {sideConversation.updated_at &&
              formatYMD2(sideConversation.updated_at)}
          </div>
        </div>
      </div>

      <div class="pt-1 break-inside-avoid">
        <h1 class="text-green-900 font-bold">Participants</h1>
        <div class="prose">
          <ol class="">
            {#each sideConversation.participants as participant}
              <li class="my-0">{participant.name} {'<'}{participant.email}></li>
            {/each}
          </ol>
        </div>
      </div>

      <div class="divider mx-10 mt-10" />

      <div class="flex flex-col w-full text-sm">
        {#each events || [] as event, i}
          {#if event.message}
            <article class="flex flex-col gap-4 pb-4 max-w-[90%]">
              <CommentHeader
                author={users[event.actor.user_id]}
                ccs={event.message.to.map((u) => users[u.user_id])}
                created={formatLongDate2(event.created_at)}
              />

              <div class="pl-14">
                <div class="text-left">
                  <ZDComment comment={event.message.html_body}></ZDComment>
                </div>

                {#if event.message.attachments.length > 0}
                  <div class="break-inside-avoid">
                    <h1 class="pl-4 text-md text-green-900 font-bold">
                      Attachments
                    </h1>
                    <div class="pl-10 mt-2 flex flex-wrap flex-row gap-6">
                      {#each event.message.attachments as attachment}
                        {#if attachment.inline === false}
                          <Attachment
                            url={attachment.content_url}
                            contentType={attachment.content_type}
                            filename={attachment.file_name}
                            size={attachment.size}
                          />
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
              {#if i !== numMessages - 1}
                <div class="divider mx-10 my-0" />
              {/if}
            </article>
          {/if}
        {/each}
      </div>
    {/each}
  {:catch e}
    <h1>Some unexpected error has occured!</h1>
    <p>{e}</p>
  {/await}
</div>

<style>
  .zd-comment div div {
    page: auto !important;
  }
</style>
