import { resolveFontStack } from '@/lib/font-stacks';
import { parseThemeConfig } from '@/lib/resume/parse-theme-config';
import type { Template } from '@/lib/constants';
import type { ThemeConfig } from '@/types/resume';
import { DEFAULT_THEME } from './default-theme';

/**
 * Per-template default heading colors. Templates whose section headings are
 * an identity color (not a neutral text color) register that color here so an
 * untouched resume keeps its designed look, while an explicit user color
 * still overrides it everywhere (preview, PDF, HTML). Mirrors the
 * template-styles layering already used by the DOCX exporter.
 */
export const TEMPLATE_PRIMARY_DEFAULTS: Partial<Record<Template, string>> = {
  elegant: '#d4af37',
  modern: '#e94560',
  professional: '#1e3a5f',
};

const FONT_SIZES = new Set(['small', 'medium', 'large']);
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
  'fangsong',
  'cursive',
  'math',
]);

const FORBIDDEN_FONT_STACK_PATTERN = /[;{}]|\/\*|\*\/|url\s*\(|@import|[\r\n\\'"]/i;

type MarginSide = keyof ThemeConfig['margin'];
export type ThemeConfigInput = Partial<Omit<ThemeConfig, 'margin'>> & {
  margin?: Partial<ThemeConfig['margin']>;
};

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return fallback;

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex.split('').map((char) => `${char}${char}`).join('')}`.toLowerCase();
  }

  return `#${hex}`.toLowerCase();
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function splitFontStack(fontStack: string): string[] {
  return fontStack
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeFontFamilyPart(value: string): string | null {
  const family = value.replace(/^['"]|['"]$/g, '').trim();
  if (!family || FORBIDDEN_FONT_STACK_PATTERN.test(family)) return null;
  if (!/^[\p{L}\p{N}\s._-]+$/u.test(family)) return null;

  const lower = family.toLowerCase();
  if (GENERIC_FAMILIES.has(lower)) return lower;
  if (/^[A-Za-z0-9_-]+$/.test(family)) return family;
  return `"${family}"`;
}

export function normalizeFontStack(value: unknown): string {
  const fallback = resolveFontStack(DEFAULT_THEME.fontFamily);
  if (typeof value !== 'string') return fallback;

  const resolved = resolveFontStack(value);
  const parts = splitFontStack(resolved)
    .map(normalizeFontFamilyPart)
    .filter((part): part is string => part !== null);
  if (parts.length === 0) return fallback;

  return parts.join(', ');
}

export function normalizeThemeConfig(theme?: ThemeConfigInput | null): ThemeConfig {
  // Legacy rows may hold a JSON string or an object with character keys
  // (from spreading a serialized theme). Decode before reading properties;
  // malformed values fall back to the defaults instead of throwing on read.
  let parsed: Partial<ThemeConfig> | null = null;
  try {
    parsed = parseThemeConfig(theme);
  } catch {
    parsed = null;
  }
  const source = (parsed || {}) as ThemeConfigInput;
  const marginSource: Partial<ThemeConfig['margin']> = source.margin || {};

  const margin = (['top', 'right', 'bottom', 'left'] as MarginSide[]).reduce<ThemeConfig['margin']>(
    (acc, side) => ({
      ...acc,
      [side]: normalizeNumber(marginSource[side], DEFAULT_THEME.margin[side], 0, 60),
    }),
    { ...DEFAULT_THEME.margin },
  );

  return {
    primaryColor: normalizeHexColor(source.primaryColor, DEFAULT_THEME.primaryColor),
    accentColor: normalizeHexColor(source.accentColor, DEFAULT_THEME.accentColor),
    fontFamily: normalizeFontStack(source.fontFamily),
    fontSize: typeof source.fontSize === 'string' && FONT_SIZES.has(source.fontSize)
      ? source.fontSize
      : DEFAULT_THEME.fontSize,
    lineSpacing: normalizeNumber(source.lineSpacing, DEFAULT_THEME.lineSpacing, 1, 2.5),
    margin,
    sectionSpacing: normalizeNumber(source.sectionSpacing, DEFAULT_THEME.sectionSpacing, 4, 64),
    avatarStyle: source.avatarStyle === 'circle' || source.avatarStyle === 'oneInch'
      ? source.avatarStyle
      : DEFAULT_THEME.avatarStyle,
  };
}

export function mergeThemeConfig(theme?: ThemeConfigInput | null, template?: string): ThemeConfig {
  let parsed: Partial<ThemeConfig> | null = null;
  try {
    parsed = parseThemeConfig(theme);
  } catch {
    parsed = null;
  }
  const source = (parsed || {}) as ThemeConfigInput;
  // Merge order: global default → per-template default → user input. A stored
  // themeConfig without an explicit primaryColor keeps the template's designed
  // heading color; any explicit color (user picker, preset) always wins.
  const templatePrimary = template ? TEMPLATE_PRIMARY_DEFAULTS[template as Template] : undefined;
  return normalizeThemeConfig({
    ...DEFAULT_THEME,
    ...(templatePrimary ? { primaryColor: templatePrimary } : {}),
    ...source,
    margin: {
      ...DEFAULT_THEME.margin,
      ...(source.margin || {}),
    },
  });
}
