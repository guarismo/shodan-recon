/**
 * Shodan DNS API methods
 */

const axios = require('axios');

const BASE_URL = 'https://api.shodan.io';

/**
 * Get all subdomains and DNS records for a domain
 * Uses 1 query credit per lookup
 * @param {string} apiKey - Shodan API key
 * @param {string} domain - Domain name (e.g., "google.com")
 * @param {object} options - Optional parameters
 *   - history: boolean - Include historical DNS data (default: false)
 *   - type: string - DNS type filter (A, AAAA, CNAME, NS, SOA, MX, TXT)
 *   - page: number - Page number (default: 1)
 * @returns {Promise<object>} DNS domain lookup results
 */
async function domain(apiKey, domain, options = {}) {
  try {
    const params = {
      key: apiKey,
      ...options,
    };

    const response = await axios.get(`${BASE_URL}/dns/domain/${domain}`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`No DNS records found for domain: ${domain}`);
    }
    throw new Error(
      `DNS domain lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Resolve hostnames to IPs (simple forward lookup)
 * @param {string} apiKey - Shodan API key
 * @param {string|array} hostnames - Single hostname or array of hostnames
 * @returns {Promise<object>} Resolved hostnames → IPs
 */
async function resolve(apiKey, hostnames) {
  try {
    // Convert array to comma-separated string if needed
    const hostnameString = Array.isArray(hostnames) ? hostnames.join(',') : hostnames;
    
    const params = { 
      key: apiKey,
      hostnames: hostnameString,
    };

    const response = await axios.get(`${BASE_URL}/dns/resolve`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`No DNS records found for hostnames: ${hostnames}`);
    }
    throw new Error(
      `DNS resolve failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get domains for one or more IPs (reverse lookup)
 * @param {string} apiKey - Shodan API key
 * @param {string|array} ips - Single IP or array of IPs
 * @returns {Promise<object>} DNS reverse lookup results
 */
async function reverse(apiKey, ips) {
  try {
    // Convert array to comma-separated string if needed
    const ipString = Array.isArray(ips) ? ips.join(',') : ips;
    
    const params = { 
      key: apiKey,
      ips: ipString,
    };

    const response = await axios.get(`${BASE_URL}/dns/reverse`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`No DNS records found for IPs: ${ips}`);
    }
    throw new Error(
      `DNS reverse lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

module.exports = {
  domain,      // Get subdomains & DNS records for a domain (1 credit)
  resolve,     // Simple hostname → IP resolution
  reverse,     // IP → hostname reverse lookup
};
