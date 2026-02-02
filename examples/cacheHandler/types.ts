import type {
  CacheHandler as NextCacheHandler,
  CacheHandlerValue as NextCacheHandlerValue,
} from "next/dist/server/lib/incremental-cache";

import type FileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache";

export interface CacheContext {
  fetchCache?: boolean;
  fetchUrl?: string;
  fetchIdx: number;
  tags?: string[];
  isImplicitBuildTimeCache: false
}

export interface CacheEntry {
  value: any;
  lastModified: number;
  tags: string[];
}

export interface CacheData {
  [key: string]: any; // Direct storage of Next.js cache values without wrapper
}

export interface SerializedBuffer {
  type: 'Buffer';
  data: string; // base64 encoded buffer data
}

export interface SerializedMap {
  type: 'Map';
  data: Record<string, unknown>;
}

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SerializedBuffer
  | SerializedMap
  | Record<string, unknown>
  | unknown[];

export interface SerializedCacheData {
  [key: string]: {
    value: SerializableValue;
    lastModified: number;
    tags: Readonly<string[]>;
  };
}

export interface CacheEntryInfo {
  key: string;
  tags: string[];
  lastModified?: number;
  type: 'fetch' | 'route';
}

export interface CacheStats {
  size: number;
  keys: string[];
  entries: CacheEntryInfo[];
}

export declare class CacheHandler implements NextCacheHandler {
  /**
   * Creates a new CacheHandler instance. Constructor is intended for internal use only.
   */
  constructor(context: FileSystemCacheContext);
  get(
    cacheKey: CacheHandlerParametersGet[0],
    ctx?: CacheHandlerParametersGet[1],
  ): Promise<CacheHandlerValue | null>;
  set(
    cacheKey: CacheHandlerParametersSet[0],
    incrementalCacheValue: CacheHandlerParametersSet[1],
    ctx: CacheHandlerParametersSet[2] & {
      internal_lastModified?: number;
    },
  ): Promise<void>;
  revalidateTag(tag: CacheHandlerParametersRevalidateTag[0]): Promise<void>;
  resetRequestCache(): void;
}

export type CacheHandlerParametersGet = Parameters<NextCacheHandler["get"]>;
export type CacheHandlerParametersSet = Parameters<NextCacheHandler["set"]>;
export type FileSystemCacheContext = ConstructorParameters<typeof FileSystemCache>[0];
export type CacheHandlerParametersRevalidateTag = Parameters<NextCacheHandler["revalidateTag"]>;

export type CacheHandlerValue = NextCacheHandlerValue & {
  /**
   * Timestamp in milliseconds when the cache entry was last modified.
   */
  lastModified: number;
  /**
   * Tags associated with the cache entry. They are used for on-demand revalidation.
   */
  tags: Readonly<string[]>;
};


export type Revalidate = false | number;
/**
 * A set of time periods and timestamps for controlling cache behavior.
 */
export type LifespanParameters = {
  /**
   * The Unix timestamp (in seconds) for when the cache entry was last modified.
   */
  readonly lastModifiedAt: number;
  /**
   * The Unix timestamp (in seconds) for when the cache entry entry becomes stale.
   * After this time, the entry is considered staled and may be used.
   */
  readonly staleAt: number;
  /**
   * The Unix timestamp (in seconds) for when the cache entry must be removed from the cache.
   * After this time, the entry is considered expired and should not be used.
   */
  readonly expireAt: number;
  /**
   * Time in seconds before the cache entry becomes stale.
   */
  readonly staleAge: number;
  /**
   * Time in seconds before the cache entry becomes expired.
   */
  readonly expireAge: number;
  /**
   * Value from Next.js revalidate option. May be false if the page has no revalidate option or the revalidate option is set to false.
   */
  readonly revalidate: Revalidate | undefined;
};