<script lang="ts">
  import { onMount } from "svelte";

  import { type ExtensionState, PaymentStatus } from "@/lib/contracts";
  import { MessageType, sendMessage } from "@/lib/messaging";
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
  let errorMessage = $state("");
  let isBusy = $state(true);
  const isPurchaseActive = $derived(
    extensionState.purchase?.status === PaymentStatus.Created
  );

  const runTask = async (task: () => Promise<ExtensionState>) => {
    isBusy = true;
    errorMessage = "";
    try {
      extensionState = await task();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Something went wrong";
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
  const startPurchase = () =>
    runTask(() => sendMessage(MessageType.StartLifetimePurchase));

  onMount(() => {
    void runTask(() => sendMessage(MessageType.GetExtensionState));
  });

  $effect(() => {
    if (!isPurchaseActive) {
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
  {errorMessage}
  {extensionState}
  {isBusy}
  onAddAccount={() => void addAccount()}
  onRefresh={() => void refreshPurchase()}
  onRemoveAccount={googleSubject => void removeAccount(googleSubject)}
  onSelectAccount={googleSubject => void selectAccount(googleSubject)}
  onStartPurchase={() => void startPurchase()}
/>
