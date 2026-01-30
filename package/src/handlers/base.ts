import type {
  CacheData,
  CacheHandlerParametersGet,
  CacheHandlerParametersSet,
  CacheHandlerParametersRevalidateTag,
  CacheHandlerValue,
  FileSystemCacheContext,
  Revalidate,
  SerializedCacheData,
} from '../types.js';
import { serializeForStorage, deserializeFromStorage } from '../utils/serialization.js';
import { getBuildId, isBuildPhase } from '../utils/build-detection.js';

// Global singleton to track if build invalidation has been checked for this process
let buildInvalidationChecked = false;

/**
 * Reset the build invalidation check flag.
 * Useful for testing purposes.
 * @internal
 */
export function resetBuildInvalidationCheck(): void {
  buildInvalidationChecked = false;
}

export interface BuildMeta {
  buildId: string;
  timestamp: number;
}

/**
 * Abstract base class for cache handlers.
 * Provides shared functionality for tag mapping, serialization, and build invalidation.
 */
export abstract class BaseCacheHandler {
  protected readonly context: FileSystemCacheContext;
  protected readonly handlerName: string;

  constructor(context: FileSystemCacheContext, handlerName: string) {
    this.context = context;
    this.handlerName = handlerName;

    // Only log during server runtime, not during build (too noisy with parallel workers)
    if (!isBuildPhase()) {
      console.log(`[${this.handlerName}] Initializing cache handler`);
    }
  }

  /**
   * Initialize the handler. Should be called after construction.
   * Handles build invalidation check and tags mapping initialization.
   */
  protected async initialize(): Promise<void> {
    await this.initializeTagsMapping();

    // Only check build invalidation once per process
    // Skip during build phase to avoid race conditions with parallel workers
    if (!buildInvalidationChecked && !isBuildPhase()) {
      await this.checkBuildInvalidation();
      buildInvalidationChecked = true;
    }
  }

  /**
   * Synchronous initialization for handlers that need to initialize in constructor.
   */
  protected initializeSync(): void {
    this.initializeTagsMappingSync();

    if (!buildInvalidationChecked && !isBuildPhase()) {
      this.checkBuildInvalidation();
      buildInvalidationChecked = true;
    }
  }

  // ============================================================================
  // Abstract methods to be implemented by subclasses
  // ============================================================================

  protected abstract initializeTagsMapping(): Promise<void>;
  protected abstract initializeTagsMappingSync(): void;
  protected abstract readTagsMapping(): Promise<Record<string, string[]>>;
  protected abstract readTagsMappingSync(): Record<string, string[]>;
  protected abstract writeTagsMapping(tagsMapping: Record<string, string[]>): Promise<void>;
  protected abstract writeTagsMappingSync(tagsMapping: Record<string, string[]>): void;

  protected abstract readCacheEntry(cacheKey: string, cacheType: 'fetch' | 'route'): Promise<CacheHandlerValue | null>;
  protected abstract writeCacheEntry(cacheKey: string, cacheValue: CacheHandlerValue, cacheType: 'fetch' | 'route'): Promise<void>;
  protected abstract deleteCacheEntry(cacheKey: string, cacheType: 'fetch' | 'route'): Promise<void>;

  protected abstract readBuildMeta(): Promise<BuildMeta>;
  protected abstract writeBuildMeta(meta: BuildMeta): Promise<void>;
  protected abstract invalidateRouteCache(): Promise<void>;

  // ============================================================================
  // Shared tag mapping methods
  // ============================================================================

  protected async updateTagsMapping(cacheKey: string, tags: string[], isDelete = false): Promise<void> {
    try {
      const tagsMapping = await this.readTagsMapping();

      if (isDelete) {
        this.removeKeysFromAllTags(tagsMapping, [cacheKey]);
      } else {
        this.addKeyToTags(tagsMapping, cacheKey, tags);
      }

      await this.writeTagsMapping(tagsMapping);
    } catch (error) {
      console.error(`[${this.handlerName}] Error updating tags mapping:`, error);
    }
  }

  protected async updateTagsMappingBulkDelete(
    cacheKeysToDelete: string[],
    tagsMapping: Record<string, string[]>
  ): Promise<void> {
    try {
      this.removeKeysFromAllTags(tagsMapping, cacheKeysToDelete);
      await this.writeTagsMapping(tagsMapping);
    } catch (error) {
      console.error(`[${this.handlerName}] Error bulk updating tags mapping:`, error);
    }
  }

