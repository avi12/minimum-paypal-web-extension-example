<script lang="ts">
  import type { ExtensionState } from "@/lib/contracts";
  import AccountSwitcher from "./AccountSwitcher.svelte";
  import CardHeader from "./CardHeader.svelte";
  import PurchaseStatus from "./PurchaseStatus.svelte";

  interface Props {
    errorMessage: string;
    isBusy: boolean;
    onAddAccount: () => void;
    onRefresh: () => void;
    onRemoveAccount: (googleSubject: string) => void;
    onSelectAccount: (googleSubject: string) => void;
    onStartPurchase: () => void;
    extensionState: ExtensionState;
  }

  let {
    errorMessage,
    isBusy,
    onAddAccount,
    onRefresh,
    onRemoveAccount,
    onSelectAccount,
    onStartPurchase,
    extensionState
  }: Props = $props();
  let isExpanded = $state(true);
</script>

<aside class:collapsed={!isExpanded} aria-label="Lifetime access purchase">
  <CardHeader {isExpanded} onToggle={() => (isExpanded = !isExpanded)} />

  {#if isExpanded}
    <section>
      {#if extensionState.user}
        <AccountSwitcher
          accounts={extensionState.accounts}
          activeGoogleSubject={extensionState.activeGoogleSubject}
          {isBusy}
          {onAddAccount}
          {onRemoveAccount}
          {onSelectAccount}
        />
      {/if}
      <PurchaseStatus
        {isBusy}
        {onAddAccount}
        {onRefresh}
        {onStartPurchase}
        state={extensionState}
      />
      {#if isBusy}<output class="progress">Checking securely</output>{/if}
      {#if errorMessage}<output class="error">{errorMessage}</output>{/if}
    </section>
  {/if}
</aside>
