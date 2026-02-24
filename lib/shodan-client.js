/**
 * Shodan API Client
 * Main wrapper for all Shodan API methods
 */

const axios = require('axios');
const { getApiKey, formatResponse, formatError } = require('./utils');
const searchMethods = require('./search');
const dnsMethods = require('./dns');
const cache = require('./cache');
const exporter = require('./exporter');
const workflows = require('./workflows');
const analysis = require('./analysis');
const DomainEnumeration = require('./domain-enumeration');

const BASE_URL = 'https://api.shodan.io';

class ShodanClient {
  constructor(apiKey = null, cacheEnabled = true) {
    this.apiKey = apiKey || getApiKey();
    this.creditsUsed = 0;
    this.lastCredits = null;
    this.cacheEnabled = cacheEnabled;
    this.cache = cache;
    this.exporter = exporter;

    // Expose DNS methods
    this.dns = {
      // Get all subdomains and DNS records for a domain (1 credit)
      domain: (domainName, options) => this._wrapCall('dns.domain', domainName, () => 
        dnsMethods.domain(this.apiKey, domainName, options)
      ),
      // Simple hostname → IP resolution
      resolve: (hostnames) => this._wrapCall('dns.resolve', hostnames, () => 
        dnsMethods.resolve(this.apiKey, hostnames)
      ),
      // IP → hostname reverse lookup
      reverse: (ips) => this._wrapCall('dns.reverse', ips, () => 
        dnsMethods.reverse(this.apiKey, ips)
      ),
    };
  }

  /**
   * Wrapper to add error handling, caching, and metadata
   */
  async _wrapCall(method, query, fn, cacheParams = null) {
    try {
      // Check cache first
      if (this.cacheEnabled && cacheParams) {
        const cached = cache.get(method, cacheParams);
        if (cached) {
          const response = formatResponse(method, query, cached);
          response.metadata.cached = true;
          response.metadata.creditsUsed = 0; // Cached results don't use credits
          return response;
        }
      }

      // Make API call
      const result = await fn();

      // Cache the result
      if (this.cacheEnabled && cacheParams) {
        cache.set(method, cacheParams, result);
      }

      return formatResponse(method, query, result);
    } catch (error) {
      return formatError(method, query, error);
    }
  }

  /**
   * Search for hosts matching a query
   * @param {string} query - Shodan query string
   * @param {object} options - Search options (facets, page, minify)
   * @param {boolean} useCache - Use cached results if available (default: true)
   * @returns {Promise<object>} Formatted response
   */
  async search(query, options = {}, useCache = true) {
    const cacheParams = useCache ? { query, options } : null;
    return this._wrapCall('search', query, () =>
      searchMethods.search(this.apiKey, query, options),
      cacheParams
    );
  }

  /**
   * Get full details for a single host
   * @param {string} ip - IP address
   * @param {object} options - Lookup options
   * @param {boolean} useCache - Use cached results if available (default: true)
   * @returns {Promise<object>} Formatted response
   */
  async host(ip, options = {}, useCache = true) {
    const cacheParams = useCache ? { ip, options } : null;
    return this._wrapCall('host', ip, () =>
      searchMethods.host(this.apiKey, ip, options),
      cacheParams
    );
  }

  /**
   * Count results for a query (uses 0 credits)
   * @param {string} query - Shodan query string
   * @returns {Promise<object>} Formatted response with count
   */
  async count(query) {
    return this._wrapCall('count', query, () =>
      searchMethods.count(this.apiKey, query)
    );
  }

  /**
   * Get available search filters
   * @returns {Promise<object>} Formatted response with filters
   */
  async filters() {
    return this._wrapCall('filters', 'all', () =>
      searchMethods.filters(this.apiKey)
    );
  }

  /**
   * Get available ports that Shodan crawls
   * @returns {Promise<object>} Formatted response
   */
  async ports() {
    return this._wrapCall('ports', 'all', () =>
      searchMethods.ports(this.apiKey)
    );
  }

