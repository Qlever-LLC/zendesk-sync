<script lang="ts">
  export let type: string;
  export let ticketId: number | string;
  export let sideConversationId: string | undefined = undefined;
</script>

<div class="navbar bg-base-300 flex break-before-page break-after-avoid">
  <div class="flex-1 flex flex-col items-start">
    <img
      class="w-28"
      alt="Powered by Trellis Automation"
      src="/trellis-logo.png"
    />
    <p>Powered by Trellis Automation</p>
  </div>

  <div class="flex-none flex flex-col items-stop text-right">
    <a
      href={`https://smithfield-fsqa.zendesk.com/agent/tickets/${ticketId}` +
        (sideConversationId ? `/conversations/${sideConversationId}` : '')}
    >
      <h1 class="text-xl capitalize font-semibold">
        {type}
      </h1>
    </a>
    <a href="https://smithfield-fsqa.zendesk.com/agent/tickets/{ticketId}">
      <h2 class="text-base text-right">
        #{ticketId}
      </h2>
    </a>
  </div>
</div>
