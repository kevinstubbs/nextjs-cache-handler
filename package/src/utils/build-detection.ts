import * as fs from 'fs';
import * as path from 'path';

/**
 * Detects if the current process is running during the Next.js build phase.
 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Gets the Next.js build ID from the build manifest.
 * This ID is stable and unique per build, unlike file modification times.
 */
export function getBuildId(): string {
  const buildIdFromFile = readBuildIdFromFile();
  if (buildIdFromFile) {
    return buildIdFromFile;
  }

  const buildIdFromManifest = extractBuildIdFromManifest();
  if (buildIdFromManifest) {
    return buildIdFromManifest;
  }

  return `fallback-${Date.now()}`;
}

function readBuildIdFromFile(): string | null {
  try {
    const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
    if (fs.existsSync(buildIdPath)) {
      return fs.readFileSync(buildIdPath, 'utf-8').trim();
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function extractBuildIdFromManifest(): string | null {
  try {
    const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const lowPriorityFiles = manifest.lowPriorityFiles || [];

    // Build ID is in paths like "static/DsOqQ6QE7Bo_OEhUjVFCD/_buildManifest.js"
    for (const file of lowPriorityFiles) {
      const match = file.match(/static\/([^/]+)\/_/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}
