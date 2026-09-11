import * as vscode from 'vscode';

const COMING_SOON: Array<[string, string]> = [
  ['snapframe.capture', 'Capture Selection'],
  ['snapframe.quickSnap', 'Quick Snap'],
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
    vscode.commands.registerCommand('snapframe.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:snapframe.snapframe'),
    ),
  );
}

export function deactivate(): void {}