  /**
   * Removes cache keys from all tag mappings they're associated with.
   * This is used when cache entries are deleted to keep the tag mapping consistent.
   * Empty tags are cleaned up automatically.
   */
  private removeKeysFromAllTags(tagsMapping: Record<string, string[]>, keysToRemove: string[]): void {
    const keysSet = new Set(keysToRemove);

    for (const tag of Object.keys(tagsMapping)) {
      tagsMapping[tag] = tagsMapping[tag].filter((key) => !keysSet.has(key));
      if (tagsMapping[tag].length === 0) {
        delete tagsMapping[tag];
      }
    }
  }

  private addKeyToTags(tagsMapping: Record<string, string[]>, cacheKey: string, tags: string[]): void {
    for (const tag of tags) {
      if (!tagsMapping[tag]) {
        tagsMapping[tag] = [];
      }
      if (!tagsMapping[tag].includes(cacheKey)) {
        tagsMapping[tag].push(cacheKey);
      }
    }
  }

  // ============================================================================
  // Build invalidation
  // ============================================================================

  private async checkBuildInvalidation(): Promise<void> {
    const currentBuildId = getBuildId();

    try {
      const buildMeta = await this.readBuildMeta();

      if (buildMeta.buildId !== currentBuildId) {
        console.log(
          `[${this.handlerName}] New build detected (${buildMeta.buildId} -> ${currentBuildId}), invalidating route cache`
        );

        await this.invalidateRouteCache();

        await this.writeBuildMeta({
          buildId: currentBuildId,
          timestamp: Date.now(),
        });
      }
    } catch {
      // No previous build metadata - first run, just save current build ID
      await this.writeBuildMeta({
        buildId: currentBuildId,
        timestamp: Date.now(),
      });
    }
  }

  // ============================================================================
  // Serialization helpers
  // ============================================================================

  protected serializeForStorage(data: CacheData): SerializedCacheData {
    return serializeForStorage(data);
  }

  protected deserializeFromStorage(data: SerializedCacheData): CacheData {
    return deserializeFromStorage(data);
  }

  // ============================================================================
  // Cache type determination
  // ============================================================================

  protected determineCacheType(ctx?: CacheHandlerParametersGet[1]): 'fetch' | 'route' {
    if (!ctx) {
      return 'route';
    }

    if ('fetchCache' in ctx && ctx.fetchCache === true) {
      return 'fetch';
    }

    if ('fetchUrl' in ctx) {
      return 'fetch';
    }

    if ('fetchIdx' in ctx) {
      return 'fetch';
    }

    return 'route';
  }

  protected determineCacheTypeFromValue(incrementalCacheValue: CacheHandlerParametersSet[1]): 'fetch' | 'route' {
    if (
      incrementalCacheValue &&
      typeof incrementalCacheValue === 'object' &&
      'kind' in incrementalCacheValue &&
      incrementalCacheValue.kind === 'FETCH'
    ) {
      return 'fetch';
    }
    return 'route';
  }

  // ============================================================================
  // CacheHandler interface implementation
  // ============================================================================

  async get(
    cacheKey: CacheHandlerParametersGet[0],
    ctx?: CacheHandlerParametersGet[1]
  ): Promise<CacheHandlerValue | null> {
    console.log(`[${this.handlerName}] GET: ${cacheKey}`);

    try {
      const cacheType = this.determineCacheType(ctx);
      const entry = await this.readCacheEntry(cacheKey, cacheType);

      if (!entry) {
        console.log(`[${this.handlerName}] MISS: ${cacheKey} (${cacheType})`);
        return null;
      }

      console.log(`[${this.handlerName}] HIT: ${cacheKey} (${cacheType})`, {
        entryType: typeof entry,
        hasValue: entry && typeof entry === 'object' && 'value' in entry,
      });

      return entry;
    } catch (error) {
      console.error(`[${this.handlerName}] Error reading cache for key ${cacheKey}:`, error);
      return null;
    }
  }

