import type { BlogPost } from '../app/blogs/page';

// Types for JSONPlaceholder API responses
interface ApiPost {
  userId: number;
  id: number;
  title: string;
  body: string;
}

interface ApiUser {
  id: number;
  name: string;
  username: string;
  email: string;
  website: string;
  phone: string;
}

// Utility function to create slug from title
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

// Utility function to generate excerpt from body
function createExcerpt(body: string, maxLength: number = 150): string {
  return body.length > maxLength ? body.substring(0, maxLength) + '...' : body;
}

// Utility function to estimate reading time
function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Sample tags for variety
const sampleTags = [
  ['Technology', 'Web Development'],
  ['JavaScript', 'Programming'],
  ['Design', 'User Experience'],
  ['Tutorial', 'Guide'],
  ['Best Practices', 'Tips'],
  ['React', 'Frontend'],
  ['Backend', 'API'],
  ['Performance', 'Optimization'],
  ['Security', 'Authentication'],
  ['Database', 'SQL']
];

/**
 * Transform API data to our BlogPost structure
 */
function transformApiData(posts: ApiPost[], users: ApiUser[]): BlogPost[] {
  return posts.map((post, index) => {
    const user = users.find(u => u.id === post.userId);
    const baseDate = new Date('2024-01-01');
    const publishDate = new Date(baseDate.getTime() + (index * 24 * 60 * 60 * 1000));

    return {
      id: post.id,
      userId: post.userId,
      title: post.title.charAt(0).toUpperCase() + post.title.slice(1),
      body: post.body,
      slug: createSlug(post.title),
      excerpt: createExcerpt(post.body),
      author: {
        name: user?.name || 'Anonymous',
        email: user?.email || '',
        website: user?.website || ''
      },
      publishedAt: publishDate.toISOString(),
      readingTime: calculateReadingTime(post.body),
      tags: sampleTags[index % sampleTags.length] || ['General']
    };
  });
}

/**
 * Get all blog posts using Next.js fetch caching
 */
export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    console.log('[API] Fetching blog posts from JSONPlaceholder...');

    // Fetch posts and users in parallel with Next.js caching
    const [postsResponse, usersResponse] = await Promise.all([
      fetchPostsWithTags(),
      fetch('https://jsonplaceholder.typicode.com/users', {
        next: {
          revalidate: 600, // 10 minutes cache (users change less frequently)
          tags: ['users']
        }
      })
    ]);

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch data from API');
    }

    const [posts, users]: [ApiPost[], ApiUser[]] = await Promise.all([
      postsResponse,
      usersResponse.json()
    ]);

    console.log(`[API] Successfully fetched ${posts.length} posts and ${users.length} users`);

    // Transform and return only first 10 posts for better UX
    return transformApiData(posts.slice(0, 10), users);

  } catch (error) {
    console.error('[API] Error fetching blog posts:', error);
    // Return empty array on error - in production you might want to throw
    return [];
  }
}

/**
 * Get a single blog post by slug using Next.js fetch caching
 */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    console.log(`[API] Fetching blog post: ${slug}`);

    // First get all posts to find the one with matching slug
    const allPosts = await getBlogPosts();
    const post = allPosts.find(p => p.slug === slug);

    if (!post) {
      console.log(`[API] Post not found: ${slug}`);
      return null;
    }

    // Optionally fetch individual post for more detailed content
    // We could also fetch comments here if needed
    const postResponse = await fetch(`https://jsonplaceholder.typicode.com/posts/${post.id}`, {
      next: {
        revalidate: 600, // 10 minutes cache for individual posts
        tags: [`post-${post.id}`, 'api-posts']
      }
    });

    if (postResponse.ok) {
      const apiPost: ApiPost = await postResponse.json();
      console.log(`[API] Successfully fetched individual post: ${post.id}`);
    }

    return post;

  } catch (error) {
    console.error(`[API] Error fetching blog post ${slug}:`, error);
    return null;
  }
}

// ==================== API ROUTE CACHE TESTING FUNCTIONS ====================

/**
 * Fetch posts with no-store cache strategy
 */
export async function fetchPostsWithNoCache(): Promise<ApiPost[]> {
  console.log('[BlogService] Fetching posts with no-store cache...');

  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3', {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  const posts = await response.json();
  console.log(`[BlogService] Fetched ${posts.length} posts with no-store`);
  return posts;
}

/**
 * Fetch posts with force-cache strategy
 */
export async function fetchPostsWithForceCache(): Promise<ApiPost[]> {
  console.log('[BlogService] Fetching posts with force-cache...');

  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3', {
    cache: 'force-cache'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  const posts = await response.json();
  console.log(`[BlogService] Fetched ${posts.length} posts with force-cache`);
  return posts;
}

/**
 * Fetch posts with revalidate strategy
 */
export async function fetchPostsWithRevalidate(): Promise<ApiPost[]> {
  console.log('[BlogService] Fetching posts with 60s revalidation...');

  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3', {
    next: { revalidate: 60 } // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  const posts = await response.json();
  console.log(`[BlogService] Fetched ${posts.length} posts with 60s revalidation`);
  return posts;
}

/**
 * Fetch posts with tagged cache strategy
 */
export async function fetchPostsWithTags(): Promise<ApiPost[]> {
  console.log('[BlogService] Fetching posts with cache tags...');

  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3', {
    next: {
      revalidate: 300, // 5 minutes
      tags: ['api-posts', 'external-data']
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  const posts = await response.json();
  console.log(`[BlogService] Fetched ${posts.length} posts with tagged cache`);
  return posts;
}