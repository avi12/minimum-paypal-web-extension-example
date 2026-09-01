<script lang="ts">
  import { onMount } from "svelte";

  import { type ExtensionState, PaymentStatus } from "@/lib/contracts";
  import { MessageType, sendMessage } from "@/lib/messaging";
  import {
    isBrowserTeardown,
    isUserCancelledAuthFlow,
    type PaymentErrorKind,
    toPaymentErrorKind
  } from "@/lib/payment-error";
  import PurchaseCard from "./PurchaseCard.svelte";

  const POLL_INTERVAL_MILLISECONDS = 4_000;
  const EMPTY_STATE: ExtensionState = {
    accounts: [],
    activeGoogleSubject: null,
    isEntitled: false,
    purchase: null,
    user: null
  };

  let extensionState = $state<ExtensionState>(EMPTY_STATE);
  let paymentErrorKind = $state<PaymentErrorKind | null>(null);
  let isBusy = $state(true);
  let isExtensionTornDown = $state(false);
  const isPurchaseActive = $derived(
    extensionState.purchase?.status === PaymentStatus.Created
  );

  const runTask = async (task: () => Promise<ExtensionState>) => {
    isBusy = true;
    paymentErrorKind = null;
    try {
      extensionState = await task();
    } catch (error) {
      // A browser reloading or closing the extension ends this script rather than the
      // purchase, and it never comes back for this page: every later call throws the
      // same way. Remembering that is what stops the status poll below from asking a
      // worker that is gone every four seconds for as long as the tab stays open.
      if (isBrowserTeardown(error)) {
        isExtensionTornDown = true;
        return;
      }

      // Backing out of a sign-in window is a decision, not a failure - showing an
      // error screen for it would tell the member something went wrong when nothing did.
      if (isUserCancelledAuthFlow(error)) {
        return;
      }

      console.error("Extension task failed", error);
      paymentErrorKind = toPaymentErrorKind(error);
    } finally {
      isBusy = false;
    }
  };

  const refreshPurchase = () =>
    runTask(() => sendMessage(MessageType.RefreshPurchase));
  const addAccount = () =>
    runTask(() => sendMessage(MessageType.AddGoogleAccount));
  const selectAccount = (googleSubject: string) =>
    runTask(() =>
      sendMessage(MessageType.SelectGoogleAccount, { googleSubject }));
  const removeAccount = (googleSubject: string) =>
    runTask(() =>
      sendMessage(MessageType.RemoveGoogleAccount, { googleSubject }));

  // The purchase answers with a kind instead of throwing, because a refused checkout
  // still has state worth painting and an error crossing the messaging boundary would
  // arrive stripped of everything but its message.
  const startPurchase = () =>
    runTask(async () => {
      const result = await sendMessage(MessageType.StartLifetimePurchase);
      paymentErrorKind = result.errorKind;
      return result.state ?? extensionState;
    });

  onMount(() => {
    void runTask(() => sendMessage(MessageType.GetExtensionState));
  });

  $effect(() => {
    if (!isPurchaseActive || isExtensionTornDown) {
      return;
    }
    let isCancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        await refreshPurchase();
      }
      if (!isCancelled) {
        timeout = setTimeout(() => void poll(), POLL_INTERVAL_MILLISECONDS);
      }
    };
    timeout = setTimeout(() => void poll(), POLL_INTERVAL_MILLISECONDS);
    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  });
</script>

<PurchaseCard
  {extensionState}
  {isBusy}
  onAddAccount={() => void addAccount()}
  onRefresh={() => void refreshPurchase()}
  onRemoveAccount={googleSubject => void removeAccount(googleSubject)}
  onSelectAccount={googleSubject => void selectAccount(googleSubject)}
  onStartPurchase={() => void startPurchase()}
  {paymentErrorKind}
/>
