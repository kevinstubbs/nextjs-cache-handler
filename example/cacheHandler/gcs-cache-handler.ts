import type {
  CacheData,
  CacheStats,
  CacheEntryInfo,
  CacheHandlerParametersGet,
  CacheHandlerParametersSet,
  CacheHandlerParametersRevalidateTag,
  CacheHandlerValue,
  Revalidate,
  SerializedCacheData,
  SerializedBuffer,
  SerializedMap,
  SerializableValue,
} from './types';

import type { CacheHandler as NextCacheHandler } from './types';

import { Bucket, Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

// Global singleton to track if build invalidation has been checked for this process
let buildInvalidationChecked = false;

// Edge cache clearer types and class (inlined to avoid module resolution issues)
interface CacheClearResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  duration?: number;
  paths?: string[];
}

class EdgeCacheClear {
  private baseUrl: string;

  constructor() {
    if (!process.env.OUTBOUND_PROXY_ENDPOINT) {
      throw new Error('OUTBOUND_PROXY_ENDPOINT environment variable is required for GCS cache handler');
    }
    this.baseUrl = `http://${process.env.OUTBOUND_PROXY_ENDPOINT}/rest/v0alpha1/cache`;
  }

  /**
   * Clear the entire edge cache (nuclear option)
   */
  async nukeCache(): Promise<CacheClearResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.baseUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          statusCode: response.status,
          duration
        };
      }

      console.log(`[EdgeCacheClear] Cleared entire edge cache in ${duration}ms`);
      return { success: true, statusCode: response.status, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage, duration };
    }
  }

  /**
   * Clear specific paths from the edge cache (granular invalidation)
   * @param paths Array of paths to clear (e.g., ['/blogs/my-post', '/blogs'])
   */
  async clearPaths(paths: string[]): Promise<CacheClearResult> {
    if (paths.length === 0) {
      return { success: true, duration: 0, paths: [] };
    }

    const startTime = Date.now();
    const results: { path: string; success: boolean }[] = [];

    try {
      // Clear each path individually
      // Endpoint format: /cache/paths/{path...}
      const clearPromises = paths.map(async (routePath) => {
        try {
          // Normalize path: ensure it starts with / and remove trailing /
          const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
          const cleanPath = normalizedPath.replace(/\/$/, '') || '/';
          // Build URL: /cache/paths/blogs/my-post for path /blogs/my-post
          const pathSegment = cleanPath === '/' ? '' : cleanPath.substring(1);
          const url = `${this.baseUrl}/paths/${pathSegment}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            results.push({ path: routePath, success: true });
          } else {
            console.warn(`[EdgeCacheClear] Failed to clear path ${routePath}: HTTP ${response.status}`);
            results.push({ path: routePath, success: false });
          }
        } catch (error) {
          console.warn(`[EdgeCacheClear] Error clearing path ${routePath}:`, error);
          results.push({ path: routePath, success: false });
        }
      });

      await Promise.all(clearPromises);

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const clearedPaths = results.filter(r => r.success).map(r => r.path);

      console.log(`[EdgeCacheClear] Cleared ${successCount}/${paths.length} paths in ${duration}ms`);

      return {
        success: successCount > 0,
        duration,
        paths: clearedPaths
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage, duration, paths: [] };
    }
  }

  /**
   * Clear a single path from the edge cache
   */
  async clearPath(routePath: string): Promise<CacheClearResult> {
    return this.clearPaths([routePath]);
  }

  /**
   * Clear paths in the background (non-blocking)
   */
  async clearPathsInBackground(paths: string[], context: string): Promise<void> {
    if (paths.length === 0) return;

    // Run in background without awaiting
    this.clearPaths(paths).then(result => {
      if (result.success) {
        console.log(`[EdgeCacheClear] Background path clear for ${context}: ${result.paths?.length} paths cleared`);
      } else {
        console.warn(`[EdgeCacheClear] Background path clear failed for ${context}: ${result.error}`);
      }
    }).catch(error => {
      console.error(`[EdgeCacheClear] Background path clear error for ${context}:`, error);
    });
  }

  /**
   * Clear cache entries by key/tag
   * @param keys Array of cache keys/tags to clear
   */
  async clearKeys(keys: string[]): Promise<CacheClearResult> {
    if (keys.length === 0) {
      return { success: true, duration: 0, paths: [] };
    }

    const startTime = Date.now();
    const results: { key: string; success: boolean }[] = [];

    try {
      // Clear each key individually
      // Endpoint format: /cache/keys/{key}
      const clearPromises = keys.map(async (key) => {
        try {
          const url = `${this.baseUrl}/keys/${encodeURIComponent(key)}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            results.push({ key, success: true });
          } else {
            console.warn(`[EdgeCacheClear] Failed to clear key ${key}: HTTP ${response.status}`);
            results.push({ key, success: false });
          }
        } catch (error) {
          console.warn(`[EdgeCacheClear] Error clearing key ${key}:`, error);
          results.push({ key, success: false });
        }
      });

      await Promise.all(clearPromises);

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const clearedKeys = results.filter(r => r.success).map(r => r.key);

      console.log(`[EdgeCacheClear] Cleared ${successCount}/${keys.length} keys in ${duration}ms`);

      return {
        success: successCount > 0,
        duration,
        paths: clearedKeys
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage, duration, paths: [] };
    }
  }

  /**
   * Clear keys in the background (non-blocking)
   */
  async clearKeysInBackground(keys: string[], context: string): Promise<void> {
    if (keys.length === 0) return;

    // Run in background without awaiting
    this.clearKeys(keys).then(result => {
      if (result.success) {
        console.log(`[EdgeCacheClear] Background key clear for ${context}: ${result.paths?.length} keys cleared`);
      } else {
        console.warn(`[EdgeCacheClear] Background key clear failed for ${context}: ${result.error}`);
      }
    }).catch(error => {
      console.error(`[EdgeCacheClear] Background key clear error for ${context}:`, error);
    });
  }

  async nukeCacheInBackground(context: string): Promise<void> {
    this.nukeCache().then(result => {
      if (result.success) {
        console.log(`[EdgeCacheClear] Background nuke successful for ${context} (${result.duration}ms)`);
      } else {
        console.warn(`[EdgeCacheClear] Background nuke failed for ${context}: ${result.error}`);
      }
    }).catch(error => {
      console.error(`[EdgeCacheClear] Background nuke error for ${context}:`, error);
    });
  }
}

