import type { Capabilities } from '../wallet/types';

// What this app does with @secondts/bark 0.28.0 (see docs/SDK_CAPABILITIES.md).
// "disabled" = present in the SDK but intentionally not executed by this app.
export const SIGNET_CAPABILITIES: Capabilities = {
  receiveArk: 'supported', // wallet.newAddress()
  sendArk: 'supported', // wallet.sendArkoorPayment()
  sync: 'supported', // wallet.sync()
  listVtxos: 'supported', // wallet.allVtxos() / vtxos()
  history: 'supported', // wallet.history()
  feeEstimate: 'supported', // wallet.estimateArkoorPaymentFee()
  exitEstimate: 'supported', // wallet.estimateEmergencyExitFee() — read-only
  exitTransactions: 'supported', // wallet.remainingExitTransactions() — read-only
  exitStatus: 'disabled', // getExitStatus exists; exits are never started by this app
  refresh: 'disabled', // refreshVtxos exists; not verified on Signet with this app yet
  offboard: 'disabled', // offboardAll / offboardVtxos exist; out of MVP scope
  exportWalletBackup: 'unsupported', // no consistent DB export/import API in the WASM SDK
};

export const DEMO_CAPABILITIES: Capabilities = {
  receiveArk: 'supported',
  sendArk: 'supported',
  sync: 'supported',
  listVtxos: 'supported',
  history: 'supported',
  feeEstimate: 'supported',
  exitEstimate: 'supported',
  exitTransactions: 'unsupported',
  exitStatus: 'unsupported',
  refresh: 'supported',
  offboard: 'unsupported',
  exportWalletBackup: 'unsupported',
};
