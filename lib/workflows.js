/**
 * Workflows - High-level batch operations for recon agents
 * Chain together multiple API calls into coherent reconnaissance workflows
 */

/**
 * Complete reconnaissance workflow: Search → Host Lookup → DNS → Export
 * @param {ShodanClient} client - Initialized Shodan client
 * @param {string} query - Initial search query
 * @param {object} options - Workflow options
 *   - maxHosts: number of hosts to process (default: 10, max 100)
 *   - exportFormats: array of formats to export (default: ['json', 'markdown'])
 *   - enrichDns: boolean to perform DNS lookups (default: true)
 *   - threatThreshold: only process hosts with threat score >= this (default: 0)
 * @returns {Promise<object>} Complete workflow result with all data
 */
async function fullReconWorkflow(client, query, options = {}) {
  const {
    maxHosts = 10,
    exportFormats = ['json', 'markdown'],
    enrichDns = true,
    threatThreshold = 0,
  } = options;

  const startTime = Date.now();
  const results = {
    query,
    timestamp: new Date().toISOString(),
    workflow: 'fullRecon',
    stages: {},
    summary: {},
    errors: [],
  };

  try {
    // Stage 1: Search
    console.log(`🔍 Stage 1: Searching for "${query}"...`);
    const searchResult = await client.search(query, { minify: true });

    if (!searchResult.success) {
      results.errors.push(`Search failed: ${searchResult.error}`);
      return results;
    }

    results.stages.search = {
      query,
      totalMatches: searchResult.data.total,
      resultsReturned: searchResult.data.results.length,
      creditsUsed: searchResult.metadata.creditsUsed,
      cached: searchResult.metadata.cached,
    };

    // Limit hosts to process
    const hostsToProcess = searchResult.data.results.slice(0, maxHosts);
    console.log(`  ✓ Found ${searchResult.data.total} total matches (processing ${hostsToProcess.length})`);

    // Stage 2: Host Lookups & Filtering
    console.log(`🔎 Stage 2: Detailed host lookups (${hostsToProcess.length} hosts)...`);
    const hostDetails = [];
    let creditsUsed = 0;

    for (const host of hostsToProcess) {
      try {
        const details = await client.host(host.ip);
        if (details.success) {
          // Score the host before including
          const threatScore = calculateThreatScore(details.data);
          if (threatScore >= threatThreshold) {
            hostDetails.push({
              ...details.data,
              _threatScore: threatScore,
              _searchData: host,
            });
            creditsUsed += details.metadata.creditsUsed;
          }
        }
      } catch (err) {
        results.errors.push(`Failed to lookup ${host.ip}: ${err.message}`);
      }
    }

    results.stages.hostLookup = {
      processed: hostsToProcess.length,
      successful: hostDetails.length,
      creditsUsed,
      filtered: hostsToProcess.length - hostDetails.length,
    };

    console.log(`  ✓ Retrieved ${hostDetails.length} host details (${hostDetails.length - (hostsToProcess.length - hostDetails.length)} after filtering)`);

    // Stage 3: DNS Enrichment (optional)
    let dnsData = {};
    if (enrichDns && hostDetails.length > 0) {
      console.log(`🌐 Stage 3: DNS enrichment...`);
      dnsData = await enrichWithDns(client, hostDetails);
      results.stages.dnsEnrichment = dnsData.summary;
    }

    // Stage 4: Export
    console.log(`💾 Stage 4: Exporting results...`);
    const exportResults = [];
    if (exportFormats.length > 0) {
      for (const format of exportFormats) {
        try {
          const exported = client.export(query, hostDetails, [format]);
          exportResults.push(...exported);
        } catch (err) {
          results.errors.push(`Export to ${format} failed: ${err.message}`);
        }
      }
    }

    results.stages.export = {
      formats: exportFormats,
      files: exportResults.map(e => ({ format: e.format, file: e.file })),
    };

    console.log(`  ✓ Exported to ${exportResults.length} files`);

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    results.summary = {
      totalHosts: searchResult.data.total,
      processed: hostDetails.length,
      exported: exportResults.length,
      creditsUsed: results.stages.search.creditsUsed + (results.stages.hostLookup?.creditsUsed || 0),
      dnsLookupsPerformed: dnsData.summary?.successful || 0,
      executionTime: `${totalTime}s`,
    };

    console.log(`\n✅ Workflow complete in ${totalTime}s`);
    return { success: true, data: results, metadata: { cached: false } };
  } catch (error) {
    results.errors.push(`Workflow failed: ${error.message}`);
    return { success: false, error: error.message, data: results };
  }
}

