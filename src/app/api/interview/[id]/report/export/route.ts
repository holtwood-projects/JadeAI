import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { generatePdf } from '@/lib/pdf/generate-pdf';
import { PdfRenderBusyError, withResumePdfSlot } from '@/lib/pdf/render-limit';
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from '@/lib/rate-limit';
import { generateInterviewReportHtml } from './html';
import { dbReady } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbReady;
    const { id: sessionId } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const rate = checkRateLimit(getRateLimitKey('interview-report-export', user, request), {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

    const session = await interviewRepository.findSession(sessionId);
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const report = await interviewRepository.findReportBySessionId(sessionId);
    if (!report) {
      return NextResponse.json({ error: 'No report found' }, { status: 404 });
    }

    const html = generateInterviewReportHtml(report, session);
    // Share the same global Chromium concurrency bound as resume PDFs instead
    // of launching an unbounded number of renderers.
    const pdfBuffer = await withResumePdfSlot(() =>
      generatePdf(html, { signal: request.signal })
    );

    const title = session.jobTitle || 'interview-report';
    const date = new Date(session.createdAt).toISOString().slice(0, 10);
    const filename = `${title}-${date}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof PdfRenderBusyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': '2' } }
      );
    }
    console.error('GET /api/interview/[id]/report/export error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
