<script lang="ts">
  export const fixZenDeskCSS = `
    <head>
      <style type="text/css">
        img {
          max-width: 90%;
        }
          div, figure, img {
            break-inside: auto !important;
          }
      </style>
    </head>`;

  export let comment: string;
</script>

<div class="comment break-inside-auto">
  {@html comment}
</div>