import * as vscode from 'vscode';
import { licencePublicKey } from './publicKey';
import { describeFailure, setActiveLicence, verifyKey, type VerifyResult } from './verify';

/** SecretStorage slot for the pasted key (encrypted by the OS keychain via VS Code). */
export const LICENCE_SECRET_KEY = 'snapframe.licenceKey';

let statusItem: vscode.StatusBarItem | undefined;

/**
 * On activation: read any stored key, verify it offline and light up the
 * "Snapframe Pro" status-bar item. Also re-checks when the secret changes
 * (Settings Sync can bring a key in from another machine).
 */
export async function initialiseLicence(context: vscode.ExtensionContext): Promise<void> {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  statusItem.text = 'Snapframe Pro';
  statusItem.tooltip = 'Snapframe Pro is active on this machine';
  statusItem.command = 'snapframe.openSettings';
  context.subscriptions.push(statusItem);
  context.subscriptions.push(
    context.secrets.onDidChange(async (event) => {
      if (event.key === LICENCE_SECRET_KEY) {
        applyKey(await context.secrets.get(LICENCE_SECRET_KEY));
      }
    }),
  );
  applyKey(await context.secrets.get(LICENCE_SECRET_KEY));
}

function applyKey(key: string | undefined): VerifyResult {
  const publicKey = licencePublicKey();
  if (!publicKey || !key) {
    setActiveLicence(null);
    statusItem?.hide();
    return { ok: false, reason: publicKey ? 'malformed' : 'no-public-key' };
  }
  const result = verifyKey(key, publicKey);
  setActiveLicence(result.ok && result.payload ? result.payload : null);
  if (result.ok) {
    statusItem?.show();
  } else {
    statusItem?.hide();
  }
  return result;
}

/** `snapframe.enterLicence`: input box → verify → store → status bar. Nothing is sent anywhere. */
export async function enterLicence(context: vscode.ExtensionContext): Promise<void> {
  const publicKey = licencePublicKey();
  if (!publicKey) {
    void vscode.window.showInformationMessage('Snapframe: Pro keys cannot be activated in this preview build yet.');
    return;
  }
  const input = await vscode.window.showInputBox({
    title: 'Snapframe: Enter Licence Key',
    prompt: 'Paste the key from your purchase page. It is checked on this machine only.',
    placeHolder: 'SNAP-…',
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().startsWith('SNAP-') ? null : 'Snapframe keys start with SNAP-'),
  });
  if (!input) {
    return;
  }
  const key = input.trim();
  const result = verifyKey(key, publicKey);
  if (!result.ok) {
    void vscode.window.showErrorMessage(`Snapframe: that key was not accepted — ${describeFailure(result.reason)}.`);
    return;
  }
  await context.secrets.store(LICENCE_SECRET_KEY, key);
  applyKey(key);
  void vscode.window.showInformationMessage('Snapframe Pro is active. Thank you!');
}
