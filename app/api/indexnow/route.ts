import { NextRequest, NextResponse } from 'next/server';
import { siteConfig } from '@/lib/seo';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10_000;

type IndexNowRequestBody = {
  urls?: string[];
};

const normalizeSiteOrigin = (): string => {
  try {
    return new URL(siteConfig.url).origin;
  } catch {
    return 'https://whisprspace.com';
  }
};

const normalizeCandidateUrl = (candidate: string, siteOrigin: string): string | null => {
  try {
    const normalized = new URL(candidate, siteOrigin);
    return normalized.origin === siteOrigin ? normalized.toString() : null;
  } catch {
    return null;
  }
};

const isAuthorized = (request: NextRequest, secret: string): boolean => {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token === secret;
};

export async function POST(request: NextRequest) {
  if (!siteConfig.indexingEnabled) {
    return NextResponse.json({ error: 'Indexing is disabled for this environment.' }, { status: 409 });
  }

  const indexNowKey = process.env.INDEXNOW_KEY?.trim();
  const webhookSecret = process.env.INDEXNOW_WEBHOOK_SECRET?.trim();

  if (!indexNowKey) {
    return NextResponse.json({ error: 'INDEXNOW_KEY is not configured.' }, { status: 503 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'INDEXNOW_WEBHOOK_SECRET is not configured.' }, { status: 503 });
  }

  if (!isAuthorized(request, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: IndexNowRequestBody;
  try {
    body = (await request.json()) as IndexNowRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ error: 'Provide at least one URL in `urls`.' }, { status: 400 });
  }

  if (body.urls.length > MAX_URLS_PER_REQUEST) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_URLS_PER_REQUEST} URLs is allowed per request.` },
      { status: 400 }
    );
  }

  const siteOrigin = normalizeSiteOrigin();
  const normalizedUrls = [...new Set(body.urls.map((candidate) => normalizeCandidateUrl(candidate, siteOrigin)))]
    .filter((url): url is string => Boolean(url));

  if (normalizedUrls.length === 0) {
    return NextResponse.json({ error: 'No valid same-origin URLs to submit.' }, { status: 400 });
  }

  const keyLocation = `${siteConfig.url}/indexnow-key.txt`;
  const host = new URL(siteConfig.url).host;

  const payload = {
    host,
    key: indexNowKey,
    keyLocation,
    urlList: normalizedUrls,
  };

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      {
        error: 'IndexNow submission failed.',
        details: responseText || response.statusText,
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    ok: true,
    submitted: normalizedUrls.length,
    endpoint: INDEXNOW_ENDPOINT,
  });
}
