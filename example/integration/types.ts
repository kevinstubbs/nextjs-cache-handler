/**
 * TypeScript types for Next.js cache file structures
 * Based on actual cache files from .next/cache/fetch-cache/
 */

export interface NextJsFetchCacheData {
  headers: Record<string, string>
  body: string // Base64 encoded response body
  status: number
  url: string
}

export interface NextJsFetchCacheValue {
  kind: 'FETCH'
  data: NextJsFetchCacheData
  revalidate: number // Revalidation time in seconds
}

export interface NextJsCacheFile {
  value: NextJsFetchCacheValue
  lastModified: number // Timestamp in milliseconds
  tags: string[] // Cache tags for invalidation
}

// Type guard to check if data is a valid cache file
export function isValidNextJsCacheFile(data: any): data is NextJsCacheFile {
  return (
    data &&
    typeof data === 'object' &&
    data.value &&
    data.value.kind === 'FETCH' &&
    data.value.data &&
    typeof data.value.data.status === 'number' &&
    typeof data.value.data.url === 'string' &&
    typeof data.value.data.body === 'string' &&
    typeof data.value.revalidate === 'number' &&
    typeof data.lastModified === 'number' &&
    Array.isArray(data.tags)
  )
}

// Helper to decode base64 body content
export function decodeCacheBody(body: string): string {
  try {
    return Buffer.from(body, 'base64').toString('utf-8')
  } catch (error) {
    throw new Error(`Failed to decode cache body: ${error}`)
  }
}