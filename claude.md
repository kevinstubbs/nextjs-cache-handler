# Next.js Custom Cache Handler Project

## Project Overview

This project implements a Next.js 15 application with custom cache handlers that support both Google Cloud Storage (GCS) and file-based caching systems. The implementation includes advanced features like tag-based cache invalidation with performance optimization through tag-to-keys mapping.

### Key Features

- **Dual Cache Handlers**: Support for both GCS and file-based caching
- **Tag-Based Invalidation**: Efficient O(1) cache invalidation using tag mapping
- **Buffer Serialization**: Handles Next.js 15 buffer compatibility issues
- **Cache Statistics**: Real-time cache monitoring and management
- **Interactive UI**: Cache testing and management interface
- **Environment-Specific Configuration**: Automatic handler selection based on environment

### Architecture

```
cacheHandler/
├── gcs-cache-handler.ts        # Google Cloud Storage implementation
├── file-cache-handler.ts       # File system implementation
├── types.ts                    # Shared TypeScript interfaces
└── index.ts                    # Handler selection logic

app/
├── api/cache-stats/route.ts    # Cache statistics API
└── cache-test/page.tsx         # Cache management UI
```

### Cache Handler Interface

Both handlers implement the Next.js cache handler interface:

- `get(key)`: Retrieve cached data
- `set(key, data, context)`: Store data with optional tags
- `revalidateTag(tag)`: Invalidate all entries with specific tag
- `resetRequestCache()`: Reset per-request cache

### Performance Optimization

**Tag Mapping System**: Instead of iterating through all cache files during tag invalidation (O(n)), we maintain a separate mapping file that stores tag-to-keys relationships for O(1) lookups:

```
GCS: cache/tags/tags.json
File: .next/cache/tags/tags.json
```

## Development Guidelines

### Code Structure Principles

#### 1. Prefer Smaller Functions

Break down complex operations into smaller, focused functions with single responsibilities.

**Good:**

```typescript
async function validateCacheKey(key: string): boolean {
  return key && key.length > 0;
}

async function buildCachePath(key: string, type: "fetch" | "route"): string {
  return `${type}-cache/${key}.json`;
}

async function setCacheEntry(
  key: string,
  data: any,
  type: "fetch" | "route",
): Promise<void> {
  if (!validateCacheKey(key)) {
    throw new Error("Invalid cache key");
  }

  const path = buildCachePath(key, type);
  await writeToStorage(path, data);
}
```

**Avoid:**

```typescript
async function setCacheEntry(
  key: string,
  data: any,
  type: "fetch" | "route",
): Promise<void> {
  if (key && key.length > 0) {
    const path = `${type}-cache/${key}.json`;
    // ... 50+ lines of complex logic
  }
}
```

#### 2. Avoid Multiple Encapsulation

Instead of nesting if statements, break logic into separate functions or use early returns.

**Good:**

```typescript
async function processTagInvalidation(
  tag: string,
  tagsMapping: Record<string, string[]>,
): Promise<string[]> {
  const cacheKeys = tagsMapping[tag] || [];

  if (cacheKeys.length === 0) {
    console.log(`No cache entries found for tag: ${tag}`);
    return [];
  }

  return await deleteCacheEntries(cacheKeys);
}

async function deleteCacheEntries(keys: string[]): Promise<string[]> {
  const deletedKeys: string[] = [];

  for (const key of keys) {
    const wasDeleted = await deleteSingleCacheEntry(key);
    if (wasDeleted) {
      deletedKeys.push(key);
    }
  }

  return deletedKeys;
}
```

**Avoid:**

```typescript
async function processTagInvalidation(
  tag: string,
  tagsMapping: Record<string, string[]>,
): Promise<string[]> {
  const cacheKeys = tagsMapping[tag] || [];

  if (cacheKeys.length > 0) {
    const deletedKeys: string[] = [];

    for (const key of keys) {
      if (await checkCacheExists(key)) {
        if (await deleteCacheEntry(key)) {
          deletedKeys.push(key);
        }
      }
    }

    return deletedKeys;
  }

  return [];
}
```

#### 3. Prefer Flatter Code Structure

Use early returns and guard clauses to reduce nesting levels.

**Good:**

