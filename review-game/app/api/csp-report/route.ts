import { logger } from '@/lib/logger';

interface CspReportBody {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'blocked-uri'?: string;
    'status-code'?: number;
    'source-file'?: string;
  };
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as CspReportBody;
    const report = body['csp-report'];

    logger.warn('CSP violation reported', {
      operation: 'csp-report',
      violatedDirective: report?.['violated-directive'],
      effectiveDirective: report?.['effective-directive'],
      blockedUri: report?.['blocked-uri'],
      documentUri: report?.['document-uri'],
      sourceFile: report?.['source-file'],
      statusCode: report?.['status-code'],
    });
  } catch {
    // Malformed or empty report body — browser implementations vary; ignore silently
  }

  // 204 No Content is the expected response for CSP report endpoints
  return new Response(null, { status: 204 });
}
