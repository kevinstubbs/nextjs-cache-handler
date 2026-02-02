import type { CacheContext, CacheEntry, CacheStats } from './types';

const cache = new Map<string, CacheEntry>();

// Export the cache Map so it can be accessed from outside
export { cache };

export default class MemoryCacheHandler {
  // Make cache a static property so all instances share the same cache
  static cache = cache;

  constructor(options: any) {
    console.log('[MemoryCacheHandler] Initializing cache handler');
  }

  async get(key: string) {
    console.log(`[MemoryCacheHandler] GET: ${key}`);
    const entry = cache.get(key);

    if (entry === undefined) {
      console.log(`[MemoryCacheHandler] MISS: ${key}`);
      return null;
    }

    console.log(`[MemoryCacheHandler] HIT: ${key}`);
    // Return only the value property, not the wrapper
    return entry;
  }

  async set(key: string, data: any, ctx: CacheContext) {
    console.log(`[MemoryCacheHandler] SET: ${key}`, {
      tags: ctx?.tags
    });

    cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags: ctx?.tags || [],
    });
    console.log(`[MemoryCacheHandler] Cache size: ${cache.size} entries`);
  }

  async revalidateTag(tags: string | string[]) {
    console.log(`[MemoryCacheHandler] REVALIDATE TAG: ${tags}`);
    // tags is either a string or an array of strings
    const tagArray = [tags].flat();
    let deletedCount = 0;

    // Iterate over all entries in the cache
    for (let [key, entry] of Array.from(cache.entries())) {
      // If the entry's tags include the specified tag, delete this entry
      if (entry.tags && Array.isArray(entry.tags) && entry.tags.some((tag: string) => tagArray.includes(tag))) {
        cache.delete(key);
        deletedCount++;
        console.log(`[MemoryCacheHandler] Deleted cache entry: ${key}`);
      }
    }
    console.log(`[MemoryCacheHandler] Revalidated ${deletedCount} entries for tags: ${tagArray.join(', ')}`);
  }

  // Additional helper methods
  getCacheStats(): CacheStats {
    console.log(`[MemoryCacheHandler] Getting cache stats - Size: ${cache.size}`);
    console.log(`[MemoryCacheHandler] Cache keys:`, Array.from(cache.keys()));
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
      entries: []
    };
  }

  async clearCache() {
    console.log(`[MemoryCacheHandler] CLEAR ALL: Clearing ${cache.size} entries`);
    cache.clear();
  }
}