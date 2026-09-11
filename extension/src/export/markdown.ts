/**
 * Builds the `![alt](path)` snippet copied after an export (Pro). Paths inside
 * the workspace are made relative with forward slashes so the link works in
 * a README; anything else stays absolute. Pure, so it is unit-tested.
 */
export function markdownImageLink(altText: string, filePath: string, workspaceRoot?: string): string {
  const alt = altText.replace(/[\[\]\r\n]/g, ' ').trim() || 'code';
  let target = filePath.replace(/\\/g, '/');
  if (workspaceRoot) {
    const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    if (target.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
      target = target.slice(root.length + 1);
    }
  }
  const needsAngles = /[\s()]/.test(target);
  return `![${alt}](${needsAngles ? `<${target}>` : target})`;
}
