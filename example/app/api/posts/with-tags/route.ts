import { NextRequest, NextResponse } from 'next/server';
import { fetchPostsWithTags } from '../../../../lib/blogService';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API] /api/posts/with-tags - Using blogService...');

    const posts = await fetchPostsWithTags();
    const duration = Date.now() - startTime;

    console.log(`[API] /api/posts/with-tags - Completed in ${duration}ms`);

    return NextResponse.json({
      data: posts,
      cache_strategy: 'tags-revalidate-5m',
      duration_ms: duration,
      fetched_at: new Date().toISOString(),
      cache_tags: ['api-posts', 'external-data'],
      description: 'Cached for 5 minutes with tags for on-demand invalidation'
    });

  } catch (error) {
    console.error('[API] /api/posts/with-tags - Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        cache_strategy: 'tags-revalidate-5m',
        duration_ms: Date.now() - startTime,
        fetched_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}