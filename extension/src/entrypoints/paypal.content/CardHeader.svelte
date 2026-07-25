<script lang="ts">
  interface Props {
    isExpanded: boolean;
    onToggle: () => void;
  }

  let { isExpanded, onToggle }: Props = $props();
</script>

<header>
  <button
    class="toggle"
    aria-expanded={isExpanded}
    aria-label={isExpanded ? "Collapse purchase panel" : "Expand purchase panel"}
    onclick={onToggle}
  >
    <span class="mark" aria-hidden="true">P</span>
    {#if isExpanded}<strong>Lifetime access</strong>{/if}
  </button>
</header>
