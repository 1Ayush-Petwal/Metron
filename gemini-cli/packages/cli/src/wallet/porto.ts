/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type {
  WalletChainSetting,
  WalletIdentityRecord,
  BudgetPromptState,
  SessionBudgetSnapshot,
} from './porto/types.js';
export {
  getPendingBudgetPrompt,
  clearPendingBudgetPrompt,
  readStoredWalletIdentity,
  clearStoredWalletIdentity,
  getSessionBudgetSnapshot,
} from './porto/state.js';
export {
  setSessionBudgetLimitUSDC,
  applySessionBudgetSelection,
  ensureSessionBudgetFundedUSDC,
  registerSessionSpend,
} from './porto/funding.js';
export {
  connectPortoWallet,
  maybeAutoConnectWallet,
  getWalletClient,
  getEphemeralWalletClient,
  getEphemeralAccount,
  ensureWalletDialogOpen,
} from './porto/connection.js';
