import { describe, expect, it } from 'vitest';
import { generateHtml, TEMPLATE_BUILDERS } from './builders';
import { TEMPLATES } from '@/lib/constants';
import { pdfResumeFixture } from '@/lib/pdf/resume-pdf.fixtures';

describe('TEMPLATE_BUILDERS 完备性', () => {
  it('与 TEMPLATES 常量一一对应（新增模板漏配 builder 在这里与编译期都会失败）', () => {
    const keys = Object.keys(TEMPLATE_BUILDERS);
    expect(keys).toHaveLength(TEMPLATES.length);
    for (const template of TEMPLATES) {
      expect(typeof TEMPLATE_BUILDERS[template], `missing builder for ${template}`).toBe('function');
    }
  });
});

describe('generateHtml 全模板导出回归', () => {
  // 哨兵文本断言只保证「内容不被模板丢弃」，不断言具体排版——排版差异由
  // pdf-regression.test.ts 里的深度分页用例覆盖。
  it.each(TEMPLATES)('%s：姓名与 summary 末行必须进入导出 HTML', async (template) => {
    const html = await generateHtml(pdfResumeFixture(template));
    expect(html).toContain('PDF Test 陈同学');
    expect(html).toContain('LAST_LINE_SENTINEL');
  });

  it.each(TEMPLATES)('%s：qr_codes 分节标签必须进入导出 HTML', async (template) => {
    const html = await generateHtml(pdfResumeFixture(template));
    expect(html).toContain('BOTTOM_QR_SENTINEL');
  });
});
