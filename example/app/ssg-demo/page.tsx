import Link from 'next/link';

// This makes the page statically generated at build time
// No revalidation - truly static until next build
export const dynamic = 'force-static';

export const metadata = {
  title: 'SSG Demo - Static Site Generation',
  description: 'Demonstrates Static Site Generation caching behavior in Next.js.',
};

// This will be called at build time
async function getStaticData() {
  console.log('[SSG] Fetching data at build time...');

  const buildTime = new Date().toISOString();
  const renderTime = buildTime; // In SSG, render time = build time

  try {
    // Fetch some data that will be "frozen" at build time
    const [postsRes, userRes] = await Promise.all([
      fetch('https://jsonplaceholder.typicode.com/posts?_limit=3'),
      fetch('https://jsonplaceholder.typicode.com/users/1')
    ]);

    const [posts, user] = await Promise.all([
      postsRes.json(),
      userRes.json()
    ]);

    console.log(`[SSG] Data fetched at build time: ${buildTime}`);

    return {
      posts,
      user,
      buildTime,
      renderTime,
      buildTimestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'long'
      })
    };
  } catch (error) {
    console.error('[SSG] Error fetching build-time data:', error);
    return {
      posts: [],
      user: null,
      buildTime,
      renderTime,
      buildTimestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'long'
      }),
      error: 'Failed to fetch data at build time'
    };
  }
}

export default async function SSGDemoPage() {
  // This data will be the same for all users until the next build
  const staticData = await getStaticData();

  // Use the static render time from build data (no dynamic generation)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
            Static Site Generation Demo
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            This page is generated at build time and cached until the next deployment
          </p>
        </header>

        <div className="space-y-8">
          {/* Build Time Information */}
          <section className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Static Generation Info
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-purple-200 dark:border-purple-600">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
                  Build Time Data
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Built At:</span>
                    <div className="font-mono text-zinc-900 dark:text-zinc-100">{staticData.buildTime}</div>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Build Timestamp:</span>
                    <div className="font-mono text-zinc-900 dark:text-zinc-100">{staticData.buildTimestamp}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-purple-200 dark:border-purple-600">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
                  Render Time Data
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Rendered At:</span>
                    <div className="font-mono text-zinc-900 dark:text-zinc-100">{staticData.renderTime}</div>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    In SSG, this matches build time (static generation)
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-600 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                🔒 Static Generation Characteristics:
              </h4>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                <li>• Page is pre-rendered at build time</li>
                <li>• Same HTML served to all users</li>
                <li>• Data is "frozen" until next build</li>
                <li>• Fastest possible delivery (served from CDN)</li>
                <li>• No server computation on each request</li>
              </ul>
            </div>
          </section>

          {/* Static Data Display */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Build-Time Fetched Data
            </h2>

            {staticData.error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 rounded-lg">
                <p className="text-red-800 dark:text-red-200">
                  {staticData.error}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User Info */}
                {staticData.user && (
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                      Featured User (ID: {staticData.user.id})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Name:</span>
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">{staticData.user.name}</span>
                      </div>
                      <div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Email:</span>
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">{staticData.user.email}</span>
                      </div>
                      <div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Website:</span>
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">{staticData.user.website}</span>
                      </div>
                      <div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Company:</span>
                        <span className="ml-2 text-zinc-600 dark:text-zinc-400">{staticData.user.company?.name}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Posts */}
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                    Latest Posts (Fetched at Build Time)
                  </h3>
                  <div className="grid gap-4">
                    {staticData.posts.map((post: any) => (
                      <div key={post.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                          {post.title}
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                          {post.body.substring(0, 100)}...
                        </p>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Post ID: {post.id} | User ID: {post.userId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Comparison with Other Strategies */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Caching Strategy Comparison
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">Strategy</th>
                    <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">When Rendered</th>
                    <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">Cache Duration</th>
                    <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">Use Case</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-100 dark:border-zinc-700/50 bg-purple-50 dark:bg-purple-900/20">
                    <td className="py-3 px-4 font-medium text-purple-900 dark:text-purple-100">
                      SSG (This Page)
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Build time</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Until next build</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Static content, best performance</td>
                  </tr>
                  <tr className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">ISR (Blogs)</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Build + background updates</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">5-10 minutes</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Content that updates periodically</td>
                  </tr>
                  <tr className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">SSR (About)</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Every request</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">No cache</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">Dynamic, user-specific content</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Testing Instructions */}
          <section className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700 p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Testing SSG Behavior
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">In Development:</h3>
                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  <li>• Build time = render time (regenerated on each request)</li>
                  <li>• Data fetching happens on each page load</li>
                  <li>• Hot reloading affects static generation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">In Production:</h3>
                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  <li>• Build time ≠ render time (truly static)</li>
                  <li>• Same HTML served to all users</li>
                  <li>• Data never changes until rebuild</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-600 rounded">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>🏗️ To see true SSG behavior:</strong> Run <code className="bg-green-200 dark:bg-green-800 px-1 rounded">npm run build && npm start</code>
              </p>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/blogs"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Compare with ISR (Blogs)
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Compare with SSR (About)
            </Link>
            <Link
              href="/cache-test"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
            >
              Test Fetch Caching
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}