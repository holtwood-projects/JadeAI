
import {
  CHINESE_RESUME_FONT_STACK,
  FONT_STACK_OPTIONS,
  resolveDocxFonts,
  resolveFontStack,
} from './font-stacks';
import { test, expect } from 'vitest';

test('Chinese resume font stack is available for PDF and DOCX exports', () => {
  expect(FONT_STACK_OPTIONS.some((option) => option.value === CHINESE_RESUME_FONT_STACK)).toBeTruthy();
  expect(resolveFontStack(CHINESE_RESUME_FONT_STACK)).toBe(CHINESE_RESUME_FONT_STACK);
  // Bundled families are not installed on the viewer's machine; DOCX must
  // fall back to a system CJK family instead of embedding an unusable name.
  expect(resolveDocxFonts(CHINESE_RESUME_FONT_STACK)).toEqual({
    west: 'Microsoft YaHei',
    east: 'Microsoft YaHei',
  });
});

test('generic families precede the bundled CJK fallback for serif and monospace', () => {
  expect(resolveFontStack('Georgia')).toBe('Georgia, serif, "Noto Sans SC"');
  expect(resolveFontStack('Times New Roman')).toBe('"Times New Roman", Georgia, serif, "Noto Sans SC"');
  expect(resolveFontStack('Courier New')).toBe('"Courier New", monospace, "Noto Sans SC"');
  // Stacks persisted by earlier fork versions are remapped.
  expect(resolveFontStack('Georgia, "Noto Sans SC", serif'))
    .toBe('Georgia, serif, "Noto Sans SC"');
});

test('DOCX font resolution keeps Latin west font when stack mixes Chinese and generic families', () => {
  expect(resolveDocxFonts('sans-serif, "Noto Sans SC", Inter')).toEqual({
    west: 'Inter',
    east: 'Microsoft YaHei',
  });
  expect(resolveDocxFonts('Inter, "Noto Sans SC", sans-serif')).toEqual({
    west: 'Inter',
    east: 'Microsoft YaHei',
  });
});

test('DOCX font resolution falls back to first non-generic family for both west/east when only one family is provided', () => {
  expect(resolveDocxFonts('"PingFang SC", sans-serif')).toEqual({
    west: 'PingFang SC',
    east: 'PingFang SC',
  });
});
