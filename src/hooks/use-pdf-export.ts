'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPdfSnapshot } from '@/lib/pdf/snapshot';
import { requestResumePdf } from '@/lib/pdf/request-resume-pdf';
import type { PdfLayout } from '@/lib/pdf/layout';
import type { Resume } from '@/types/resume';

/**
 * Export the current editor state as a PDF.
 *
 * The snapshot is sent by POST so unsaved edits (including drag-reordered
 * sections) are rendered without writing to the server. Editing never starts
 * a render; only an explicit export call does.
 */
export function usePdfExport(resume: Resume | null) {
  const [isExporting, setIsExporting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const resumeId = resume?.id;

  // Abort only when the exported resume identity changes. Depending on the
  // resume object itself would cancel an export when save() replaces the
  // object after its own successful PUT.
  useEffect(() => () => {
    pending.current?.abort();
  }, [resumeId]);

  const exportPdf = useCallback(
    async (filename: string, layout: PdfLayout, beforeExport?: () => Promise<void>) => {
      if (!resume) throw new Error('Resume is not loaded');
      if (pending.current) throw new Error('PDF download is already in progress');

      const controller = new AbortController();
      pending.current = controller;
      setIsExporting(true);
      try {
        await beforeExport?.();
        controller.signal.throwIfAborted();
        const result = await requestResumePdf(
          resume.id,
          createPdfSnapshot(resume),
          layout,
          {
            signal: controller.signal,
            fingerprint: localStorage.getItem('jade_fingerprint'),
          }
        );
        controller.signal.throwIfAborted();

        const url = URL.createObjectURL(result.blob);
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
        } finally {
          URL.revokeObjectURL(url);
        }
        return { fitOnePageFailed: result.fitOnePageFailed };
      } finally {
        if (pending.current === controller) pending.current = null;
        setIsExporting(false);
      }
    },
    [resume]
  );

  return { exportPdf, isExporting };
}