/**
 * Search and immediately export in specified formats
 * @param {ShodanClient} client
 * @param {string} query
 * @param {array} formats - Export formats: json, csv, markdown
 * @returns {Promise<object>}
 */
async function searchAndExport(client, query, formats = ['json', 'csv', 'markdown']) {
  try {
    console.log(`🔍 Searching: "${query}"`);
    const searchResult = await client.search(query, { minify: true });

    if (!searchResult.success) {
      return searchResult;
    }

    console.log(`💾 Exporting to ${formats.length} formats...`);
    const exported = client.export(query, searchResult.data.results, formats);

    return {
      success: true,
      data: {
        query,
        totalMatches: searchResult.data.total,
        resultsExported: searchResult.data.results.length,
        exports: exported,
      },
      metadata: {
        creditsUsed: searchResult.metadata.creditsUsed,
        cached: searchResult.metadata.cached,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Batch reverse DNS lookup for multiple IPs
 * @param {ShodanClient} client
 * @param {array} ips - Array of IP addresses
 * @returns {Promise<object>}
 */
async function reverseDnsBatch(client, ips) {
  if (!ips || ips.length === 0) {
    return { success: false, error: 'No IPs provided' };
  }

  try {
    console.log(`🌐 Reverse DNS lookup for ${ips.length} IPs...`);
    const result = await client.dns.reverse(ips);

    if (!result.success) {
      return result;
    }

    // Reformat for agent consumption
    return {
      success: true,
      data: {
        input: ips,
        count: ips.length,
        mappings: result.data,
      },
      metadata: result.metadata,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Batch forward DNS resolution for multiple hostnames
 * @param {ShodanClient} client
 * @param {array} hostnames - Array of domain names
 * @returns {Promise<object>}
 */
async function dnsResolveBatch(client, hostnames) {
  if (!hostnames || hostnames.length === 0) {
    return { success: false, error: 'No hostnames provided' };
  }

  try {
    console.log(`🌐 DNS resolution for ${hostnames.length} hostnames...`);
    const result = await client.dns.resolve(hostnames);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        input: hostnames,
        count: hostnames.length,
        mappings: result.data,
      },
      metadata: result.metadata,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Enrich host details with DNS information
 * @param {ShodanClient} client
 * @param {array} hostDetails - Array of host objects with 'ip' field
 * @returns {Promise<object>}
 */
async function enrichWithDns(client, hostDetails) {
  const ips = hostDetails.map(h => h.ip);
  const results = {
    summary: { total: ips.length, successful: 0, failed: 0 },
    data: {},
  };

  try {
    const dnsResult = await client.dns.reverse(ips);
    if (dnsResult.success) {
      results.data = dnsResult.data;
      results.summary.successful = Object.keys(dnsResult.data).length;
      results.summary.failed = ips.length - results.summary.successful;
    }
  } catch (error) {
    results.summary.failed = ips.length;
  }

  return results;
}

/**
 * Helper: Calculate threat score for a host
 * Considers: open ports, services, CVEs, exposed data, geolocation
 * @param {object} hostData - Shodan host details
 * @returns {number} 0-100 threat score
 */
function calculateThreatScore(hostData) {
  let score = 0;

  // Open ports (5 pts per port, max 30)
  if (hostData.ports && Array.isArray(hostData.ports)) {
    score += Math.min(hostData.ports.length * 5, 30);
  }

  // Known services (10 pts per critical service)
  const criticalServices = ['ssh', 'rdp', 'smb', 'telnet', 'ftp', 'http', 'https'];
  if (hostData.data && Array.isArray(hostData.data)) {
    const detectedServices = hostData.data
      .map(d => (d.product || '').toLowerCase())
      .filter(p => p.length > 0);
    const criticalCount = detectedServices.filter(s =>
      criticalServices.some(cs => s.includes(cs))
    ).length;
    score += Math.min(criticalCount * 10, 25);
  }

  // Vulnz (if available)
  if (hostData.vulns && Array.isArray(hostData.vulns) && hostData.vulns.length > 0) {
    score += Math.min(hostData.vulns.length * 8, 30);
  }

  // Data (if available)
  if (hostData.data && Array.isArray(hostData.data)) {
    score += Math.min(hostData.data.length * 2, 15);
  }

  return Math.min(score, 100);
}

module.exports = {
  fullReconWorkflow,
  searchAndExport,
  reverseDnsBatch,
  dnsResolveBatch,
  enrichWithDns,
  calculateThreatScore,
};
