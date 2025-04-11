<script lang="ts">
import prettyBytes from "pretty-bytes";

export let url: string;
export let contentType: string;
export let filename: string;
export let size: number;

export let thumbnail: string | undefined = undefined;

if (!thumbnail) {
  if (contentType === "image/png" || contentType === "image/jpeg") {
    thumbnail = url;
  }
}
</script>

<div>
  <a href={url}>
    <div class="text-primary rounded-md border border-gray-300 flex">
      <figure>
        <img
          class="h-16 m-auto p-2"
          src={thumbnail || '/attachment.png'}
          alt="Attachment"
        />
      </figure>
      <div class="bg-base-200 p-2">
        <h2 class="card-title text-base">
          {filename}
        </h2>
        <p class="text-sm">
          {prettyBytes(size)}
        </p>
      </div>
    </div>
  </a>
</div>
