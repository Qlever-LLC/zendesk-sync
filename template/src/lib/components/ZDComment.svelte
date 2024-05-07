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

  comment = comment.replace(/page: [a-zA-Z0-9_.-]+;/, '');
</script>

<div class="comment break-inside-auto">
  {@html comment}
</div>
