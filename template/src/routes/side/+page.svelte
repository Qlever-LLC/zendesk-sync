<script lang="ts">
  import prettyBytes from 'pretty-bytes';
  import { formatLongDate2, formatYMD2 } from '../utils';

  let p = fetch('http://127.0.0.1/_data')
    .then((d) => d.json())
    .catch((e) => console.log(e));
</script>

{#await p then { ticket: { ticket, users, orgs, ticketFields }, side_conversation: sideConv, events }}
  <div class="navbar bg-base-300 flex">
    <div class="flex-1 flex flex-col items-start">
      <img
        class="w-28"
        alt="Powered by Trellis Automation"
        src="/trellis-logo.png"
      />
      <p>Powered by Trellis Automation</p>
    </div>

    <div class="flex-none flex flex-col items-stop">
      <a
        href="https://smithfield-docs.zendesk.com/agent/tickets/{sideConv.ticket_id}/conversations/{sideConv.id}"
      >
        <h1 class="text-xl capitalize font-semibold">
          Side conversation of Ticket #{sideConv?.ticket_id}
        </h1>
      </a>
      <p class="text-base">
        {sideConv.participants[0]?.name}
        &lt;{sideConv.participants[0]?.email}&gt;
      </p>
    </div>
  </div>

  <h1 class="font-bold text-3xl mt-4">
    {sideConv.subject || 'No Subject'}
  </h1>
  <p class="text-secondary">{events?.length || '0'} messages</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-title">Status</div>
      <div class="stat-value capitalize text-primary text-lg">
        {sideConv.state || 'Unknown'}
      </div>
    </div>

    <div class="stat">
      <div class="stat-title">Parent Ticket</div>
      <div class="stat-value capitalize text-secondary text-base">
        <div>{ticket.subject}</div>
        <div class="text-sm">#{sideConv.ticket_id}</div>
      </div>
    </div>

    <div class="stat">
      <div class="stat-title">Opened</div>
      <div class="stat-value text-secondary text-base">
        {sideConv?.created_at && formatYMD2(sideConv.created_at)}
      </div>
    </div>

    <div class="stat">
      <div class="stat-title">Last updated</div>
      <div class="stat-value text-secondary text-base">
        {sideConv.updated_at && formatYMD2(sideConv.updated_at)}
      </div>
    </div>
  </div>

  <p />

  <div class="py-2">
    <div class="text-sm">Tags</div>
    {#if ticket?.tags.length > 0}
      {#each ticket?.tags || [] as tag}
        <div class="badge badge-lg">{tag}</div>
      {/each}
    {:else}
      <div class="badge badge-lg">
        <span class="italic">None</span>
      </div>
    {/if}
  </div>

  <div class="py-2">
    <div class="text-sm">Request SAP ID</div>
    <div class="badge badge-lg">
      {#if ticket?.organization_id}
        {orgs[ticket?.organization_id]?.organization_fields?.sap_id || '--'}
      {:else}
        <span class="italic">None</span>
      {/if}
    </div>
  </div>

  <div class="py-2 max-w-lg">
    <div class="text-sm mb-2">Custom Fields</div>
    <table class="table table-xs table-zebra min-w-full">
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {#each ticket?.custom_fields as field}
          <tr>
            <th>{ticketFields[field?.id]?.title || ''}</th>
            <td>
              {(ticketFields[field?.id]?.custom_field_options || []).find(
                (f) => f.value == field.value
              )?.name || '--'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex flex-col w-full text-sm">
    {#each events || [] as event}
      <div style="break-inside: avoid">
        <div class="divider" />
        <article class="flex">
          <div class="flex-none w-16">
            {#if users[event.actor?.user_id]?.photo}
              <div class="avatar">
                <div class="w-12 rounded-full">
                  <img src={users[event.actor?.user_id].photo} />
                </div>
              </div>
            {:else}
              <div class="avatar placeholder">
                <div
                  class="bg-accent-focus text-neutral-content rounded-full w-12"
                >
                  <span class="text-3xl">
                    {(users[event.actor?.user_id]?.name || '').substr(0, 1)}
                  </span>
                </div>
              </div>
            {/if}
          </div>

          <div class="flex-grow">
            <div class="flex flex-row">
              <span class="flex-1 text-bold">
                {users[event.message?.from?.user_id]?.name || 'Unknown'}
                {#if users[event.message?.from?.author_id]?.email}
                  <span class="text-secondary">
                    &lt;{users[event.message?.from?.author_id]?.email}&gt;
                  </span>
                {/if}
              </span>

              <span class="flex-none items-stop">
                {event.created_at && formatLongDate2(event.created_at)}
              </span>
            </div>

            <ul>
              {#each event.message?.to as user, i}
                <li>
                  To: "{users[user.user_id]?.name}"
                  {#if users[user.user_id]?.email}
                    <span class="text-secondary">
                      &lt;{users[user.user_id]?.email}&gt;
                      {#if i != event.message.to.length - 1},{/if}
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>

            <div class="text-left pl-5 mt-5">
              <iframe
                onload={"javascript:(function(o){o.style.height=o.contentWindow.document.documentElement.scrollHeight+'px'}(this));"}
                class="w-full"
                srcdoc={event.message?.html_body}
                frameborder="0"
                scrolling="no"
              />
            </div>

            {#if event.message?.attachments.length > 0}
              <div class="mt-4 flex flex-wrap flex-row gap-6">
                {#each event.message?.attachments as attachment}
                  <div>
                    <a href={attachment.content_url}>
                      <div class="text-primary shadow-xl rounded-md border">
                        <figure>
                          <img
                            class="h-14 m-auto py-2"
                            src="/attachment.png"
                            alt="Attachment"
                          />
                        </figure>
                        <div class="bg-base-200 p-2">
                          <h2 class="card-title text-base">
                            {attachment.file_name}
                          </h2>
                          <p class="text-sm">{prettyBytes(attachment.size)}</p>
                        </div>
                      </div>
                    </a>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </article>
      </div>
    {/each}
  </div>

  <div class="divider" />
{/await}

<style>
  .zd-comment div div {
    page: auto !important;
  }
</style>
