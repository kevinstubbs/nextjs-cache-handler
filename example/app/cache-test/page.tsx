'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface ApiResponse {
  data?: any[];
  cache_strategy: string;
  duration_ms: number;
  fetched_at: string;
  description: string;
  cache_tags?: string[];
  error?: string;
}

interface TestResult {
  endpoint: string;
  response: ApiResponse | null;
  clientDuration: number;
  isLoading: boolean;
  error: string | null;
}

const API_ENDPOINTS = [
  {
    path: '/api/posts/no-cache',
    name: 'No Cache',
    description: 'Always fetches fresh data'
  },
  {
    path: '/api/posts/force-cache',
    name: 'Force Cache',
    description: 'Uses cache indefinitely'
  },
  {
    path: '/api/posts/revalidate',
    name: 'Revalidate 60s',
    description: 'Cache for 60 seconds'
  },
  {
    path: '/api/posts/with-tags',
    name: 'Tagged Cache',
    description: 'Cache with tags (5 min)'
  }
];

export default function CacheTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<string>('');

  const initializeResults = () => {
    return API_ENDPOINTS.map(endpoint => ({
      endpoint: endpoint.path,
      response: null,
      clientDuration: 0,
      isLoading: false,
      error: null
    }));
  };

  useEffect(() => {
    setResults(initializeResults());
  }, []);

  const testEndpoint = async (endpointIndex: number) => {
    const endpoint = API_ENDPOINTS[endpointIndex];

    setResults(prev => prev.map((result, index) =>
      index === endpointIndex
        ? { ...result, isLoading: true, error: null }
        : result
    ));

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint.path);
      const data: ApiResponse = await response.json();
      const clientDuration = Date.now() - startTime;

      setResults(prev => prev.map((result, index) =>
        index === endpointIndex
          ? {
              ...result,
              response: data,
              clientDuration,
              isLoading: false
            }
          : result
      ));

    } catch (error) {
      setResults(prev => prev.map((result, index) =>
        index === endpointIndex
          ? {
              ...result,
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false
            }
          : result
      ));
    }
  };

  const testAllEndpoints = async () => {
    setIsTestingAll(true);
    setLastTestTime(new Date().toISOString());

    // Test all endpoints in parallel
    await Promise.all(
      API_ENDPOINTS.map((_, index) => testEndpoint(index))
    );

    setIsTestingAll(false);
  };

  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const revalidateCache = async (tag: string) => {
    try {
      const response = await fetch(`/api/revalidate?tag=${tag}`);
      const result = await response.json();

      if (response.ok) {
        alert(`Cache tag '${tag}' revalidated successfully!`);
        // Refresh cache stats after revalidation
        fetchCacheStats();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error revalidating cache: ${error}`);
    }
  };

  const fetchCacheStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/cache-stats');
      const data = await response.json();
      setCacheStats(data);
    } catch (error) {
      console.error('Error fetching cache stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const clearCache = async () => {
    try {
      const response = await fetch('/api/cache-stats', { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        alert('Cache cleared successfully!');
        fetchCacheStats();
      } else {
        alert(`Error clearing cache: ${result.error}`);
      }
    } catch (error) {
      alert(`Error clearing cache: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
            Next.js Server-Side Cache Testing
          </h1>
        </header>

         {/* Custom Cache Handler Stats */}
        <section className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-700 p-8 mb-18">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Custom Cache Handler Stats
            </h2>
            <div className="flex gap-3">
              <button
                onClick={fetchCacheStats}
                disabled={isLoadingStats}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-md transition-colors"
              >
                {isLoadingStats ? 'Loading...' : 'Refresh Stats'}
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Clear Cache
              </button>
            </div>
          </div>

          {cacheStats ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg border border-purple-200 dark:border-purple-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {cacheStats.cache_stats.size}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Cache Entries
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {cacheStats.cache_stats.entries.length}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Cache Keys
                    </div>
                  </div>
                </div>

                <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  <strong>Handler:</strong> {cacheStats.info.handler_type}
                </div>

                {cacheStats.cache_stats.entries.length > 0 && (
                  <div>
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                      Cache Entries with Tags
                    </h4>
                    <div className="bg-zinc-100 dark:bg-zinc-700 p-4 rounded-lg">
                      <div className="space-y-3">
                        {cacheStats.cache_stats.entries
                          .sort((a: any, b: any) => {
                            // Sort by lastModified date, newest first
                            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                            return dateB - dateA;
                          })
                          .map((entry: any, index: number) => (
                          <div key={index} className="bg-white dark:bg-zinc-600 p-3 rounded-lg border border-zinc-200 dark:border-zinc-500">
                            <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all mb-2">
                              <span className={`inline-block px-2 py-1 rounded text-xs mr-2 ${
                                entry.type === 'fetch'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              }`}>
                                {entry.type}
                              </span>
                              {entry.key.replace(/^(fetch|route):/, '')}
                            </div>
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Tags:</span>
                                {entry.tags.map((tag: string, tagIndex: number) => (
                                  <span
                                    key={tagIndex}
                                    className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/50"
                                    onClick={() => revalidateCache(tag)}
                                    title={`Click to revalidate '${tag}' cache`}
                                  >
                                    {tag} 🔄
                                  </span>
                                ))}
                              </div>
                            )}
                            {(!entry.tags || entry.tags.length === 0) && (
                              <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                No tags
                              </div>
                            )}
                            {entry.lastModified && (
                              <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                Modified: {new Date(entry.lastModified).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-600">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                  🚀 GCS Cache Handler Features:
                </h4>
                <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                  <li>• Google Cloud Storage for distributed caching</li>
                  <li>• Standard Next.js cache handler interface</li>
                  <li>• Cache tag visualization and on-demand revalidation</li>
                  <li>• Fetch vs Route cache type separation</li>
                  <li>• Build invalidation and cache persistence</li>
                  <li>• Console logging for debugging</li>
                  <li>• Detailed cache metadata (tags, timestamps, types)</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Click "Refresh Stats" to view custom cache handler statistics
              </p>
              <button
                onClick={fetchCacheStats}
                disabled={isLoadingStats}
                className="px-6 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-md transition-colors"
              >
                {isLoadingStats ? 'Loading...' : 'Load Cache Stats'}
              </button>
            </div>
          )}
        </section>

        <div className="my-4">
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">
            Test different Next.js API caching strategies with real server-side cache behavior
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Client-side testing:</strong> Call API endpoints to see server cache behavior
              {lastTestTime && (
                <>
                  <br />
                  <strong>Last test:</strong> {lastTestTime}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Control Panel */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                API Cache Test Controls
              </h2>
              <button
                onClick={testAllEndpoints}
                disabled={isTestingAll}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md transition-colors"
              >
                {isTestingAll ? 'Testing...' : 'Test All Endpoints'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {API_ENDPOINTS.map((endpoint, index) => (
                <div key={endpoint.path} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    {endpoint.name}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {endpoint.description}
                  </p>
                  <button
                    onClick={() => testEndpoint(index)}
                    disabled={results[index]?.isLoading}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-300 rounded transition-colors"
                  >
                    {results[index]?.isLoading ? 'Testing...' : 'Test'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Results Section */}
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              API Cache Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map((result, index) => {
                const endpoint = API_ENDPOINTS[index];
                return (
                  <div key={result.endpoint} className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {endpoint.name}
                      </h3>
                      {result.response && (
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            result.clientDuration < 50
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : result.clientDuration < 200
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}>
                            Client: {result.clientDuration}ms
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            result.response.duration_ms < 50
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              : result.response.duration_ms < 200
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                          }`}>
                            Server: {result.response.duration_ms}ms
                          </span>
                        </div>
                      )}
                    </div>

                    {result.isLoading && (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    )}

                    {result.error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 rounded text-sm text-red-800 dark:text-red-200">
                        Error: {result.error}
                      </div>
                    )}

                    {result.response && (
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Cache Strategy: {result.response.cache_strategy}
                          </div>
                          <div className="text-zinc-600 dark:text-zinc-400 mb-2">
                            {result.response.description}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            Fetched at: {new Date(result.response.fetched_at).toLocaleTimeString()}
                          </div>
                          {result.response.cache_tags && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.response.cache_tags.map(tag => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50"
                                  onClick={() => revalidateCache(tag)}
                                  title={`Click to revalidate '${tag}' cache`}
                                >
                                  {tag} 🔄
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {result.response.data && result.response.data.length > 0 && (
                          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Sample Data ({result.response.data.length} posts):
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {result.response.data[0].title.substring(0, 50)}...
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!result.response && !result.isLoading && !result.error && (
                      <div className="text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm">
                        Click "Test" to check this cache strategy
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cache Strategy Guide */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Next.js API Route Cache Strategies
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">cache: 'no-store'</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Always fetches fresh data from external API. No server-side caching.
                    Highest latency but always current.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">cache: 'force-cache'</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Caches indefinitely until manually invalidated. Fastest response after first fetch.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">next: {'{revalidate: 60}'}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Cached for specified seconds, background revalidation. Good balance of performance and freshness.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Tagged Cache</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Time-based caching with on-demand invalidation using cache tags.
                    Click on tags above to trigger revalidation.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">🧪 Testing Tips:</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Watch server response times - cached responses should be much faster</li>
                <li>• Compare "Client" vs "Server" timings in results</li>
                <li>• Test multiple times to see cache hits vs misses</li>
                <li>• Use browser DevTools Network tab to observe actual requests</li>
                <li>• Click cache tags to test on-demand revalidation</li>
              </ul>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/blogs"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Test ISR on Blogs
            </Link>
            <Link
              href="/ssg-demo"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
            >
              Test SSG Demo
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Test SSR on About
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