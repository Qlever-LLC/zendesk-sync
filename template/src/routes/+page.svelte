<script lang="ts">
  import prettyBytes from 'pretty-bytes';
  import { format, parse } from 'date-fns';

  let p = fetch('http://localhost/ticket-data')
    .then((d) => d.json())
    .then((d) => {
      d.test = '123';
      return d;
    })
    .catch((e) => console.log(e));

  // let p = import("./sample.js").then((d) => d.data);

  function formatLongDate(date: string): string {
    return format(
      parse(date, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()),
      "PP 'at' p"
    );
  }

  function formatYMD(date: string): string {
    return format(
      parse(date, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()),
      'MM/dd/yyyy'
    );
  }
</script>

{#await p then data}
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
      <a href="https://centricity.zendesk.com/tickets/{data.ticket.id}">
        <h1 class="text-xl capitalize font-semibold">
          {data.ticket.via.channel} Ticket #{data.ticket.id}
        </h1>
      </a>
      <p class="text-base">
        {data.ticket.via.source.from.name || ''}
      </p>
      <p class="text-sm font-light">
        {data.ticket.via.source.from.address || ''}
      </p>
    </div>
  </div>

  <h1 class="font-bold text-3xl mt-4">{data.ticket.subject}</h1>
  <p class="text-secondary">{data.comments.length} messages</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-title">Status</div>
      <div class="stat-value capitalize text-primary">{data.ticket.status}</div>
    </div>

    <div class="stat">
      <div class="stat-title">Priority</div>
      <div class="stat-value capitalize text-secondary">
        {data.ticket.priority}
      </div>
    </div>

    <div class="stat">
      <div class="stat-title">Opened</div>
      <div class="stat-value text-secondary">
        {formatYMD(data.ticket.created_at)}
      </div>
    </div>

    <div class="stat">
      <div class="stat-title">Last updated</div>
      <div class="stat-value text-secondary">
        {formatYMD(data.ticket.updated_at)}
      </div>
    </div>
  </div>

  <div class="py-2">
    <div class="text-sm">Assigned to</div>
    <p class="mt-1 mx-2">
      {data.groups[data.ticket.group_id].name}/{data.users[
        data.ticket.assignee_id
      ]?.name}
    </p>
  </div>

  <p />

  <div class="py-2">
    <div class="text-sm">Tags</div>
    {#each data.ticket.tags as tag}
      <div class="badge badge-lg">{tag}</div>
    {/each}
  </div>

  <div class="py-2">
    <div class="text-sm">Request SAP ID</div>
    {#if data.ticket.organization_id}
      <div class="badge badge-lg">
        {data.orgs[data.ticket.organization_id]?.organization_fields?.sap_id ||
          'none'}
      </div>
    {:else}
      None
    {/if}
  </div>

  <div class="py-2 max-w-lg">
    <div class="text-sm mb-2">Custom Fields</div>
    <table class="table table-xs table-zebra min-w-min">
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {#each data.ticket.custom_fields as field}
          <tr>
            <th>{data.ticketFields[field.id].title}</th>
            <td>
              {(data.ticketFields[field.id].custom_field_options || []).find(
                (f) => f.value == field.value
              )?.name || '--'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex flex-col w-full text-sm">
    {#each data.comments as comment}
      <div style="break-inside: avoid">
        <div class="divider" />
        <article class="flex">
          <div class="flex-none w-16">
            {#if data.users[comment.author_id].photo}
              <div class="avatar">
                <div class="w-12 rounded-full">
                  <img src={data.users[data.comment.author_id]?.photo} />
                </div>
              </div>
            {:else}
              <div class="avatar placeholder">
                <div
                  class="bg-accent-focus text-neutral-content rounded-full w-12"
                >
                  <span class="text-3xl">
                    {data.users[comment.author_id]?.name.substr(0, 1)}
                  </span>
                </div>
              </div>
            {/if}
          </div>

          <div class="flex-grow">
            <div class="flex flex-row">
              <span class="flex-1 text-bold">
                {data.users[comment.author_id]?.name}
                <span class="text-secondary">
                  &lt;{data.users[comment.author_id].email}&gt;
                </span>
              </span>

              <span class="flex-none items-stop"
                >{formatLongDate(comment.created_at)}</span
              >
            </div>

            <ul>
              <li>
                To: "{data.users[comment.author_id]?.name}"
                <span class="text-secondary">
                  &lt;{data.users[comment.author_id].email}&gt;
                </span>
              </li>

              {#if comment.via.source.to.email_ccs}
                <li>
                  CCs:
                  {#each comment.via.source.to.email_ccs as user, i}
                    "{data.users[user]?.name}"
                    <span class="text-secondary">
                      &lt;{data.users[user]
                        ?.email}&gt;{#if i != comment.via.source.to.email_ccs.length - 1},
                      {/if}
                    </span>
                  {/each}
                </li>
              {/if}
            </ul>

            <div class="text-left pl-5 mt-5">
              <iframe
                onload={"javascript:(function(o){o.style.height=o.contentWindow.document.documentElement.scrollHeight+'px'}(this));"}
                class="w-full"
                srcdoc={comment.html_body}
                frameborder="0"
                scrolling="no"
              />
            </div>

            {#if comment.attachments.length > 0}
              <div class="mt-4 flex flex-wrap flex-row gap-6">
                {#each comment.attachments as attachment}
                  <div>
                    <a href={attachment.mapped_content_url}>
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
