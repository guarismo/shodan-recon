/**
 * Analysis - Result filtering, threat scoring, and infrastructure mapping
 * Tools for the recon agent to process and understand results
 */

/**
 * Filter results by multiple criteria
 * @param {array} results - Array of host objects
 * @param {object} filters - Filter criteria
 *   - minPorts, maxPorts: port count range
 *   - services: array of services to match (e.g., ['ssh', 'http'])
 *   - countries: array of country codes
 *   - organizations: array of org names (substring match)
 *   - ports: array of specific ports to match
 *   - minThreatScore, maxThreatScore: threat score range
 *   - hasVulns: boolean, only include hosts with known vulns
 *   - hasData: boolean, only include hosts with exposed data
 *   - productMatch: regex or string to match product names
 * @returns {array} Filtered results
 */
function filterResults(results, filters = {}) {
  if (!Array.isArray(results)) return [];

  return results.filter(host => {
    // Port count range
    if (filters.minPorts && (!host.ports || host.ports.length < filters.minPorts)) {
      return false;
    }
    if (filters.maxPorts && host.ports && host.ports.length > filters.maxPorts) {
      return false;
    }

    // Services
    if (filters.services && Array.isArray(filters.services)) {
      const hostServices = extractServices(host);
      const hasMatch = filters.services.some(service =>
        hostServices.some(hs => hs.toLowerCase().includes(service.toLowerCase()))
      );
      if (!hasMatch) return false;
    }

    // Countries
    if (filters.countries && Array.isArray(filters.countries)) {
      if (!filters.countries.includes(host.country_code?.toUpperCase())) {
        return false;
      }
    }

    // Organizations
    if (filters.organizations && Array.isArray(filters.organizations)) {
      const hasOrgMatch = filters.organizations.some(org =>
        host.org?.toLowerCase().includes(org.toLowerCase())
      );
      if (!hasOrgMatch) return false;
    }

    // Specific ports
    if (filters.ports && Array.isArray(filters.ports)) {
      const hasPort = filters.ports.some(port => host.ports?.includes(port));
      if (!hasPort) return false;
    }

    // Threat score range
    if (filters.minThreatScore && host._threatScore < filters.minThreatScore) {
      return false;
    }
    if (filters.maxThreatScore && host._threatScore > filters.maxThreatScore) {
      return false;
    }

    // Has vulnerabilities
    if (filters.hasVulns === true && (!host.vulns || host.vulns.length === 0)) {
      return false;
    }
    if (filters.hasVulns === false && host.vulns && host.vulns.length > 0) {
      return false;
    }

    // Has exposed data
    if (filters.hasData === true && (!host.data || host.data.length === 0)) {
      return false;
    }
    if (filters.hasData === false && host.data && host.data.length > 0) {
      return false;
    }

    // Product match
    if (filters.productMatch) {
      const products = extractServices(host);
      const pattern = new RegExp(filters.productMatch, 'i');
      const hasMatch = products.some(p => pattern.test(p));
      if (!hasMatch) return false;
    }

    return true;
  });
}

/**
 * Analyze results for patterns and insights
 * @param {array} results - Array of host objects
 * @returns {object} Analysis report
 */
function analyzeResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { success: false, error: 'No results to analyze' };
  }

  const report = {
    totalHosts: results.length,
    threatDistribution: {},
    serviceDistribution: {},
    countryDistribution: {},
    orgDistribution: {},
    commonPorts: {},
    vulnerabilityStats: {
      hostsWithVulns: 0,
      totalVulns: 0,
      criticalVulns: 0,
    },
    exposedDataStats: {
      hostsWithData: 0,
      totalDataPoints: 0,
    },
    insights: [],
  };

  // Threat distribution
  results.forEach(host => {
    const scoreRange = categorizeScore(host._threatScore || 0);
    report.threatDistribution[scoreRange] = (report.threatDistribution[scoreRange] || 0) + 1;
  });

  // Services
  const allServices = {};
  results.forEach(host => {
    const services = extractServices(host);
    services.forEach(service => {
      allServices[service] = (allServices[service] || 0) + 1;
    });
  });
  report.serviceDistribution = Object.fromEntries(
    Object.entries(allServices)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20) // Top 20
  );

  // Countries
  results.forEach(host => {
    const country = host.country_code || 'UNKNOWN';
    report.countryDistribution[country] = (report.countryDistribution[country] || 0) + 1;
  });

  // Organizations
  results.forEach(host => {
    const org = host.org || 'UNKNOWN';
    report.orgDistribution[org] = (report.orgDistribution[org] || 0) + 1;
  });

  // Common ports
  results.forEach(host => {
    if (host.ports) {
      host.ports.forEach(port => {
        report.commonPorts[port] = (report.commonPorts[port] || 0) + 1;
      });
    }
  });
  report.commonPorts = Object.fromEntries(
    Object.entries(report.commonPorts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20) // Top 20
  );

  // Vulnerability stats
  results.forEach(host => {
    if (host.vulns && host.vulns.length > 0) {
      report.vulnerabilityStats.hostsWithVulns++;
      report.vulnerabilityStats.totalVulns += host.vulns.length;
      // Rough estimate for critical (CVE base score > 7)
      const critical = host.vulns.filter(v => v.score > 7).length;
      report.vulnerabilityStats.criticalVulns += critical;
    }
  });

  // Exposed data stats
  results.forEach(host => {
    if (host.data && host.data.length > 0) {
      report.exposedDataStats.hostsWithData++;
      report.exposedDataStats.totalDataPoints += host.data.length;
    }
  });

  // Generate insights
  report.insights = generateInsights(report, results);

  return {
    success: true,
    data: report,
  };
}