  /**
   * Get available protocols that Shodan crawls
   * @returns {Promise<object>} Formatted response
   */
  async protocols() {
    return this._wrapCall('protocols', 'all', () =>
      searchMethods.protocols(this.apiKey)
    );
  }

  /**
   * Get account information and remaining credits
   * @returns {Promise<object>} Formatted response with account info
   */
  async account() {
    try {
      const params = { key: this.apiKey };
      const response = await axios.get(`${BASE_URL}/account/profile`, {
        params,
        timeout: 10000,
      });

      this.lastCredits = response.data.credits;
      return formatResponse('account', 'profile', response.data);
    } catch (error) {
      return formatError('account', 'profile', error);
    }
  }

  /**
   * Search exploits database
   * @param {string} query - Exploit query
   * @param {object} options - Search options (facets, page)
   * @returns {Promise<object>} Formatted response
   */
  async exploits(query, options = {}) {
    return this._wrapCall('exploits', query, () =>
      this._searchExploits(query, options)
    );
  }

  /**
   * Count exploits for a query
   * @param {string} query - Exploit query
   * @param {object} options - Count options (facets)
   * @returns {Promise<object>} Formatted response
   */
  async exploitCount(query, options = {}) {
    return this._wrapCall('exploit.count', query, () =>
      this._countExploits(query, options)
    );
  }

