<script lang="ts">
  import type { User } from '../../../../src/types';

  export let author: User;
  export let ccs: Array<User>;
  export let created: String;
</script>

<div class="flex">
  <div class="flex-none w-16">
    {#if author.photo}
      <div class="avatar">
        <div class="w-12 rounded-full">
          <img src={author.photo} alt="Author profile" />
        </div>
      </div>
    {:else}
      <div class="avatar placeholder">
        <div
          class="bg-accent opacity-75 text-neutral-content rounded-full w-10"
        >
          <span class="text-2xl font-bold">
            {(author.name || '').substr(0, 1)}
          </span>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-grow">
    <div class="flex flex-row">
      <span class="flex-1">
        <span class="font-bold">
          {author.name || 'Unknown'}
        </span>
        {#if author.email}
          <span class="text-secondary">
            &lt;{author.email}&gt;
          </span>
        {/if}
      </span>

      <span class="flex-none items-stop">
        {created}
      </span>
    </div>

    <ul>
      <li>
        CCs:
        {#if ccs.length > 0}
          {#each ccs as user, i}
            "{user.name || 'Unknown'}"
            <span class="text-secondary">
              {#if user.email}
                &lt;{user.email}&gt;
                {#if i != ccs.length - 1},{/if}
              {/if}
            </span>
          {/each}
        {:else}
          None
        {/if}
      </li>
    </ul>
  </div>
</div>
