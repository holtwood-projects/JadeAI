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

export const CODE_NEW_ROMAN_RESOURCE_HAN_STACK =
  '"CodeNewRoman Nerd Font Mono", "Resource Han Rounded CN", "Noto Sans SC", monospace, sans-serif';
export const CHINESE_RESUME_FONT_STACK =
  '"Resource Han Rounded CN", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif';

export const DEFAULT_FONT_STACK = 'Inter';

export const FONT_STACK_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Palatino', value: 'Palatino' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Courier New', value: 'Courier New' },
  {
    label: 'CodeNewRoman + Resource Han Rounded CN',
    value: CODE_NEW_ROMAN_RESOURCE_HAN_STACK,
  },
  {
    label: 'Resource Han Rounded CN + Noto Sans SC',
    value: CHINESE_RESUME_FONT_STACK,
  },
] as const;

// Generic families come before the bundled CJK fallback: Noto Sans SC also
// covers Latin, so placing it first made Georgia/Times render sans-serif and
// Courier New render proportional in the Docker PDF image. The browser still
// falls through to Noto for CJK when the system generic family has no glyphs.
const LEGACY_FONT_STACKS: Record<string, string> = {
  Inter: 'Inter, sans-serif, "Noto Sans SC"',
  Georgia: 'Georgia, serif, "Noto Sans SC"',
  Helvetica: 'Helvetica, Arial, sans-serif, "Noto Sans SC"',
  Arial: 'Arial, Helvetica, sans-serif, "Noto Sans SC"',
  Palatino: 'Palatino, "Palatino Linotype", serif, "Noto Sans SC"',
  Verdana: 'Verdana, Geneva, sans-serif, "Noto Sans SC"',
  'Times New Roman': '"Times New Roman", Georgia, serif, "Noto Sans SC"',
  Garamond: 'Garamond, Georgia, serif, "Noto Sans SC"',
  'Courier New': '"Courier New", monospace, "Noto Sans SC"',
};

// Stacks persisted by earlier fork versions; remap them so saved resumes keep
// the corrected fallback order instead of staying on the old broken stack.
const LEGACY_EXPANDED_STACKS: Record<string, string> = {
  'Inter, "Noto Sans SC", sans-serif': LEGACY_FONT_STACKS.Inter,
  // normalizeFontStack() quotes a single-word family before persisting it.
  '"Inter", "Noto Sans SC", sans-serif': LEGACY_FONT_STACKS.Inter,
  'Georgia, "Noto Sans SC", serif': LEGACY_FONT_STACKS.Georgia,
  'Helvetica, Arial, "Noto Sans SC", sans-serif': LEGACY_FONT_STACKS.Helvetica,
  'Arial, Helvetica, "Noto Sans SC", sans-serif': LEGACY_FONT_STACKS.Arial,
  'Palatino, "Palatino Linotype", "Noto Sans SC", serif': LEGACY_FONT_STACKS.Palatino,
  'Verdana, Geneva, "Noto Sans SC", sans-serif': LEGACY_FONT_STACKS.Verdana,
  '"Times New Roman", Georgia, "Noto Sans SC", serif': LEGACY_FONT_STACKS['Times New Roman'],
  'Garamond, Georgia, "Noto Sans SC", serif': LEGACY_FONT_STACKS.Garamond,
  '"Courier New", "Noto Sans SC", monospace': LEGACY_FONT_STACKS['Courier New'],
};

function escapeFontUrl(value: string): string {
  return value.replace(/'/g, "\\'");
}

export function getEmbeddedFontFacesCss(fontBaseUrl = ''): string {
  const prefix = fontBaseUrl.replace(/\/$/, '');
  const asset = (path: string) => `${prefix}${path}`;

  return `
    @font-face {
      font-family: 'Inter';
      src: url('${escapeFontUrl(asset('/fonts/InterVariable.woff2'))}') format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Regular.otf'))}') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Bold.otf'))}') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Italic.otf'))}') format('opentype');
      font-weight: 400;
      font-style: italic;
      font-display: swap;
    }
    @font-face {
      font-family: 'Resource Han Rounded CN';
      src: url('${escapeFontUrl(asset('/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Regular.ttf'))}') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Resource Han Rounded CN';
      src: url('${escapeFontUrl(asset('/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Bold.ttf'))}') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Noto Sans SC';
      src: url('${escapeFontUrl(asset('/fonts/NotoSansSC-Regular.otf'))}') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Noto Sans SC';
      src: url('${escapeFontUrl(asset('/fonts/NotoSansSC-Bold.otf'))}') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
  `;
}

export function resolveFontStack(fontFamily?: string): string {
  const value = fontFamily?.trim();
  if (!value) return LEGACY_FONT_STACKS[DEFAULT_FONT_STACK];
  return LEGACY_FONT_STACKS[value] || LEGACY_EXPANDED_STACKS[value] || value;
}

export function splitFontFamilyStack(fontFamily?: string): string[] {
  const stack = resolveFontStack(fontFamily);
  return stack
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// Fonts shipped inside the app are not installed on the viewer's machine, so
// Word would silently substitute them. DOCX must use system families instead.
const BUNDLED_FONT_FAMILIES = new Set([
  'CodeNewRoman Nerd Font Mono',
  'Resource Han Rounded CN',
  'Noto Sans SC',
]);

export function resolveDocxFonts(fontFamily?: string): { west: string; east: string } {
  const families = splitFontFamilyStack(fontFamily).filter(
    (family) => !GENERIC_FAMILIES.has(family.toLowerCase())
  );
  const systemFamilies = families.filter(
    (family) => !BUNDLED_FONT_FAMILIES.has(family)
  );
  const isEastAsianFamily = (family: string) =>
    /Han|Noto Sans SC|YaHei|HarmonyOS|GenSen|Source Han|Rounded CN|PingFang|Hei|Song|Kai|Fang/i.test(family);

  const west =
    systemFamilies.find((family) => !isEastAsianFamily(family))
    || systemFamilies[0]
    || 'Calibri';
  // Microsoft YaHei is present on Windows and is the conventional eastAsia
  // fallback; bundled fonts would be replaced unpredictably by Word.
  const east =
    systemFamilies.find((family) => isEastAsianFamily(family))
    || 'Microsoft YaHei';

  return { west, east };
}
