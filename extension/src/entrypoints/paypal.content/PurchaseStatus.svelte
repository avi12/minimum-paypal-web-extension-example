<script lang="ts">
  import { type ExtensionState, PaymentStatus } from "@/lib/contracts";
  import { PaymentErrorKind } from "@/lib/payment-error";
  import { PAYMENT_ERROR_COPY } from "./payment-error-copy";

  interface Props {
    isBusy: boolean;
    onAddAccount: () => void;
    onRefresh: () => void;
    onStartPurchase: () => void;
    paymentErrorKind: PaymentErrorKind | null;
    state: ExtensionState;
  }

  let {
    isBusy,
    onAddAccount,
    onRefresh,
    onStartPurchase,
    paymentErrorKind,
    state
  }: Props = $props();
  const isCancelled = $derived(
    state.purchase?.status === PaymentStatus.Cancelled
  );
  const errorCopy = $derived(
    paymentErrorKind ? PAYMENT_ERROR_COPY[paymentErrorKind] : null
  );
  // A region PayPal will not serve does not get better by pressing the button again,
  // and neither does access this account already has - offering the same button for
  // both is what made every refusal look like the member's problem to solve.
  const isRetryPointless = $derived(errorCopy !== null && !errorCopy.canRetry);
</script>

{#if state.isEntitled}
  <p class="eyebrow">Payment complete</p>
  <h2>You own it for life</h2>
  <p>Your access is ready on every signed-in device</p>
{:else if state.user}
  <p class="eyebrow">One payment</p>
  <h2>Keep it forever</h2>
  <p class="account">Signed in as {state.user.email}</p>
  {#if isCancelled}<output>Order cancelled</output>{/if}
  {#if isRetryPointless}
    {#if paymentErrorKind === PaymentErrorKind.alreadyOwned}
      <button class="secondary" disabled={isBusy} onclick={onRefresh}>
        Refresh status
      </button>
    {/if}
  {:else if state.purchase && !isCancelled}
    <output>Order {state.purchase.status.toLowerCase()}</output>
    <button class="secondary" disabled={isBusy} onclick={onRefresh}>
      Refresh status
    </button>
  {:else}
    <button class="primary" disabled={isBusy} onclick={onStartPurchase}>
      {errorCopy ? "Try again" : "Buy lifetime with PayPal"}
    </button>
  {/if}
{:else}
  <p class="eyebrow">Secure checkout</p>
  <h2>Lifetime means lifetime</h2>
  <p>Sign in, approve PayPal, and you are set</p>
  <button class="primary" disabled={isBusy} onclick={onAddAccount}>
    Continue with Google
  </button>
{/if}
