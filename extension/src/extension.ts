import * as vscode from 'vscode';
import { runCapture, runQuickSnap } from './capture/panel';

const COMING_SOON: Array<[string, string]> = [
  ['snapframe.enterLicence', 'Enter Licence Key'],
  ['snapframe.buyPro', 'Buy Pro'],
];

export function activate(context: vscode.ExtensionContext): void {
  for (const [id, label] of COMING_SOON) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        void vscode.window.showInformationMessage(`Snapframe: ${label} is not available in this preview build yet.`);
      }),
    );
  }

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
}

export function deactivate(): void {}
