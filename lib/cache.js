/**
 * Result Caching with TTL
 * File-based cache to avoid wasting API credits on repeated queries
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(process.env.HOME, '.openclaw', 'workspace', '.shodan-cache');
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Initialize cache directory
 */
function initCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Generate cache key from method and params
 */
function getCacheKey(method, params) {
  const key = `${method}:${JSON.stringify(params)}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get cache file path
 */
function getCachePath(cacheKey) {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

/**
 * Read from cache
 * @param {string} method - API method name
 * @param {object} params - Query parameters
 * @returns {object|null} Cached data or null if expired/missing
 */
function get(method, params) {
  const cacheKey = getCacheKey(method, params);
  const cachePath = getCachePath(cacheKey);

  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const now = Date.now();
    const age = now - cached.timestamp;

    // Check if cache has expired
    if (age > cached.ttl) {
      fs.unlinkSync(cachePath); // Delete expired cache
      return null;
    }

    return {
      ...cached.data,
      _cached: true,
      _cacheAge: Math.floor(age / 1000), // Age in seconds
    };
  } catch (error) {
    return null;
  }
}

/**
 * Write to cache
 * @param {string} method - API method name
 * @param {object} params - Query parameters
 * @param {object} data - Data to cache
 * @param {number} ttl - Time-to-live in milliseconds (default: 24h)
 */
function set(method, params, data, ttl = DEFAULT_TTL) {
  initCache();
  const cacheKey = getCacheKey(method, params);
  const cachePath = getCachePath(cacheKey);

  try {
    const cacheEntry = {
      method,
      params,
      data,
      timestamp: Date.now(),
      ttl,
      expires: new Date(Date.now() + ttl).toISOString(),
    };

    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2));
  } catch (error) {
    console.error(`Cache write failed for ${method}:`, error.message);
  }
}

/**
 * Clear all cache
 */
function clear() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      });
    }
    return { cleared: true };
  } catch (error) {
    throw new Error(`Failed to clear cache: ${error.message}`);
  }
}

/**
 * Clear specific cache entry
 * @param {string} method - API method name
 * @param {object} params - Query parameters
 */
function clearEntry(method, params) {
  const cacheKey = getCacheKey(method, params);
  const cachePath = getCachePath(cacheKey);

  try {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      return { cleared: true };
    }
    return { cleared: false, reason: 'Cache entry not found' };
  } catch (error) {
    throw new Error(`Failed to clear cache entry: ${error.message}`);
  }
}

/**
 * Get cache stats
 */
function stats() {
  try {
    initCache();
    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      const stat = fs.statSync(filePath);
      totalSize += stat.size;

      try {
        const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const age = Date.now() - cached.timestamp;

        if (age > cached.ttl) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      } catch (err) {
        // Ignore parse errors
      }
    });

    return {
      totalFiles: files.length,
      validEntries,
      expiredEntries,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      cacheDir: CACHE_DIR,
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * List all cached entries
 */
function list() {
  try {
    initCache();
    const files = fs.readdirSync(CACHE_DIR);
    const entries = [];

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const age = Date.now() - cached.timestamp;
        const isExpired = age > cached.ttl;

        entries.push({
          method: cached.method,
          params: cached.params,
          cached: new Date(cached.timestamp).toISOString(),
          expires: cached.expires,
          age: Math.floor(age / 1000),
          expired: isExpired,
        });
      } catch (err) {
        // Ignore parse errors
      }
    });

    return entries.sort((a, b) => new Date(b.cached) - new Date(a.cached));
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  get,
  set,
  clear,
  clearEntry,
  stats,
  list,
};
