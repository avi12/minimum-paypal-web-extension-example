<script lang="ts">
  import type { GoogleAccount } from "@/lib/contracts";

  interface Props {
    accounts: GoogleAccount[];
    activeGoogleSubject: string | null;
    isBusy: boolean;
    onAddAccount: () => void;
    onRemoveAccount: (googleSubject: string) => void;
    onSelectAccount: (googleSubject: string) => void;
  }

  let {
    accounts,
    activeGoogleSubject,
    isBusy,
    onAddAccount,
    onRemoveAccount,
    onSelectAccount
  }: Props = $props();
</script>

<div class="account-switcher">
  <label for="paypal-google-account">Active Google account</label>
  <select
    id="paypal-google-account"
    disabled={isBusy}
    onchange={event =>
      onSelectAccount((event.currentTarget as HTMLSelectElement).value)}
    value={activeGoogleSubject ?? ""}
  >
    {#each accounts as account (account.googleSubject)}
      <option value={account.googleSubject}>
        {account.email ?? account.displayName ?? account.googleSubject}
      </option>
    {/each}
  </select>
  <div class="account-actions">
    <button class="secondary compact" disabled={isBusy} onclick={onAddAccount}>
      Add account
    </button>
    <button
      class="text compact"
      disabled={isBusy || !activeGoogleSubject}
      onclick={() => activeGoogleSubject && onRemoveAccount(activeGoogleSubject)}
    >
      Remove
    </button>
  </div>
</div>
