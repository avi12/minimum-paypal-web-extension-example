import { defineExtensionMessaging } from "@webext-core/messaging";

import type { ExtensionState, GoogleAccount, PurchaseResult } from "@/lib/contracts";

export enum MessageType {
  AddGoogleAccount = "addGoogleAccount",
  GetExtensionState = "getExtensionState",
  ListGoogleAccounts = "listGoogleAccounts",
  RemoveGoogleAccount = "removeGoogleAccount",
  RefreshPurchase = "refreshPurchase",
  SelectGoogleAccount = "selectGoogleAccount",
  StartLifetimePurchase = "startLifetimePurchase"
}

interface ExtensionMessagingProtocol {
  [MessageType.AddGoogleAccount]: () => ExtensionState;
  [MessageType.GetExtensionState]: () => ExtensionState;
  [MessageType.ListGoogleAccounts]: () => GoogleAccount[];
  [MessageType.RemoveGoogleAccount]: (data: { googleSubject: string }) => ExtensionState;
  [MessageType.RefreshPurchase]: () => ExtensionState;
  [MessageType.SelectGoogleAccount]: (data: { googleSubject: string }) => ExtensionState;
  [MessageType.StartLifetimePurchase]: () => PurchaseResult;
}

export const { onMessage, sendMessage } =
  defineExtensionMessaging<ExtensionMessagingProtocol>();
