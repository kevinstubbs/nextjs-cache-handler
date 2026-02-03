import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogPosts } from '../../../lib/blogService';
import type { BlogPost } from '../page';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  // Generate static params using cache service
  const blogs = await getBlogPosts();
  return blogs.map((blog) => ({
    slug: blog.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const {slug} = await params
  const blog = await getBlogPost(slug);

  if (!blog) {
    return {
      title: 'Blog Post Not Found',
    };
  }

  return {
    title: blog.title,
    description: blog.excerpt,
  };
}

// Enable ISR with 10 minute revalidation for individual posts
export const revalidate = 600;

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  // Next.js will automatically cache this with ISR
  const {slug} = await params
  const blog: BlogPost | null = await getBlogPost(slug);

  // Capture the generation time - this changes when ISR refreshes
  const generatedAt = new Date();

  if (!blog) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Blog
          </Link>

          {/* ISR indicator */}
          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
            <span className="font-medium">ISR:</span>{' '}
            <time className="font-mono" dateTime={generatedAt.toISOString()}>
              {generatedAt.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </time>
            <span className="text-amber-500 dark:text-amber-500 ml-1">(10min)</span>
          </div>
        </nav>

        <article className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="p-8">
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                {blog.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                <span className="font-medium">{blog.author.name}</span>
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

              <div className="flex flex-wrap gap-2 mb-6">
                {blog.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {blog.excerpt}
              </p>
            </header>

            <div className="prose prose-zinc dark:prose-invert max-w-none">
              {/* Render blog content with proper formatting */}
              {blog.body.split('\n').map((paragraph, index) => {
                if (paragraph.trim() === '') return <br key={index} />;

                // Handle headers (simple markdown-like parsing)
                if (paragraph.startsWith('# ')) {
                  return (
                    <h1 key={index} className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">
                      {paragraph.substring(2)}
                    </h1>
                  );
                }
                if (paragraph.startsWith('## ')) {
                  return (
                    <h2 key={index} className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">
                      {paragraph.substring(3)}
                    </h2>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <li key={index} className="text-zinc-700 dark:text-zinc-300 mb-1">
                      {paragraph.substring(2)}
                    </li>
                  );
                }

                return (
                  <p key={index} className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </div>

          <footer className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  Written by {blog.author.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Published on {new Date(blog.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Link
                href="/blogs"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Read More Posts
              </Link>
            </div>
          </footer>
        </article>

        <nav className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}