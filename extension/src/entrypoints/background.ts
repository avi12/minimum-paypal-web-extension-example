import { getGoogleAccounts, removeGoogleAccount, selectGoogleAccount } from "@/entrypoints/background/accounts";
import { authenticateWithGoogle } from "@/entrypoints/background/google-auth";
import { getExtensionState, refreshPurchase, startLifetimePurchase } from "@/entrypoints/background/purchase";
import { MessageType, onMessage } from "@/lib/messaging";

let operationQueue = Promise.resolve();
function runSerial<T>(operation: () => Promise<T>) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export default defineBackground(() => {
  onMessage(MessageType.GetExtensionState, () => runSerial(getExtensionState));
  onMessage(MessageType.ListGoogleAccounts, () => runSerial(getGoogleAccounts));
  onMessage(MessageType.AddGoogleAccount, () =>
    runSerial(async () => {
      await authenticateWithGoogle();
      return getExtensionState();
    }));
  onMessage(MessageType.SelectGoogleAccount, ({ data }) =>
    runSerial(async () => {
      await selectGoogleAccount(data.googleSubject);
      return getExtensionState();
    }));
  onMessage(MessageType.RemoveGoogleAccount, ({ data }) =>
    runSerial(async () => {
      await removeGoogleAccount(data.googleSubject);
      return getExtensionState();
    }));
  onMessage(MessageType.StartLifetimePurchase, () =>
    runSerial(startLifetimePurchase));
  onMessage(MessageType.RefreshPurchase, () => runSerial(refreshPurchase));
});
