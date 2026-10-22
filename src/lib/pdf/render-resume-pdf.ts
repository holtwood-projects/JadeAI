import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import type { ResumeWithSections } from '@/app/api/resume/[id]/export/utils';
import { normalizeSections } from '@/lib/resume/normalize-content';
import { generatePdf } from './generate-pdf';
import type { PdfLayout } from './layout';
import { withResumePdfSlot } from './render-limit';
import * as mupdf from 'mupdf';

function removeTrailingBlankPages(buffer: Buffer): Buffer {
  let document: mupdf.Document;
  try { document = mupdf.Document.openDocument(buffer, 'application/pdf'); }
  catch { return buffer; }
  try {
    const pdf = document.asPDF();
    if (!pdf) return buffer;
    let changed = false;
    while (pdf.countPages() > 1) {
      const page = pdf.loadPage(pdf.countPages() - 1);
      let blank = false;
      try {
        const text = page.toStructuredText();
        try { blank = text.asText().trim().length === 0; }
        finally { text.destroy(); }
        if (!blank) break;

        // Preserve image-only and background-only pages. A genuinely blank
        // trailing Chromium page renders white at this low inspection scale.
        const pixmap = page.toPixmap(mupdf.Matrix.scale(0.05, 0.05), mupdf.ColorSpace.DeviceRGB, false);
        try {
          const pixels = pixmap.getPixels();
          for (let index = 0; index < pixels.length; index += pixmap.getNumberOfComponents()) {
            if (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250) {
              blank = false;
              break;
            }
          }
        } finally { pixmap.destroy(); }
      } finally { page.destroy(); }
      if (!blank) break;
      pdf.deletePage(pdf.countPages() - 1);
      changed = true;
    }
    if (!changed) return buffer;
    return Buffer.from(pdf.saveToBuffer('garbage=4,deflate').asUint8Array());
  } finally { document.destroy(); }
}

/** Shared by persisted exports and snapshot previews. Never mutates input. */
export async function renderResumePdf(
  resume: ResumeWithSections,
  layout: PdfLayout = 'a4',
  fontBaseUrl = '',
  signal?: AbortSignal,
  onPaginationResult?: (result: import('./pagination-strategy').PaginationStrategyResult) => void,
): Promise<Buffer> {
  signal?.throwIfAborted();
  return withResumePdfSlot(async () => {
    const snapshot = structuredClone(resume);
    snapshot.sections = normalizeSections(snapshot.sections);
    // The fork injects absolute font URLs; the PR's two-argument call would
    // leave relative /fonts/... paths unresolved against about:blank.
    const html = await generateHtml(
      snapshot,
      layout === 'continuous' ? 'continuous' : true,
      fontBaseUrl,
    );
    signal?.throwIfAborted();
    const pdf = await generatePdf(html, {
      layout,
      ...(signal ? { signal } : {}),
      ...(onPaginationResult ? { onPaginationResult } : {}),
    });
    return layout === 'continuous' ? removeTrailingBlankPages(pdf) : pdf;
  });
}