  /**
   * Internal: Search exploits
   */
  async _searchExploits(query, options = {}) {
    try {
      const params = {
        key: this.apiKey,
        q: query,
        ...options,
      };

      const response = await axios.get(`${BASE_URL}/api/exploits/search`, {
        params,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Exploit search failed: ${error.response?.data?.error || error.message}`
      );
    }
  }

  /**
   * Internal: Count exploits
   */
  async _countExploits(query, options = {}) {
    try {
      const params = {
        key: this.apiKey,
        q: query,
        ...options,
      };

      const response = await axios.get(`${BASE_URL}/api/exploits/count`, {
        params,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Exploit count failed: ${error.response?.data?.error || error.message}`
      );
    }
  }

  /**
   * Get your external IP as seen by Shodan
   * @returns {Promise<object>} Formatted response
   */
  async myIp() {
    return this._wrapCall('myip', 'all', () =>
      this._getMyIp()
    );
  }

  /**
   * Internal: Get my IP
   */
  async _getMyIp() {
    try {
      const params = { key: this.apiKey };
      const response = await axios.get(`${BASE_URL}/tools/myip`, {
        params,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `MyIP lookup failed: ${error.response?.data?.error || error.message}`
      );
    }
  }

  /**
   * Request Shodan to scan a network
   * @param {string|array} networks - CIDR notation network(s)
   * @param {object} options - Optional parameters (comment, etc.)
   * @returns {Promise<object>} Formatted response with scan ID
   */
  async scan(networks, options = {}) {
    return this._wrapCall('scan', Array.isArray(networks) ? networks.join(',') : networks, () =>
      searchMethods.scan(this.apiKey, networks, options)
    );
  }

  /**
   * Get status/results of a submitted scan
   * @param {string} scanId - Scan ID from submission
   * @returns {Promise<object>} Formatted response with scan results
   */
  async scanStatus(scanId) {
    return this._wrapCall('scanStatus', scanId, () =>
      searchMethods.scanStatus(this.apiKey, scanId)
    );
  }

  /**
   * Validate API key and test connection
   * @returns {Promise<boolean>} True if key is valid
   */
  async validate() {
    try {
      const result = await this.account();
      return result.success;
    } catch (error) {
      throw new Error(`API key validation failed: ${error.message}`);
    }
  }

  /**
   * Get remaining API credits
   * @returns {Promise<number|null>} Number of credits remaining
   */
  async getCredits() {
    try {
      const result = await this.account();
      return result.success ? result.results.credits : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Export search results
   * @param {string} query - Original query
   * @param {object} results - Search results
   * @param {array} formats - Formats to export (json, csv, markdown)
   * @returns {array} Export results
   */
  export(query, results, formats = ['json', 'csv', 'markdown']) {
    return exporter.exportAll(query, results, formats);
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return cache.stats();
  }

  /**
   * List all cached entries
   * @returns {array} Cached entries
   */
  listCache() {
    return cache.list();
  }

  /**
   * Clear cache
   * @param {string} method - Optional specific method to clear
   * @param {object} params - Optional specific params to clear
   * @returns {object} Clear result
   */
  clearCache(method = null, params = null) {
    if (method && params) {
      return cache.clearEntry(method, params);
    }
    return cache.clear();
  }

  /**
   * List exported files
   * @returns {object} Export listing
   */
  listExports() {
    return exporter.list();
  }

  /**
   * Enable/disable caching
   * @param {boolean} enabled - Cache enabled state
   */
  setCaching(enabled) {
    this.cacheEnabled = enabled;
  }

  // ====== WORKFLOWS (Agent Tools) ======

  /**
   * Full reconnaissance workflow: Search → Host Lookup → DNS → Export
   * @param {string} query - Initial search query
   * @param {object} options - Workflow options (maxHosts, exportFormats, enrichDns, threatThreshold)
   * @returns {Promise<object>} Complete workflow result
   */
  async fullReconWorkflow(query, options = {}) {
    return workflows.fullReconWorkflow(this, query, options);
  }

  /**
   * Search and export results to multiple formats
   * @param {string} query
   * @param {array} formats - Export formats: json, csv, markdown
   * @returns {Promise<object>}
   */
  async searchAndExport(query, formats = ['json', 'csv', 'markdown']) {
    return workflows.searchAndExport(this, query, formats);
  }

  /**
   * Batch reverse DNS lookup for multiple IPs
   * @param {array} ips - Array of IP addresses
   * @returns {Promise<object>}
   */
  async reverseDnsBatch(ips) {
    return workflows.reverseDnsBatch(this, ips);
  }

  /**
   * Batch forward DNS resolution for multiple hostnames
   * @param {array} hostnames - Array of domain names
   * @returns {Promise<object>}
   */
  async dnsResolveBatch(hostnames) {
    return workflows.dnsResolveBatch(this, hostnames);
  }

  // ====== ANALYSIS (Agent Tools) ======

  /**
   * Filter results by multiple criteria
   * @param {array} results - Array of host objects
   * @param {object} filters - Filter criteria
   * @returns {array} Filtered results
   */
  filterResults(results, filters = {}) {
    return analysis.filterResults(results, filters);
  }

  /**
   * Analyze results for patterns and insights
   * @param {array} results - Array of host objects
   * @returns {object} Analysis report
   */
  analyzeResults(results) {
    return analysis.analyzeResults(results);
  }

  /**
   * Score and rank hosts by threat level
   * @param {array} results - Array of host objects
   * @param {number} limit - Number of top hosts to return
   * @returns {array} Top hosts sorted by threat score
   */
  rankByThreat(results, limit = 10) {
    return analysis.rankByThreat(results, limit);
  }

  /**
   * Build infrastructure map showing relationships between hosts
   * @param {array} results - Array of host objects
   * @returns {object} Network graph structure
   */
  mapInfrastructure(results) {
    return analysis.mapInfrastructure(results);
  }

  /**
   * Find high-risk patterns and anomalies in results
   * @param {array} results - Array of host objects
   * @returns {array} List of patterns/anomalies
   */
  findAnomalies(results) {
    return analysis.findAnomalies(results);
  }

  // ====== DOMAIN ENUMERATION (Stage 0) ======

  /**
   * Create domain enumeration instance
   * @returns {DomainEnumeration} Enumeration instance
   */
  createDomainEnumerator() {
    return new DomainEnumeration();
  }

  /**
   * Enumerate subdomains for a domain
   * @param {string} domain - Target domain
   * @param {object} options - Enumeration options
   * @returns {Promise<object>} Enumeration results
   */
  async enumerateDomain(domain, options = {}) {
    const enumerator = new DomainEnumeration();
    return enumerator.enumerate(domain, options);
  }
}

module.exports = ShodanClient;