/**
 * Score and rank hosts by threat level
 * @param {array} results - Array of host objects
 * @param {number} limit - Number of top hosts to return
 * @returns {array} Top hosts sorted by threat score (highest first)
 */
function rankByThreat(results, limit = 10) {
  if (!Array.isArray(results)) return [];

  return results
    .sort((a, b) => (b._threatScore || 0) - (a._threatScore || 0))
    .slice(0, limit)
    .map((host, idx) => ({
      rank: idx + 1,
      ip: host.ip_str || host.ip,
      threatScore: host._threatScore || 0,
      riskLevel: categorizeScore(host._threatScore || 0),
      ports: (host.ports || []).length,
      services: extractServices(host).slice(0, 5),
      country: host.country_code || 'UNKNOWN',
      org: host.org || 'UNKNOWN',
      vulns: host.vulns ? host.vulns.length : 0,
    }));
}

/**
 * Build infrastructure map showing relationships between hosts
 * @param {array} results - Array of host objects
 * @returns {object} Network graph structure
 */
function mapInfrastructure(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { success: false, error: 'No results to map' };
  }

  const map = {
    nodes: [],
    edges: [],
    clusters: {},
    summary: {
      totalNodes: 0,
      totalClusters: 0,
      totalConnections: 0,
    },
  };

  // Create nodes
  results.forEach(host => {
    map.nodes.push({
      id: host.ip,
      label: host.ip,
      org: host.org,
      country: host.country_code,
      threatScore: host._threatScore || 0,
      services: extractServices(host),
      ports: host.ports || [],
    });
  });

  // Cluster by organization
  const orgClusters = {};
  results.forEach(host => {
    const org = host.org || 'UNKNOWN';
    if (!orgClusters[org]) {
      orgClusters[org] = [];
    }
    orgClusters[org].push(host.ip);
  });

  map.clusters = orgClusters;
  map.summary.totalNodes = map.nodes.length;
  map.summary.totalClusters = Object.keys(orgClusters).length;

  // Create edges (connections between same org/country for now)
  const countryMap = {};
  results.forEach(host => {
    const country = host.country_code || 'UNKNOWN';
    if (!countryMap[country]) {
      countryMap[country] = [];
    }
    countryMap[country].push(host.ip);
  });

  // Connect hosts in same organization (first connection only for clarity)
  Object.values(orgClusters).forEach(ips => {
    for (let i = 0; i < ips.length - 1; i++) {
      map.edges.push({
        source: ips[i],
        target: ips[i + 1],
        type: 'organization',
      });
      map.summary.totalConnections++;
    }
  });

  return {
    success: true,
    data: map,
  };
}

/**
 * Find high-risk patterns (anomalies, concentrations)
 * @param {array} results
 * @returns {array} List of patterns/anomalies
 */
