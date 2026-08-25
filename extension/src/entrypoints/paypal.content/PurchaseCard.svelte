<script lang="ts">
  import type { ExtensionState } from "@/lib/contracts";
  import type { PaymentErrorKind } from "@/lib/payment-error";
  import AccountSwitcher from "./AccountSwitcher.svelte";
  import CardHeader from "./CardHeader.svelte";
  import { PAYMENT_ERROR_COPY } from "./payment-error-copy";
  import PurchaseStatus from "./PurchaseStatus.svelte";

  interface Props {
    isBusy: boolean;
    onAddAccount: () => void;
    onRefresh: () => void;
    onRemoveAccount: (googleSubject: string) => void;
    onSelectAccount: (googleSubject: string) => void;
    onStartPurchase: () => void;
    paymentErrorKind: PaymentErrorKind | null;
    extensionState: ExtensionState;
  }

  let {
    isBusy,
    onAddAccount,
    onRefresh,
    onRemoveAccount,
    onSelectAccount,
    onStartPurchase,
    paymentErrorKind,
    extensionState
  }: Props = $props();
  let isExpanded = $state(true);
  const errorCopy = $derived(
    paymentErrorKind ? PAYMENT_ERROR_COPY[paymentErrorKind] : null
  );
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
        {paymentErrorKind}
        state={extensionState}
      />
      {#if isBusy}<output class="progress">Checking securely</output>{/if}
      {#if errorCopy}
        <output class="error">
          <strong>{errorCopy.title}</strong>
          {errorCopy.message}
        </output>
      {/if}
    </section>
  {/if}
</aside>
