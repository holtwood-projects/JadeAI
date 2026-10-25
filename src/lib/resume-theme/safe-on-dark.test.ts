import { buildThemeCss, mergeThemeConfig, safeOnDarkColor } from '@/lib/resume-theme/build-theme-css';
import { test, expect } from 'vitest';

test('safeOnDarkColor keeps light colors and lightens dark ones', () => {
  expect(safeOnDarkColor('#22d3ee')).toBe('#22d3ee');   // neon 默认青，亮度足够
  expect(safeOnDarkColor('#3fb950')).toBe('#3fb950');   // coder 默认绿
  expect(safeOnDarkColor('#1a1a1a')).not.toBe('#1a1a1a'); // 深色被提亮
  // 提亮结果必须可读（相对亮度 ≥ 0.45）
  const lifted = safeOnDarkColor('#1a1a1a');
  const c = lifted.replace('#', '');
  const lum = [0, 2, 4].reduce((s, i) => s + [0.299, 0.587, 0.114][i / 2] * (parseInt(c.substring(i, i + 2), 16) / 255), 0);
  expect(lum).toBeGreaterThanOrEqual(0.45);
});

test('buildThemeCss emits safe-on-dark and alpha variants', () => {
  const css = buildThemeCss({ selector: '.t', template: 'neon', theme: mergeThemeConfig({ primaryColor: '#22d3ee', accentColor: '#3b82f6' }), templateSafeVariables: true });
  expect(css).toContain('--theme-primary-safe-on-dark: #22d3ee');
  expect(css).toContain('--theme-primary-alpha-60: #22d3ee60');
  expect(css).toContain('--theme-accent-alpha-40: #3b82f640');
});
