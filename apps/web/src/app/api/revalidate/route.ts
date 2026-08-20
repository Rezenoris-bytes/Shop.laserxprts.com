import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * On-demand cache invalidation, called by the API after an admin write.
 *
 * The catalogue is ISR-cached for up to an hour, which is right for traffic and
 * wrong for editing: without this an admin saves a product and sees no change
 * until the window expires. The comment in lib/api.ts always promised this
 * existed; it did not, and clearing .next/cache by hand was the workaround.
 *
 * Shared-secret authenticated. It is a public route by necessity — the API
 * calls it server-to-server — and an unauthenticated purge endpoint is a free
 * way to force every page to re-render on demand.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET is not configured' }, { status: 500 });
  }

  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let paths: string[] = [];
  try {
    const body = (await request.json()) as { paths?: unknown };
    if (Array.isArray(body.paths)) {
      paths = body.paths.filter((p): p is string => typeof p === 'string' && p.startsWith('/'));
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (paths.length === 0) {
    return NextResponse.json({ error: 'No paths supplied' }, { status: 400 });
  }

  for (const path of paths) {
    // 'page' rather than 'layout': the catalogue pages read the same data but
    // do not share a cached layout, and purging layouts would drop far more
    // than the edit affected.
    revalidatePath(path, 'page');
  }

  return NextResponse.json({ revalidated: paths, at: Date.now() });
}
