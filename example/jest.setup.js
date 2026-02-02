// Jest setup file for integration tests

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.CACHE_HANDLER = 'file' // Force file cache handler for testing

// Ensure we have a clean cache directory for each test
const fs = require('fs')
const path = require('path')

// Clean up cache directory before tests
beforeAll(async () => {
  const cacheDir = path.join(process.cwd(), '.next', 'cache')
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  }
})