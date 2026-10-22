
import { generatePdfHtml } from '@/app/api/resume/[id]/export/builders';
import { generatePdf, resolveBrowserLaunchPlan } from '@/lib/pdf/generate-pdf';
import { PDF_SAFE_PAGE_MARGIN_PX } from '@/lib/pdf/page-margins';
import type { PaginationStrategyResult } from '@/lib/pdf/pagination-strategy';

import {
  getPdfRegressionFixture,
  type PdfRegressionFixtureName,
} from './__fixtures__/resume-fixtures';
import { describe, expect, it } from 'vitest';

interface PdfArtifact {
  pageCount: number;
  pages: string[];
  text: string;
  paginationResult?: PaginationStrategyResult;
}

const artifactCache = new Map<string, Promise<PdfArtifact>>();
const TEST_FONT_BASE_URL = 'http://jadeai.test';
const PDF_RENDERER_SKIP_REASON = getPdfRendererSkipReason();

function getPdfRendererSkipReason(): string | undefined {
  try {
    resolveBrowserLaunchPlan();
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No local Chrome/Chromium executable found')) {
      return message;
    }

    throw error;
  }
}

// Real Chromium rendering is slow and variable on shared CI runners (each
// generatePdf call cold-launches a browser), so give renderer tests a generous
// timeout instead of relying on the 5s default.
const PDF_RENDERER_TEST_TIMEOUT = 60_000;

function testWithPdfRenderer(
  name: string,
  fn: () => Promise<void>,
): void {
  if (PDF_RENDERER_SKIP_REASON) {
    it(name, { skip: Boolean(PDF_RENDERER_SKIP_REASON), timeout: PDF_RENDERER_TEST_TIMEOUT }, fn);
    return;
  }
  it(name, fn, PDF_RENDERER_TEST_TIMEOUT);
}

async function renderPdfArtifact(
  fixtureName: PdfRegressionFixtureName,
  options: { fitOnePage?: boolean } = {},
): Promise<PdfArtifact> {
  const key = `${fixtureName}:${options.fitOnePage ? 'fit' : 'default'}`;
  const cached = artifactCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const resume = getPdfRegressionFixture(fixtureName);
    const html = await generatePdfHtml(resume as any, TEST_FONT_BASE_URL);
    let paginationResult: PaginationStrategyResult | undefined;
    const buffer = await generatePdf(html, {
      ...options,
      onPaginationResult: (result) => {
        paginationResult = result;
      },
    });
    const mupdf = await import('mupdf');
    const document = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
    const pageCount = document.countPages();
    const pages: string[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.loadPage(pageIndex);
      pages.push(page.toStructuredText('preserve-whitespace').asText().trim());
    }

    return {
      pageCount,
      pages,
      text: pages.join('\n').trim(),
      paginationResult,
    };
  })();

  artifactCache.set(key, pending);
  return pending;
}

describe('pdf regression suite', () => {
  testWithPdfRenderer('fitOnePage compresses modern long content onto a single page', async () => {
    const defaultArtifact = await renderPdfArtifact('modern-long-content');
    const fitArtifact = await renderPdfArtifact('modern-long-content', { fitOnePage: true });

    expect(defaultArtifact.pageCount > 1).toBeTruthy();
    expect(fitArtifact.pageCount).toBe(1);
    expect(fitArtifact.text).toMatch(/Modern Fit Marker Project/);
  });

  testWithPdfRenderer('fitOnePage emits pagination telemetry', async () => {
    const resume = getPdfRegressionFixture('modern-long-content');
    const html = await generatePdfHtml(resume as any, TEST_FONT_BASE_URL);
    let paginationResult: PaginationStrategyResult | undefined;

    await generatePdf(html, {
      fitOnePage: true,
      onPaginationResult: (result) => {
        paginationResult = result;
      },
    });

    expect(paginationResult?.mode).toBe('fit-one-page');
    expect(paginationResult?.success).toBe(true);
    expect((paginationResult?.iterations ?? 0) > 0).toBeTruthy();
    expect((paginationResult?.usableHeight ?? 0) > 0).toBeTruthy();
  });

  testWithPdfRenderer('sidebar layout avoids a near-blank trailing page', async () => {
    const artifact = await renderPdfArtifact('sidebar-long-content');
    expect(artifact.text).toMatch(/Edge Rollout Program Marker/);

    if (artifact.pageCount > 1) {
      expect(artifact.pages.at(-1) || '').toMatch(/Edge Rollout Program Marker/);
    }
  });

  testWithPdfRenderer('swiss layout no longer defers the marker role to the next page', async () => {
    const artifact = await renderPdfArtifact('swiss-page-gap');
    expect(artifact.pageCount >= 3).toBeTruthy();
    expect(artifact.pages[0] || '').toMatch(/全栈工程师/);
  });

  it('swiss export widens section headers for page-top fragments', async () => {
    const resume = getPdfRegressionFixture('swiss-page-gap');
    const html = await generatePdfHtml(resume as any, TEST_FONT_BASE_URL);
    expect(html).toMatch(/data-section-heading="wide"/);
    expect(html).toMatch(/margin-left:calc\(-1 \* min\(10px, var\(--base-margin-left/);
  });

  testWithPdfRenderer('gradient export reserves physical page safe margins', async () => {
    const resume = getPdfRegressionFixture('gradient-page-margin');
    const html = await generatePdfHtml(resume as any, TEST_FONT_BASE_URL);

    expect(html).toMatch(/@page \{\s*size: A4;\s*margin: 10mm 0 10mm 0;/);
    expect(html).toMatch(new RegExp(`--pdf-page-margin-top: ${PDF_SAFE_PAGE_MARGIN_PX}px;`));
    expect(html).toMatch(new RegExp(`--pdf-page-margin-bottom: ${PDF_SAFE_PAGE_MARGIN_PX}px;`));
    expect(html).toMatch(/span\[class\*="rounded-full"\] \{ break-inside: avoid !important; \}/);

    const artifact = await renderPdfArtifact('gradient-page-margin');
    expect(artifact.text).toMatch(/后端 & 数据中间件/);
    expect(artifact.text).toMatch(/Gradient Page Safe Margin Marker/);

    expect((artifact.paginationResult?.usableHeight ?? Number.POSITIVE_INFINITY) <=
        1123 - PDF_SAFE_PAGE_MARGIN_PX * 2).toBeTruthy();
  });

  testWithPdfRenderer('two-column fixture keeps extractable semantic text', async () => {
    const artifact = await renderPdfArtifact('two-column-balanced');
    expect(artifact.pageCount >= 1).toBeTruthy();
    expect(artifact.text).toMatch(/Systems Narrative Anchor/);
  });

  testWithPdfRenderer('compact fixture renders dense content without dropping anchors', async () => {
    const artifact = await renderPdfArtifact('compact-dense');
    expect(artifact.pageCount >= 1).toBeTruthy();
    expect(artifact.text).toMatch(/Compact Density Review Marker/);
  });

  testWithPdfRenderer('neon dark fixture stays text-extractable', async () => {
    const artifact = await renderPdfArtifact('neon-dark-background');
    expect(artifact.pageCount >= 1).toBeTruthy();
    expect(artifact.text).toMatch(/Neon Dark Mode Portfolio/);
    expect(artifact.text).toMatch(/多语言导出稳定性验证/);
  });
});
