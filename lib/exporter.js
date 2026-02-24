/**
 * Result Exporter
 * Export search results to CSV, JSON, and Markdown formats
 */

const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(process.env.HOME, '.openclaw', 'workspace', 'shodan-exports');

/**
 * Ensure export directory exists
 */
function initExport() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Generate timestamped filename
 */
function getFilename(query, ext) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const safeName = query.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return `${safeName}_${timestamp}.${ext}`;
}

/**
 * Export to JSON
 * @param {string} query - Original query
 * @param {object} results - Shodan results
 * @param {string} filename - Optional filename
 * @returns {object} Export result
 */
function toJSON(query, results, filename) {
  initExport();
  const file = filename || getFilename(query, 'json');
  const filepath = path.join(EXPORT_DIR, file);

  try {
    const data = {
      query,
      timestamp: new Date().toISOString(),
      total: results.total,
      matches: results.matches || [],
      facets: results.facets || {},
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    return {
      success: true,
      format: 'json',
      file,
      path: filepath,
      size: fs.statSync(filepath).size,
    };
  } catch (error) {
    throw new Error(`JSON export failed: ${error.message}`);
  }
}

/**
 * Export to CSV
 * @param {string} query - Original query
 * @param {object} results - Shodan results
 * @param {string} filename - Optional filename
 * @returns {object} Export result
 */
function toCSV(query, results, filename) {
  initExport();
  const file = filename || getFilename(query, 'csv');
  const filepath = path.join(EXPORT_DIR, file);

  try {
    const matches = results.matches || [];
    if (matches.length === 0) {
      throw new Error('No matches to export');
    }

    // CSV headers
    const headers = [
      'IP',
      'Port',
      'Product',
      'Version',
      'Organization',
      'Country',
      'City',
      'Hostname',
      'Last Updated',
    ];

    // CSV rows
    const rows = matches.map(match => [
      match.ip_str || '',
      match.port || '',
      match.product || '',
      match.version || '',
      match.org || '',
      match.country_code || '',
      match.location?.city || '',
      (match.hostnames || [])[0] || '',
      match.timestamp || '',
    ]);

    // Create CSV content
    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    fs.writeFileSync(filepath, csv);

    return {
      success: true,
      format: 'csv',
      file,
      path: filepath,
      size: fs.statSync(filepath).size,
      rows: rows.length,
    };
  } catch (error) {
    throw new Error(`CSV export failed: ${error.message}`);
  }
}

/**
 * Export to Markdown
 * @param {string} query - Original query
 * @param {object} results - Shodan results
 * @param {string} filename - Optional filename
 * @returns {object} Export result
 */
function toMarkdown(query, results, filename) {
  initExport();
  const file = filename || getFilename(query, 'md');
  const filepath = path.join(EXPORT_DIR, file);

  try {
    const matches = results.matches || [];
    const lines = [
      `# Shodan Search Results`,
      ``,
      `**Query:** \`${query}\``,
      `**Timestamp:** ${new Date().toISOString()}`,
      `**Total Results:** ${results.total || 0}`,
      `**Matches Exported:** ${matches.length}`,
      ``,
    ];

    // Facets section
    if (results.facets && Object.keys(results.facets).length > 0) {
      lines.push(`## Summary by Facet`);
      lines.push(``);

      Object.entries(results.facets).forEach(([facet, data]) => {
        lines.push(`### ${facet.charAt(0).toUpperCase() + facet.slice(1)}`);
        lines.push(``);
        if (Array.isArray(data)) {
          data.slice(0, 10).forEach(item => {
            lines.push(`- **${item.value}**: ${item.count} results`);
          });
        }
        lines.push(``);
      });
    }

    // Matches section
    lines.push(`## Detailed Results`);
    lines.push(``);

    matches.slice(0, 100).forEach((match, i) => {
      lines.push(`### ${i + 1}. ${match.ip_str}:${match.port}`);
      lines.push(``);
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| Product | ${match.product || 'N/A'} |`);
      lines.push(`| Version | ${match.version || 'N/A'} |`);
      lines.push(`| Organization | ${match.org || 'N/A'} |`);
      lines.push(`| Country | ${match.country_name || 'N/A'} |`);
      lines.push(`| Hostname | ${(match.hostnames || [])[0] || 'N/A'} |`);
      lines.push(`| Last Updated | ${match.timestamp || 'N/A'} |`);
      lines.push(``);
    });

    if (matches.length > 100) {
      lines.push(`\n> Showing first 100 of ${matches.length} results`);
    }

    const markdown = lines.join('\n');
    fs.writeFileSync(filepath, markdown);

    return {
      success: true,
      format: 'markdown',
      file,
      path: filepath,
      size: fs.statSync(filepath).size,
      rows: Math.min(matches.length, 100),
    };
  } catch (error) {
    throw new Error(`Markdown export failed: ${error.message}`);
  }
}

/**
 * Export results in multiple formats
 * @param {string} query - Original query
 * @param {object} results - Shodan results
 * @param {array} formats - Formats to export (json, csv, markdown)
 * @returns {array} Export results
 */
function exportAll(query, results, formats = ['json', 'csv', 'markdown']) {
  const exports = [];

  if (formats.includes('json')) {
    try {
      exports.push(toJSON(query, results));
    } catch (error) {
      exports.push({ success: false, format: 'json', error: error.message });
    }
  }

  if (formats.includes('csv')) {
    try {
      exports.push(toCSV(query, results));
    } catch (error) {
      exports.push({ success: false, format: 'csv', error: error.message });
    }
  }

  if (formats.includes('markdown')) {
    try {
      exports.push(toMarkdown(query, results));
    } catch (error) {
      exports.push({ success: false, format: 'markdown', error: error.message });
    }
  }

  return exports;
}

/**
 * List all exported files
 */
function list() {
  try {
    initExport();
    const files = fs.readdirSync(EXPORT_DIR);
    const exports = files
      .map(file => {
        const stat = fs.statSync(path.join(EXPORT_DIR, file));
        return {
          file,
          size: stat.size,
          created: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return {
      count: exports.length,
      exportDir: EXPORT_DIR,
      files: exports,
    };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  toJSON,
  toCSV,
  toMarkdown,
  exportAll,
  list,
};
