/**
 * Which export options the free tier has and which need Pro (design §1 table,
 * D05: Pro is strictly additive — nothing in the FREE_* sets may ever move to
 * the PRO_* sets). Pure, so the gate is unit-testable without vscode.
 */

export type ExportFormat = 'png' | 'svg' | 'webp' | 'pdf';
export type ExportScale = 1 | 2 | 3 | 4;

export const FREE_FORMATS: readonly ExportFormat[] = ['png'];
export const PRO_FORMATS: readonly ExportFormat[] = ['svg', 'webp', 'pdf'];
export const FREE_SCALES: readonly ExportScale[] = [1, 2];
export const PRO_SCALES: readonly ExportScale[] = [3, 4];

export function isFormatAllowed(format: ExportFormat, pro: boolean): boolean {
  return FREE_FORMATS.includes(format) || (pro && PRO_FORMATS.includes(format));
}

/** The scale that will actually be used: Pro-only scales fall back to the largest free one. */
export function allowedScale(requested: number, pro: boolean): ExportScale {
  const scale = ([1, 2, 3, 4] as const).find((s) => s === requested) ?? 2;
  if (FREE_SCALES.includes(scale) || (pro && PRO_SCALES.includes(scale))) {
    return scale;
  }
  return 2;
}

export type BackgroundType = 'solid' | 'gradient' | 'transparent';
export const FREE_BACKGROUNDS: readonly BackgroundType[] = ['solid', 'gradient'];
export const PRO_BACKGROUNDS: readonly BackgroundType[] = ['transparent'];

/** The background type that will actually be used: Pro-only types fall back to solid. */
export function allowedBackgroundType(requested: string, pro: boolean): BackgroundType {
  const type = ([...FREE_BACKGROUNDS, ...PRO_BACKGROUNDS] as string[]).includes(requested) ? (requested as BackgroundType) : 'solid';
  if (FREE_BACKGROUNDS.includes(type) || (pro && PRO_BACKGROUNDS.includes(type))) {
    return type;
  }
  return 'solid';
}

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG',
  svg: 'SVG',
  webp: 'WebP',
  pdf: 'PDF',
};
