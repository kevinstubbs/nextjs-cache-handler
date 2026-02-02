import { NextRequest, NextResponse } from 'next/server';
import { fetchPostsWithRevalidate } from '../../../../lib/blogService';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API] /api/posts/revalidate - Using blogService...');

    const posts = await fetchPostsWithRevalidate();
    const duration = Date.now() - startTime;

    console.log(`[API] /api/posts/revalidate - Completed in ${duration}ms`);

    return NextResponse.json({
      data: posts,
      cache_strategy: 'revalidate-60s',
      duration_ms: duration,
      fetched_at: new Date().toISOString(),
      description: 'Cached for 60 seconds, then revalidated on next request'
    });

  } catch (error) {
    console.error('[API] /api/posts/revalidate - Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        cache_strategy: 'revalidate-60s',
        duration_ms: Date.now() - startTime,
        fetched_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}