import * as vscode from 'vscode';
import { runCapture, runQuickSnap } from './capture/panel';
import { enterLicence, initialiseLicence } from './licence/activate';
import { applyPreset, deletePreset, exportPresets, importPresets, savePreset } from './presets/commands';

const PRESET_COMMANDS: Array<[string, (context: vscode.ExtensionContext) => Promise<void>]> = [
  ['snapframe.savePreset', savePreset],
  ['snapframe.applyPreset', applyPreset],
  ['snapframe.deletePreset', deletePreset],
  ['snapframe.exportPresets', exportPresets],
  ['snapframe.importPresets', importPresets],
];

export function activate(context: vscode.ExtensionContext): void {
  for (const [id, run] of PRESET_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        void run(context).catch((error: unknown) => {
          void vscode.window.showErrorMessage(`Snapframe: preset command failed — ${String(error)}`);
        });
      }),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('snapframe.buyPro', () => {
      void vscode.window.showInformationMessage('Snapframe: Buy Pro is not available in this preview build yet.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snapframe.enterLicence', () => {
      void enterLicence(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(`Snapframe: could not enter the licence key — ${String(error)}`);
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snapframe.capture', () => {
      void runCapture(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(`Snapframe: capture failed — ${String(error)}`);
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snapframe.quickSnap', () => {
      void runQuickSnap(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(`Snapframe: quick snap failed — ${String(error)}`);
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snapframe.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:snapframe.snapframe'),
    ),
  );

  // Deliberately not awaited: reading SecretStorage must never delay activation.
  void initialiseLicence(context).catch(() => undefined);
}

export function deactivate(): void {}