export default class GcsCacheHandler implements NextCacheHandler {
  private bucket: Bucket;
  private fetchCachePrefix: string;
  private routeCachePrefix: string;
  private buildMetaKey: string;
  private tagsPrefix: string;
  private tagsMapKey: string;
  private edgeCacheClearer: EdgeCacheClear | null;

  constructor(context: any) {
    // Only log during server runtime, not during build (too noisy with parallel workers)
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.log('[GcsCacheHandler] Initializing GCS-based cache handler');
    }

    const bucketName = process.env.CACHE_BUCKET;
    if (!bucketName) {
      throw new Error('CACHE_BUCKET environment variable is required for GCS cache handler');
    }

    // Initialize GCS storage
    const storage = new Storage();
    this.bucket = storage.bucket(bucketName);

    // Create separate cache prefixes for different cache types
    this.fetchCachePrefix = 'fetch-cache/';
    this.routeCachePrefix = 'route-cache/';
    this.buildMetaKey = 'build-meta.json';
    this.tagsPrefix = 'cache/tags/';
    this.tagsMapKey = `${this.tagsPrefix}tags.json`;

    // Initialize edge cache clearer
    try {
      this.edgeCacheClearer = new EdgeCacheClear();
    } catch (error) {
      this.edgeCacheClearer = null;
    }

    // Initialize tags mapping file (don't await to avoid blocking constructor)
    this.initializeTagsMapping().catch(() => { });

