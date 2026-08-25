import type { StorageItemKey } from "wxt/utils/storage";

export const ACCOUNTS_STORAGE_KEY = "local:googleAccounts" satisfies StorageItemKey;
export const ACTIVE_ACCOUNT_STORAGE_KEY = "local:activeGoogleSubject" satisfies StorageItemKey;

/**
 * One home for the per-account purchase key: the purchase service writes it and
 * removing an account clears it, and two independently spelled template literals is
 * exactly how those two silently stop agreeing.
 */
export const purchaseStorageKey = (googleSubject: string) =>
  `local:purchase:${googleSubject}` satisfies StorageItemKey;

enum StorageOperation {
  read = "read",
  remove = "remove",
  write = "write"
}

// chrome.storage rejects from native code: a profile database that is full or damaged
// fails with a bare message and no stack frames at all ("FILE_ERROR_NO_SPACE",
// "Corruption: block checksum mismatch"), so nothing in the console says which read or
// write went down. Naming the operation and the key is what makes those reports say
// something; the original stays as the cause.
async function runStorageOperation<Value>({ key, operation, run }: {
  key: string;
  operation: StorageOperation;
  run: () => Promise<Value>;
}) {
  try {
    return await run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`storage ${operation} "${key}": ${reason}`, { cause: error });
  }
}

export function getStorageItem<Value>(key: StorageItemKey) {
  return runStorageOperation({
    key,
    operation: StorageOperation.read,
    run: () => storage.getItem<Value>(key)
  });
}

export function setStorageItem<Value>(key: StorageItemKey, value: Value) {
  return runStorageOperation({
    key,
    operation: StorageOperation.write,
    run: () => storage.setItem(key, value)
  });
}

export function removeStorageItem(key: StorageItemKey) {
  return runStorageOperation({
    key,
    operation: StorageOperation.remove,
    run: () => storage.removeItem(key)
  });
}
