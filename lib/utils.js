/**
 * Utility functions for Shodan client
 */

const fs = require('fs');
const path = require('path');

/**
 * Read API key from environment or file
 */
function getApiKey() {
  // Try environment variable first
  if (process.env.SHODAN_API_KEY) {
    return process.env.SHODAN_API_KEY;
  }

  // Try default locations
  const possiblePaths = [
    path.join(process.env.HOME, '.shodan', 'key'),
    path.join(process.env.HOME, '.openclaw', 'workspace', 'TOOLS.md'),
  ];

  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        // If it's a simple key file
        if (filePath.includes('.shodan')) {
          return content.trim();
        }
        // If it's TOOLS.md, try to extract SHODAN_API_KEY
        const match = content.match(/SHODAN_API_KEY[:\s]+([a-zA-Z0-9]+)/);
        if (match) return match[1];
      }
    } catch (err) {
      // Continue searching
    }
  }

  throw new Error(
    'Shodan API key not found. Set SHODAN_API_KEY env var or add to ~/.shodan/key'
  );
}

/**
 * Format response with metadata
 */
function formatResponse(method, query, data, creditsUsed = 1) {
  return {
    success: true,
    method,
    query,
    results: data,
    metadata: {
      timestamp: new Date().toISOString(),
      creditsUsed,
      cached: false,
    },
  };
}

/**
 * Format error response
 */
function formatError(method, query, error) {
  return {
    success: false,
    method,
    query,
    error: error.message,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = {
  getApiKey,
  formatResponse,
  formatError,
};
