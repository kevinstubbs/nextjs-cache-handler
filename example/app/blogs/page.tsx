import Link from 'next/link';
import { getBlogPosts } from '../../lib/blogService';

export interface BlogPost {
  id: number;
  userId: number;
  title: string;
  body: string;
  // Enhanced fields from API transformation
  slug: string;
  excerpt: string;
  author: {
    name: string;
    email: string;
    website: string;
  };
  publishedAt: string;
  readingTime: number;
  tags: string[];
}

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

export default async function BlogsPage() {
  // Next.js will automatically cache this with ISR
  const blogs: BlogPost[] = await getBlogPosts();

  // Capture the generation time - this changes when ISR refreshes
  const generatedAt = new Date();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
            Blog
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Thoughts, tutorials, and insights about web development
          </p>

          {/* ISR indicator - shows when the page was generated */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">ISR Status</span>
            </div>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Page generated at:{' '}
              <time className="font-mono font-semibold" dateTime={generatedAt.toISOString()}>
                {generatedAt.toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </time>
            </p>
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Revalidates every 5 minutes (300s). Refresh the page after this time to see a new timestamp.
            </p>
          </div>
        </header>

        <div className="grid gap-8">
          {blogs.map((blog) => (
            <article
              key={blog.id}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>{blog.author.name}</span>
                  <span>•</span>
                  <time dateTime={blog.publishedAt}>
                    {new Date(blog.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span>•</span>
                  <span>{blog.readingTime} min read</span>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    <Link
                      href={`/blogs/${blog.slug}`}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {blog.title}
                    </Link>
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {blog.excerpt}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {blog.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/blogs/${blog.slug}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                  >
                    Read more →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            About
          </Link>
        </div>
      </div>
    </div>
  );
}