function findAnomalies(results) {
  const patterns = [];

  if (!Array.isArray(results) || results.length === 0) {
    return patterns;
  }

  // Anomaly 1: Hosts with unusually high port counts
  const avgPorts = results.reduce((sum, h) => sum + (h.ports?.length || 0), 0) / results.length;
  const highPortHosts = results.filter(h => (h.ports?.length || 0) > avgPorts * 2);
  if (highPortHosts.length > 0) {
    patterns.push({
      type: 'UNUSUALLY_OPEN_PORTS',
      severity: 'MEDIUM',
      count: highPortHosts.length,
      description: `${highPortHosts.length} host(s) with >2x average open ports`,
      samples: highPortHosts.slice(0, 3).map(h => ({ ip: h.ip, ports: h.ports?.length || 0 })),
    });
  }

  // Anomaly 2: Hosts with known vulnerabilities
  const vulnHosts = results.filter(h => h.vulns && h.vulns.length > 0);
  if (vulnHosts.length > 0) {
    patterns.push({
      type: 'KNOWN_VULNERABILITIES',
      severity: 'HIGH',
      count: vulnHosts.length,
      description: `${vulnHosts.length} host(s) with known vulnerabilities`,
      samples: vulnHosts.slice(0, 3).map(h => ({
        ip: h.ip,
        vulns: h.vulns?.length || 0,
      })),
    });
  }

  // Anomaly 3: Concentration of threat scores
  const criticalHosts = results.filter(h => (h._threatScore || 0) >= 70);
  if (criticalHosts.length > 0 && criticalHosts.length <= results.length * 0.2) {
    patterns.push({
      type: 'CRITICAL_THREAT_CONCENTRATION',
      severity: 'CRITICAL',
      count: criticalHosts.length,
      description: `${criticalHosts.length} host(s) with critical threat scores (≥70)`,
      samples: criticalHosts.slice(0, 5).map(h => ({ ip: h.ip, score: h._threatScore })),
    });
  }

  // Anomaly 4: Same service on unusual ports
  const portServiceMap = {};
  results.forEach(host => {
    const services = extractServices(host);
    (host.ports || []).forEach(port => {
      const key = `${services.join(',')}:${port}`;
      portServiceMap[key] = (portServiceMap[key] || 0) + 1;
    });
  });

  const unusualCombos = Object.entries(portServiceMap)
    .filter(([, count]) => count === 1 && count <= results.length * 0.1)
    .slice(0, 5);

  if (unusualCombos.length > 0) {
    patterns.push({
      type: 'UNUSUAL_SERVICE_PORT_COMBINATIONS',
      severity: 'LOW',
      count: unusualCombos.length,
      description: 'Rare service-port combinations detected',
      samples: unusualCombos.map(([combo]) => combo),
    });
  }

  return patterns;
}

// ====== HELPERS ======

function extractServices(host) {
  const services = new Set();

  if (host.data && Array.isArray(host.data)) {
    host.data.forEach(d => {
      if (d.product) services.add(d.product);
    });
  }

  if (host.http && host.http.title) services.add('HTTP');
  if (host.ssl) services.add('SSL/TLS');
  if (host.ports) {
    // Guess common services by port
    const portGuesses = {
      22: 'SSH',
      23: 'Telnet',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      3389: 'RDP',
      445: 'SMB',
      139: 'NetBIOS',
    };
    host.ports.forEach(port => {
      if (portGuesses[port]) services.add(portGuesses[port]);
    });
  }

  return Array.from(services);
}

function categorizeScore(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'MINIMAL';
}

function generateInsights(report, results) {
  const insights = [];

  // Most common country
  const topCountry = Object.entries(report.countryDistribution)
    .sort(([, a], [, b]) => b - a)[0];
  if (topCountry) {
    insights.push(
      `Most hosts located in ${topCountry[0]} (${topCountry[1]} hosts, ${((topCountry[1] / results.length) * 100).toFixed(1)}%)`
    );
  }

  // Most common service
  const topService = Object.entries(report.serviceDistribution)
    .sort(([, a], [, b]) => b - a)[0];
  if (topService) {
    insights.push(
      `Most common service: ${topService[0]} (${topService[1]} hosts, ${((topService[1] / results.length) * 100).toFixed(1)}%)`
    );
  }

  // Vulnerability prevalence
  const vulnPercent = ((report.vulnerabilityStats.hostsWithVulns / results.length) * 100).toFixed(1);
  if (report.vulnerabilityStats.hostsWithVulns > 0) {
    insights.push(
      `${vulnPercent}% of hosts (${report.vulnerabilityStats.hostsWithVulns}/${results.length}) have known vulnerabilities`
    );
  }

  // Threat distribution
  const criticalCount = report.threatDistribution['CRITICAL'] || 0;
  if (criticalCount > 0) {
    insights.push(
      `⚠️ ${criticalCount} host(s) with CRITICAL threat level`
    );
  }

  return insights;
}

module.exports = {
  filterResults,
  analyzeResults,
  rankByThreat,
  mapInfrastructure,
  findAnomalies,
};