  async set(
    cacheKey: CacheHandlerParametersSet[0],
    incrementalCacheValue: CacheHandlerParametersSet[1],
    ctx: CacheHandlerParametersSet[2] & {
      tags?: string[];
      revalidate?: Revalidate;
    }
  ): Promise<void> {
    const cacheType = this.determineCacheTypeFromValue(incrementalCacheValue);

    console.log(`[${this.handlerName}] SET: ${cacheKey} (${cacheType})`, {
      valueType: typeof incrementalCacheValue,
      hasKind: incrementalCacheValue && typeof incrementalCacheValue === 'object' && 'kind' in incrementalCacheValue,
    });

    try {
      const { tags = [] } = ctx;

      const cacheHandlerValue: CacheHandlerValue = {
        value: incrementalCacheValue,
        lastModified: Date.now(),
        tags: Object.freeze(tags),
      };

      await this.writeCacheEntry(cacheKey, cacheHandlerValue, cacheType);

      if (tags.length > 0) {
        await this.updateTagsMapping(cacheKey, tags);
        console.log(`[${this.handlerName}] Updated tags mapping for ${cacheKey} with tags:`, tags);
      }

      console.log(`[${this.handlerName}] Cached ${cacheKey} in ${cacheType} cache`);
    } catch (error) {
      console.error(`[${this.handlerName}] Error setting cache for key ${cacheKey}:`, error);
    }
  }

  async revalidateTag(tag: CacheHandlerParametersRevalidateTag[0]): Promise<void> {
    console.log(`[${this.handlerName}] REVALIDATE TAG: ${tag}`);

    const tagArray = [tag].flat();
    const deletedKeys: string[] = [];

    let tagsMapping: Record<string, string[]>;
    try {
      tagsMapping = await this.readTagsMapping();
    } catch (error) {
      console.error(`[${this.handlerName}] Error reading tags mapping during revalidateTag:`, error);
      tagsMapping = {};
    }

    for (const currentTag of tagArray) {
      const cacheKeysForTag = tagsMapping[currentTag] || [];

      if (cacheKeysForTag.length === 0) {
        console.log(`[${this.handlerName}] No cache entries found for tag: ${currentTag}`);
        continue;
      }

      console.log(`[${this.handlerName}] Found ${cacheKeysForTag.length} cache entries for tag: ${currentTag}`);

      for (const cacheKey of cacheKeysForTag) {
        const deleted = await this.tryDeleteCacheEntry(cacheKey);
        if (deleted) {
          deletedKeys.push(cacheKey);
        }
      }
    }

    if (deletedKeys.length > 0) {
      await this.updateTagsMappingBulkDelete(deletedKeys, tagsMapping);
      console.log(`[${this.handlerName}] Updated tags mapping after deleting ${deletedKeys.length} entries`);
    }

    console.log(`[${this.handlerName}] Revalidated ${deletedKeys.length} entries for tags: ${tagArray.join(', ')}`);

    // Hook for subclasses to perform additional cleanup (e.g., edge cache clearing)
    await this.onRevalidateComplete(tagArray, deletedKeys);
  }

  /**
   * Hook called after revalidation is complete.
   * Subclasses can override to perform additional cleanup.
   */
  protected async onRevalidateComplete(_tags: string[], _deletedKeys: string[]): Promise<void> {
    // Default implementation does nothing
  }

  private async tryDeleteCacheEntry(cacheKey: string): Promise<boolean> {
    // Try fetch cache first
    try {
      await this.deleteCacheEntry(cacheKey, 'fetch');
      console.log(`[${this.handlerName}] Deleted fetch cache entry: ${cacheKey}`);
      return true;
    } catch {
      // Entry might not exist in fetch cache
    }

    // Try route cache
    try {
      await this.deleteCacheEntry(cacheKey, 'route');
      console.log(`[${this.handlerName}] Deleted route cache entry: ${cacheKey}`);
      return true;
    } catch {
      console.warn(`[${this.handlerName}] Cache entry not found in either cache: ${cacheKey}`);
    }

    return false;
  }

  resetRequestCache(): void {
    console.log(`[${this.handlerName}] RESET REQUEST CACHE: No-op for this cache handler`);
    // For persistent cache handlers, this is typically a no-op since we're not maintaining
    // per-request caches. The storage backend is the source of truth.
  }
}