```typescript
async function updateTagsMapping(key: string, tags: string[]): Promise<void> {
  if (!tags || tags.length === 0) {
    return;
  }

  const mapping = await readTagsMapping();

  for (const tag of tags) {
    if (!mapping[tag]) {
      mapping[tag] = [];
    }

    if (!mapping[tag].includes(key)) {
      mapping[tag].push(key);
    }
  }

  await writeTagsMapping(mapping);
}
```

**Avoid:**

```typescript
async function updateTagsMapping(key: string, tags: string[]): Promise<void> {
  if (tags && tags.length > 0) {
    const mapping = await readTagsMapping();

    for (const tag of tags) {
      if (!mapping[tag]) {
        mapping[tag] = [];

        if (!mapping[tag].includes(key)) {
          mapping[tag].push(key);
        }
      }
    }

    await writeTagsMapping(mapping);
  }
}
```

#### 4. Targeted Try-Catch Blocks

Use specific, focused try-catch blocks rather than wrapping large code sections.

**Good:**

```typescript
async function getCacheEntry(key: string): Promise<CacheData | null> {
  const data = await readCacheFile(key);

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    return deserializeCacheData(parsed);
  } catch (parseError) {
    console.warn(`Failed to parse cache data for key ${key}:`, parseError);
    return null;
  }
}

async function readCacheFile(key: string): Promise<string | null> {
  try {
    return await fs.readFile(buildCachePath(key), "utf-8");
  } catch (readError) {
    if (readError.code === "ENOENT") {
      return null; // File doesn't exist
    }
    throw readError; // Re-throw unexpected errors
  }
}
```

**Avoid:**

```typescript
async function getCacheEntry(key: string): Promise<CacheData | null> {
  try {
    const data = await fs.readFile(buildCachePath(key), "utf-8");
    const parsed = JSON.parse(data);
    const deserialized = deserializeCacheData(parsed);

    // ... many other operations

    return deserialized;
  } catch (error) {
    // Generic catch-all that loses context
    console.warn(`Something went wrong:`, error);
    return null;
  }
}
```

#### 5. Function Naming and Documentation

Use descriptive function names that clearly indicate purpose and include comments explaining objectives.

**Good:**

```typescript
/**
 * Initializes the tag mapping system by creating the tags.json file if it doesn't exist.
 * This file maintains tag-to-cache-keys relationships for efficient invalidation.
 */
async function initializeTagsMapping(): Promise<void> {
  const exists = await checkTagsMappingExists();

  if (!exists) {
    await createEmptyTagsMapping();
  }
}

/**
 * Removes multiple cache keys from all tag mappings in a single operation.
 * This is more efficient than removing keys one by one.
 */
async function removeKeysFromTagMapping(keysToRemove: string[]): Promise<void> {
  const mapping = await readTagsMapping();
  const updatedMapping = removeKeysFromMapping(mapping, keysToRemove);
  await writeTagsMapping(updatedMapping);
}

/**
 * Extracts cache tags from serialized cache data.
 * Returns empty array if no tags are found or data is invalid.
 */
function extractTagsFromCacheData(data: SerializedCacheData): string[] {
  return data?.revalidate?.tags || [];
}
```

### Error Handling Strategy

1. **Specific Error Types**: Catch and handle specific error conditions
2. **Graceful Degradation**: Provide fallbacks when operations fail
3. **Meaningful Logging**: Include context in error messages
4. **Resource Cleanup**: Ensure proper cleanup in error scenarios

### Testing Considerations

- Each small function is easier to unit test
- Flatter code reduces test complexity
- Specific error handling allows for precise test assertions
- Well-named functions make test descriptions clearer

### Performance Notes

- The tag mapping optimization reduces cache invalidation from O(n) to O(1)
- Smaller functions enable better compiler optimizations
- Targeted error handling reduces unnecessary exception processing
- Flat code structure improves execution path predictability

## Environment Configuration

```bash
# .env
CACHE_HANDLER=gcs          # Use 'gcs' for Google Cloud Storage or 'file' for local files
CACHE_BUCKET=your-bucket   # Required when using GCS handler
```

## API Endpoints

- `GET /api/cache-stats` - Retrieve cache statistics and entry details
- `DELETE /api/cache-stats` - Clear all cache entries and tag mappings

## Cache Testing

Visit `/cache-test` for an interactive interface to:

- View cache statistics
- Browse cache entries with tags
- Test cache invalidation by tag
- Clear cache storage
