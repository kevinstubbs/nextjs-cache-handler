import { NextRequest, NextResponse } from 'next/server';
import { fetchPostsWithNoCache } from '../../../../lib/blogService';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API] /api/posts/no-cache - Using blogService...');

    const posts = await fetchPostsWithNoCache();
    const duration = Date.now() - startTime;

    console.log(`[API] /api/posts/no-cache - Completed in ${duration}ms`);

    return NextResponse.json({
      data: posts,
      cache_strategy: 'no-store',
      duration_ms: duration,
      fetched_at: new Date().toISOString(),
      description: 'Always fetches fresh data, never cached'
    });

  } catch (error) {
    console.error('[API] /api/posts/no-cache - Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        cache_strategy: 'no-store',
        duration_ms: Date.now() - startTime,
        fetched_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}