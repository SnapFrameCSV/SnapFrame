/**
 * Every command the extension registers, split by tier (design §1, D05). The
 * FREE list is exactly what Slice 2 shipped and may only ever grow; a Pro
 * command's title ends in "(Pro)" so the palette says so before anyone runs
 * it. commands.test.ts checks package.json against both lists.
 */
export const FREE_COMMANDS: readonly string[] = [
  'snapframe.capture',
  'snapframe.quickSnap',
  'snapframe.openSettings',
  'snapframe.enterLicence',
  'snapframe.buyPro',
];

export const PRO_COMMANDS: readonly string[] = [
  'snapframe.captureBefore',
  'snapframe.captureAfter',
  'snapframe.captureTerminal',
  'snapframe.exportAllSelections',
  'snapframe.exportAllEditors',
  'snapframe.savePreset',
  'snapframe.applyPreset',
  'snapframe.deletePreset',
  'snapframe.exportPresets',
  'snapframe.importPresets',
];