    // Only check build invalidation once per process
    // Skip during build phase to avoid race conditions with parallel workers
    if (!buildInvalidationChecked && !this.isBuildPhase()) {
      this.checkBuildInvalidation();
      buildInvalidationChecked = true;
    }
  }

  /**
   * Detect if we're in the build phase (next build) vs runtime (next start)
   */
  private isBuildPhase(): boolean {
    return process.env.NEXT_PHASE === 'phase-production-build';
  }

  private async initializeTagsMapping(): Promise<void> {
    try {
      const file = this.bucket.file(this.tagsMapKey);
      const [exists] = await file.exists();

      if (!exists) {
        const emptyTagsMapping = {};
        await file.save(JSON.stringify(emptyTagsMapping), {
          metadata: {
            contentType: 'application/json',
          },
        });
      }
    } catch (error) {
      // Silently fail - tags mapping will be created on first write
    }
  }

  private async readTagsMapping(): Promise<Record<string, string[]>> {
    try {
      const file = this.bucket.file(this.tagsMapKey);
      const [exists] = await file.exists();

      if (!exists) {
        return {};
      }

      const [data] = await file.download();
      return JSON.parse(data.toString());
    } catch (error) {
      console.warn('[GcsCacheHandler] Error reading tags mapping:', error);
      return {};
    }
  }

  private async writeTagsMapping(tagsMapping: Record<string, string[]>): Promise<void> {
    try {
      const file = this.bucket.file(this.tagsMapKey);
      await file.save(JSON.stringify(tagsMapping, null, 2), {
        metadata: {
          contentType: 'application/json',
        },
      });
    } catch (error) {
      console.error('[GcsCacheHandler] Error writing tags mapping:', error);
    }
  }

  private async updateTagsMapping(cacheKey: string, tags: string[], isDelete = false): Promise<void> {
    try {
      const tagsMapping = await this.readTagsMapping();

      if (isDelete) {
        // Remove the cache key from all tag mappings
        for (const tag of Object.keys(tagsMapping)) {
          tagsMapping[tag] = tagsMapping[tag].filter(key => key !== cacheKey);
          // Remove empty tag entries
          if (tagsMapping[tag].length === 0) {
            delete tagsMapping[tag];
          }
        }
      } else {
        // Add the cache key to each tag mapping
        for (const tag of tags) {
          if (!tagsMapping[tag]) {
            tagsMapping[tag] = [];
          }
          // Add cache key if not already present
          if (!tagsMapping[tag].includes(cacheKey)) {
            tagsMapping[tag].push(cacheKey);
          }
        }
      }

      await this.writeTagsMapping(tagsMapping);
    } catch (error) {
      console.error('[GcsCacheHandler] Error updating tags mapping:', error);
    }
  }

  private async updateTagsMappingBulkDelete(cacheKeysToDelete: string[]): Promise<void> {
    try {
      const tagsMapping = await this.readTagsMapping();

      // Remove all deleted cache keys from all tag mappings
      for (const tag of Object.keys(tagsMapping)) {
        tagsMapping[tag] = tagsMapping[tag].filter(key => !cacheKeysToDelete.includes(key));
        // Remove empty tag entries
        if (tagsMapping[tag].length === 0) {
          delete tagsMapping[tag];
        }
      }

      await this.writeTagsMapping(tagsMapping);
    } catch (error) {
      console.error('[GcsCacheHandler] Error bulk updating tags mapping:', error);
    }
  }

  /**
   * Gets the Next.js build ID from the build manifest.
   * This ID is stable and unique per build, unlike file modification times.
   */
  private getBuildId(): string {
    try {
      // Try to read from .next/BUILD_ID first (standard location)
      const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
      if (fs.existsSync(buildIdPath)) {
        return fs.readFileSync(buildIdPath, 'utf-8').trim();
      }

      // Fallback: extract build ID from build-manifest.json paths
      const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        // Build ID is in paths like "static/DsOqQ6QE7Bo_OEhUjVFCD/_buildManifest.js"
        const lowPriorityFiles = manifest.lowPriorityFiles || [];
        for (const file of lowPriorityFiles) {
          const match = file.match(/static\/([^/]+)\/_/);
          if (match) {
            return match[1];
          }
        }
      }

      console.log('[GcsCacheHandler] Could not find build ID, using timestamp fallback');
      return `fallback-${Date.now()}`;
    } catch (error) {
      return `fallback-${Date.now()}`;
    }
  }

  private async checkBuildInvalidation(): Promise<void> {
    const currentBuildId = this.getBuildId();

    try {
      const buildMeta = await this.readBuildMeta();

      if (buildMeta.buildId !== currentBuildId) {
        console.log(`[GcsCacheHandler] New build detected (${buildMeta.buildId} -> ${currentBuildId}), invalidating route cache`);

        // TODO: make this more granular instead of nuking the whole cache
        // Clear ONLY Full Route Cache (APP_PAGE, APP_ROUTE, PAGES)
        // Preserve Data Cache (FETCH) as per Next.js behavior
        await this.invalidateRouteCache();

        // Update build metadata with current build ID
        await this.writeBuildMeta({
          buildId: currentBuildId,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      // No previous build metadata - first run, just save current build ID
      await this.writeBuildMeta({
        buildId: currentBuildId,
        timestamp: Date.now()
      });
    }
  }

  private async readBuildMeta(): Promise<{ buildId: string; timestamp: number }> {
    const file = this.bucket.file(this.buildMetaKey);
    const [data] = await file.download();
    return JSON.parse(data.toString());
  }

  private async writeBuildMeta(meta: { buildId: string; timestamp: number }): Promise<void> {
    const file = this.bucket.file(this.buildMetaKey);
    await file.save(JSON.stringify(meta), {
      metadata: {
        contentType: 'application/json',
      },
    });
  }

  private async invalidateRouteCache(): Promise<void> {
    try {
      // Clear entire route cache (preserve fetch cache)
      const [files] = await this.bucket.getFiles({ prefix: this.routeCachePrefix });
      const deletePromises = files.map(file => file.delete());
      await Promise.all(deletePromises);

      // Also clear the edge cache since route cache was invalidated
      await this.clearEdgeCache('route cache invalidation on new build');
    } catch (error) {
      // Silently fail - cache invalidation is best effort
    }
  }

  private getCacheKey(cacheKey: string, cacheType: 'fetch' | 'route'): string {
    // Create a safe filename from the cache key
    const safeKey = cacheKey.replace(/[^a-zA-Z0-9-]/g, '_');
    const prefix = cacheType === 'fetch' ? this.fetchCachePrefix : this.routeCachePrefix;
    return `${prefix}${safeKey}.json`;
  }

  private async readCacheEntry(cacheKey: string, cacheType: 'fetch' | 'route'): Promise<CacheHandlerValue | null> {
    try {
      const gcsKey = this.getCacheKey(cacheKey, cacheType);
      const file = this.bucket.file(gcsKey);

      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [data] = await file.download();
      const parsedData = JSON.parse(data.toString());

      // Deserialize any Buffer data that was stored as base64
      return this.deserializeFromStorage({ [cacheKey]: parsedData })[cacheKey] || null;
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  private async writeCacheEntry(cacheKey: string, cacheValue: CacheHandlerValue, cacheType: 'fetch' | 'route'): Promise<void> {
    try {
      const gcsKey = this.getCacheKey(cacheKey, cacheType);
      const file = this.bucket.file(gcsKey);

      // Convert Buffers to base64 strings for JSON serialization
      const serializedData = this.serializeForStorage({ [cacheKey]: cacheValue });

      await file.save(JSON.stringify(serializedData[cacheKey], null, 2), {
        metadata: {
          contentType: 'application/json',
        },
      });
    } catch (error) {
      console.error(`[GcsCacheHandler] Error writing cache entry ${cacheKey}:`, error);
    }
  }

  private async deleteCacheEntry(cacheKey: string, cacheType: 'fetch' | 'route'): Promise<void> {
    try {
      const gcsKey = this.getCacheKey(cacheKey, cacheType);
      const file = this.bucket.file(gcsKey);
      await file.delete();
    } catch (error) {
      // File might not exist, that's fine
      if (!error || typeof error !== 'object' || !('code' in error) || (error as any).code !== 404) {
        console.error(`[GcsCacheHandler] Error deleting cache entry ${cacheKey}:`, error);
      }
    }
  }

  private serializeForStorage(data: CacheData): SerializedCacheData {
    const serialized: SerializedCacheData = {};

    for (const [key, entry] of Object.entries(data)) {
      if (entry && typeof entry === 'object' && 'value' in entry) {
        const value = entry.value;

        // Handle Next.js 15 buffer serialization requirements
        if (value && typeof value === 'object') {
          const serializedValue = { ...value };

          // Convert body Buffer to base64 string for storage
          if (serializedValue.body && Buffer.isBuffer(serializedValue.body)) {
            serializedValue.body = {
              type: 'Buffer',
              data: serializedValue.body.toString('base64')
            };
          }

          // Handle rscData if it's a Buffer
          if (serializedValue.rscData && Buffer.isBuffer(serializedValue.rscData)) {
            serializedValue.rscData = {
              type: 'Buffer',
              data: serializedValue.rscData.toString('base64')
            };
          }

          // Handle segmentData if it's a Map with Buffers
          if (serializedValue.segmentData && serializedValue.segmentData instanceof Map) {
            const segmentObj: Record<string, SerializableValue> = {};
            for (const [segKey, segValue] of serializedValue.segmentData.entries()) {
              if (Buffer.isBuffer(segValue)) {
                segmentObj[segKey] = {
                  type: 'Buffer',
                  data: segValue.toString('base64')
                };
              } else {
                segmentObj[segKey] = segValue;
              }
            }
            serializedValue.segmentData = {
              type: 'Map',
              data: segmentObj
            };
          }

          serialized[key] = {
            ...entry,
            value: serializedValue
          };
        } else {
          serialized[key] = entry;
        }
      } else {
        serialized[key] = entry;
      }
    }

    return serialized;
  }

  private deserializeFromStorage(data: SerializedCacheData): CacheData {
    const deserialized: CacheData = {};

    for (const [key, entry] of Object.entries(data)) {
      if (entry && typeof entry === 'object' && 'value' in entry) {
        const value = entry.value;

        if (value && typeof value === 'object') {
          const deserializedValue = { ...value } as Record<string, unknown>;

          // Convert base64 string back to Buffer for body
          if (deserializedValue.body &&
            typeof deserializedValue.body === 'object' &&
            'type' in deserializedValue.body &&
            deserializedValue.body.type === 'Buffer' &&
            'data' in deserializedValue.body) {
            deserializedValue.body = Buffer.from((deserializedValue.body as SerializedBuffer).data, 'base64');
          }

          // Convert base64 string back to Buffer for rscData
          if (deserializedValue.rscData &&
            typeof deserializedValue.rscData === 'object' &&
            'type' in deserializedValue.rscData &&
            deserializedValue.rscData.type === 'Buffer' &&
            'data' in deserializedValue.rscData) {
            deserializedValue.rscData = Buffer.from((deserializedValue.rscData as SerializedBuffer).data, 'base64');
          }

          // Convert serialized Map back to Map with Buffers
          if (deserializedValue.segmentData &&
            typeof deserializedValue.segmentData === 'object' &&
            'type' in deserializedValue.segmentData &&
            deserializedValue.segmentData.type === 'Map' &&
            'data' in deserializedValue.segmentData) {
            const segmentMap = new Map();
            for (const [segKey, segValue] of Object.entries((deserializedValue.segmentData as SerializedMap).data)) {
              if (segValue && typeof segValue === 'object' && 'type' in segValue && segValue.type === 'Buffer' && 'data' in segValue) {
                segmentMap.set(segKey, Buffer.from(segValue.data as string, 'base64'));
              } else {
                segmentMap.set(segKey, segValue);
              }
            }
            deserializedValue.segmentData = segmentMap;
          }

          deserialized[key] = {
            ...entry,
            value: deserializedValue
          };
        } else {
          deserialized[key] = entry;
        }
      } else {
        deserialized[key] = entry;
      }
    }

    return deserialized;
  }

  async get(
    cacheKey: CacheHandlerParametersGet[0],
    ctx?: CacheHandlerParametersGet[1]
  ): Promise<CacheHandlerValue | null> {
    console.log(`[GcsCacheHandler] GET: ${cacheKey}`);

    try {
      // TODO: verify the behavior of stale cache over here. It should be revalidating it?
      // Determine cache type based on context
      const cacheType = this.determineCacheType(ctx);
      const entry = await this.readCacheEntry(cacheKey, cacheType);

      if (!entry) {
        console.log(`[GcsCacheHandler] MISS: ${cacheKey} (${cacheType})`);
        return null;
      }

      console.log(`[GcsCacheHandler] HIT: ${cacheKey} (${cacheType})`, {
        entryType: typeof entry,
        hasValue: entry && typeof entry === 'object' && 'value' in entry
      });

      return entry;
    } catch (error) {
      console.error(`[GcsCacheHandler] Error reading cache for key ${cacheKey}:`, error);
      return null;
    }
  }

  private determineCacheType(ctx?: CacheHandlerParametersGet[1]): 'fetch' | 'route' {
    if (!ctx) {
      return 'route'; // Default to route cache if no context
    }

    // Check for fetch cache indicators
    if ('fetchCache' in ctx && ctx.fetchCache === true) {
      return 'fetch';
    }

    if ('fetchUrl' in ctx) {
      return 'fetch';
    }

    if ('fetchIdx' in ctx) {
      return 'fetch';
    }

    // Default to route cache for page/route caches
    return 'route';
  }

  async set(
    cacheKey: CacheHandlerParametersSet[0],
    incrementalCacheValue: CacheHandlerParametersSet[1],
    ctx: CacheHandlerParametersSet[2] & {
      tags?: string[];
      revalidate?: Revalidate;
    }
  ): Promise<void> {
    // Determine cache type based on the value kind
    const cacheType = incrementalCacheValue && typeof incrementalCacheValue === 'object' && 'kind' in incrementalCacheValue && incrementalCacheValue.kind === 'FETCH' ? 'fetch' : 'route';

    console.log(`[GcsCacheHandler] SET: ${cacheKey} (${cacheType})`, {
      valueType: typeof incrementalCacheValue,
      hasKind: incrementalCacheValue && typeof incrementalCacheValue === 'object' && 'kind' in incrementalCacheValue
    });

    try {
      const { tags = [] } = ctx;

      const cacheHandlerValue: CacheHandlerValue = {
        value: incrementalCacheValue,
        lastModified: Date.now(),
        tags: Object.freeze(tags)
      }

      // Store the incrementalCacheValue exactly as Next.js provides it
      // Next.js expects to get back exactly what it stored
      await this.writeCacheEntry(cacheKey, cacheHandlerValue, cacheType);

      // Update tags mapping if there are tags
      if (tags.length > 0) {
        await this.updateTagsMapping(cacheKey, tags);
        console.log(`[GcsCacheHandler] Updated tags mapping for ${cacheKey} with tags:`, tags);
      }

      console.log(`[GcsCacheHandler] Cached ${cacheKey} in ${cacheType} cache`);
    } catch (error) {
      console.error(`[GcsCacheHandler] Error setting cache for key ${cacheKey}:`, error);
    }
  }

  /**
   * Safely clear edge cache without blocking main cache operations
   * Uses background execution with comprehensive error handling
   */
  private async clearEdgeCache(context: string): Promise<void> {
    if (!this.edgeCacheClearer) {
      console.log(`[GcsCacheHandler] Edge cache clearer not configured, skipping edge cache clear for: ${context}`);
      return;
    }

    // Run in background to avoid blocking cache operations
    this.edgeCacheClearer.nukeCacheInBackground(context);
  }

  async revalidateTag(tag: CacheHandlerParametersRevalidateTag[0]): Promise<void> {
    console.log(`[GcsCacheHandler] REVALIDATE TAG: ${tag}`);

    const tagArray = [tag].flat();
    const deletedKeys: string[] = [];

    let tagsMapping;
    try {
      // Read the current tags mapping
      tagsMapping = await this.readTagsMapping();
    } catch (error) {
      console.error('[GcsCacheHandler] Error reading tags mapping during revalidateTag:', error);
      tagsMapping = {}; // Use empty mapping if we can't read the file
    }

    // Process each tag
    for (const currentTag of tagArray) {
      const cacheKeysForTag = tagsMapping[currentTag] || [];

      if (cacheKeysForTag.length === 0) {
        console.log(`[GcsCacheHandler] No cache entries found for tag: ${currentTag}`);
        continue;
      }

      console.log(`[GcsCacheHandler] Found ${cacheKeysForTag.length} cache entries for tag: ${currentTag}`);

      // Delete each cache entry for this tag
      for (const cacheKey of cacheKeysForTag) {
        // Determine cache type - we need to check both locations since we don't store the type in the mapping
        let deleted = false;

        // Try fetch cache first
        try {
          await this.deleteCacheEntry(cacheKey, 'fetch');
          deleted = true;
          console.log(`[GcsCacheHandler] Deleted fetch cache entry: ${cacheKey}`);
        } catch (error) {
          // Entry might not exist in fetch cache, try route cache
        }

        // Try route cache if not found in fetch cache
        if (!deleted) {
          try {
            await this.deleteCacheEntry(cacheKey, 'route');
            deleted = true;
            console.log(`[GcsCacheHandler] Deleted route cache entry: ${cacheKey}`);
          } catch (error) {
            console.warn(`[GcsCacheHandler] Cache entry not found in either cache: ${cacheKey}`);
          }
        }

        if (deleted) {
          deletedKeys.push(cacheKey);
        }
      }
    }

    // Update the tags mapping to remove deleted keys
    if (deletedKeys.length > 0) {
      await this.updateTagsMappingBulkDelete(deletedKeys);
      console.log(`[GcsCacheHandler] Updated tags mapping after deleting ${deletedKeys.length} entries`);
    }

    console.log(`[GcsCacheHandler] Revalidated ${deletedKeys.length} entries for tags: ${tagArray.join(', ')}`);

    // Clear edge cache after successful revalidation
    if (deletedKeys.length > 0 && this.edgeCacheClearer) {
      // Clear by tags/keys
      this.edgeCacheClearer.clearKeysInBackground(tagArray, `tag revalidation: ${tagArray.join(', ')}`);

      // Also clear by route paths for routes that may not have tags (e.g., ISR routes)
      // Filter out fetch cache keys (UUIDs/hashes) and keep only valid route paths
      const isValidRoutePath = (key: string): boolean => {
        // Route paths start with "/" or "_" (underscore-prefixed routes like "_index")
        return key.startsWith('/') || key.startsWith('_');
      };

      const routePaths = deletedKeys
        .filter(isValidRoutePath)
        .map(key => {
          // Handle keys that might have been transformed (underscores to slashes)
          if (key.startsWith('_')) {
            return key.replace(/_/g, '/');
          }
          return key.startsWith('/') ? key : `/${key}`;
        });

      if (routePaths.length > 0) {
        this.edgeCacheClearer.clearPathsInBackground(routePaths, `path revalidation: ${routePaths.join(', ')}`);
      }
    }
  }

  resetRequestCache(): void {
    console.log(`[GcsCacheHandler] RESET REQUEST CACHE: No-op for GCS-based cache`);
    // For GCS-based cache, this is typically a no-op since we're not maintaining
    // per-request caches. The GCS bucket is the source of truth.
  }
}

// Export a shared instance of the cache data access functions for the API
export async function getSharedCacheStats(): Promise<CacheStats> {
  const bucketName = process.env.CACHE_BUCKET;
  if (!bucketName) {
    console.log('[getSharedCacheStats] CACHE_BUCKET environment variable not found');
    return { size: 0, keys: [], entries: [] };
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const fetchCachePrefix = 'fetch-cache/';
  const routeCachePrefix = 'route-cache/';

  const keys: string[] = [];
  const entries: CacheEntryInfo[] = [];

  try {
    // Process fetch cache files
    try {
      const [fetchFiles] = await bucket.getFiles({ prefix: fetchCachePrefix });
      const jsonFiles = fetchFiles.filter((file: any) => file.name.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const cacheKey = file.name.replace(fetchCachePrefix, '').replace('.json', '').replace(/_/g, '-');
          const displayKey = `fetch:${cacheKey}`;
          keys.push(displayKey);

          // Read the cache file to extract tags
          const [data] = await file.download();
          const cacheData = JSON.parse(data.toString());

          entries.push({
            key: displayKey,
            tags: cacheData.tags || [],
            lastModified: cacheData.lastModified || Date.now(),
            type: 'fetch'
          });
        } catch (fileError) {
          console.warn(`[getSharedCacheStats] Error reading fetch cache file ${file.name}:`, fileError);
          // Add entry with empty tags if file can't be read
          const cacheKey = file.name.replace(fetchCachePrefix, '').replace('.json', '').replace(/_/g, '-');
          const displayKey = `fetch:${cacheKey}`;
          keys.push(displayKey);
          entries.push({
            key: displayKey,
            tags: [],
            type: 'fetch'
          });
        }
      }
    } catch (error) {
      console.warn('[getSharedCacheStats] Error reading fetch cache:', error);
    }

    // Process route cache files
    try {
      const [routeFiles] = await bucket.getFiles({ prefix: routeCachePrefix });
      const jsonFiles = routeFiles.filter((file: any) => file.name.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const cacheKey = file.name.replace(routeCachePrefix, '').replace('.json', '').replace(/_/g, '-');
          const displayKey = `route:${cacheKey}`;
          keys.push(displayKey);

          // Read the cache file to extract tags
          const [data] = await file.download();
          const cacheData = JSON.parse(data.toString());

          entries.push({
            key: displayKey,
            tags: cacheData.tags || [],
            lastModified: cacheData.lastModified || Date.now(),
            type: 'route'
          });
        } catch (fileError) {
          console.warn(`[getSharedCacheStats] Error reading route cache file ${file.name}:`, fileError);
          // Add entry with empty tags if file can't be read
          const cacheKey = file.name.replace(routeCachePrefix, '').replace('.json', '').replace(/_/g, '-');
          const displayKey = `route:${cacheKey}`;
          keys.push(displayKey);
          entries.push({
            key: displayKey,
            tags: [],
            type: 'route'
          });
        }
      }
    } catch (error) {
      console.warn('[getSharedCacheStats] Error reading route cache:', error);
    }

    console.log(`[getSharedCacheStats] Found ${keys.length} cache entries (${keys.filter(k => k.startsWith('fetch:')).length} fetch, ${keys.filter(k => k.startsWith('route:')).length} route)`);

    return {
      size: keys.length,
      keys: keys,
      entries: entries
    };
  } catch (error) {
    console.log(`[getSharedCacheStats] Error reading cache:`, error);
    return { size: 0, keys: [], entries: [] };
  }
}

/**
 * Get static routes from prerender-manifest.json
 * Static routes have initialRevalidateSeconds: false (never revalidate)
 * These should not be cleared as they are built during build time
 */
function getStaticRoutes(): Set<string> {
  const staticRoutes = new Set<string>();

  try {
    const manifestPath = path.join(process.cwd(), '.next', 'prerender-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return staticRoutes;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const routes = manifest.routes || {};

    for (const [route, config] of Object.entries(routes)) {
      // initialRevalidateSeconds: false means truly static (SSG)
      // initialRevalidateSeconds: number means ISR (can be cleared)
      if ((config as any).initialRevalidateSeconds === false) {
        // Convert route to cache key format (e.g., "/ssg-demo" -> "_ssg-demo")
        const cacheKey = route === '/' ? '_index' : route.replace(/\//g, '_');
        staticRoutes.add(cacheKey);
      }
    }

    console.log(`[clearSharedCache] Found ${staticRoutes.size} static routes to preserve`);
  } catch (error) {
    // If we can't read the manifest, don't preserve any routes
  }

  return staticRoutes;
}

export async function clearSharedCache(): Promise<number> {
  const bucketName = process.env.CACHE_BUCKET;
  if (!bucketName) {
    console.log('[clearSharedCache] CACHE_BUCKET environment variable not found');
    return 0;
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const fetchCachePrefix = 'fetch-cache/';
  const routeCachePrefix = 'route-cache/';
  const tagsFilePath = 'cache/tags/tags.json';

  // Get static routes that should not be cleared
  const staticRoutes = getStaticRoutes();

  let clearedCount = 0;
  let preservedCount = 0;

  try {
    // Clear fetch cache (data cache - always clearable)
    try {
      const [fetchFiles] = await bucket.getFiles({ prefix: fetchCachePrefix });
      const jsonFiles = fetchFiles.filter(file => file.name.endsWith('.json'));

      const deletePromises = jsonFiles.map(file => file.delete());
      await Promise.all(deletePromises);
      clearedCount += jsonFiles.length;

      console.log(`[clearSharedCache] Cleared ${jsonFiles.length} fetch cache entries`);
    } catch (error) {
      console.warn('[clearSharedCache] Error clearing fetch cache:', error);
    }

    // Clear route cache (skip static routes)
    try {
      const [routeFiles] = await bucket.getFiles({ prefix: routeCachePrefix });
      const jsonFiles = routeFiles.filter(file => file.name.endsWith('.json'));

      const filesToDelete: any[] = [];
      for (const file of jsonFiles) {
        // Extract cache key from file path (e.g., "route-cache/_ssg-demo.json" -> "_ssg-demo")
        const cacheKey = file.name.replace(routeCachePrefix, '').replace('.json', '');

        // Check if this is a static route that should be preserved
        if (staticRoutes.has(cacheKey)) {
          preservedCount++;
          continue;
        }

        filesToDelete.push(file);
      }

      const deletePromises = filesToDelete.map(file => file.delete());
      await Promise.all(deletePromises);
      clearedCount += filesToDelete.length;

      console.log(`[clearSharedCache] Route cache: cleared ${filesToDelete.length}, preserved ${preservedCount} static routes`);
    } catch (error) {
      console.warn('[clearSharedCache] Error clearing route cache:', error);
    }

    // Clear tags mapping
    try {
      const tagsFile = bucket.file(tagsFilePath);
      const [exists] = await tagsFile.exists();
      if (exists) {
        await tagsFile.delete();
      }
    } catch (error) {
      // Ignore errors
    }

    console.log(`[clearSharedCache] Total cleared: ${clearedCount} cache entries`);

    // Clear edge cache if configured and entries were cleared
    if (clearedCount > 0) {
      try {
        const edgeCacheClearer = new EdgeCacheClear();
        edgeCacheClearer.nukeCacheInBackground('shared cache clear');
      } catch (error) {
        // Silently fail
      }
    }

    return clearedCount;
  } catch (error) {
    console.log(`[clearSharedCache] Error clearing cache:`, error);
    return 0;
  }
}