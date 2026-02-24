/**
 * Shodan Search API methods
 */

const axios = require('axios');

const BASE_URL = 'https://api.shodan.io';

/**
 * Search for hosts matching query
 * @param {string} apiKey - Shodan API key
 * @param {string} query - Search query (e.g., 'product:nginx country:US')
 * @param {object} options - Optional parameters
 *   - facets: string - Comma-separated facets (country,org,port,product,version,os,asn)
 *   - page: number - Results page (default: 1)
 *   - minify: boolean - Minify results (default: true)
 * @returns {Promise<object>} Search results
 */
async function search(apiKey, query, options = {}) {
  try {
    const params = {
      key: apiKey,
      query,
      ...options,
    };

    const response = await axios.get(`${BASE_URL}/shodan/host/search`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Search failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get full information for a single IP
 * @param {string} apiKey - Shodan API key
 * @param {string} ip - IP address
 * @param {object} options - Optional parameters
 *   - minify: boolean - Minify results (default: true)
 *   - history: boolean - Include host history (default: false)
 * @returns {Promise<object>} Host details
 */
async function host(apiKey, ip, options = {}) {
  try {
    const params = {
      key: apiKey,
      ...options,
    };

    const response = await axios.get(`${BASE_URL}/shodan/host/${ip}`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`IP ${ip} not found in Shodan database`);
    }
    throw new Error(
      `Host lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Count results for a query without retrieving them
 * @param {string} apiKey - Shodan API key
 * @param {string} query - Search query
 * @returns {Promise<object>} Count result
 */
async function count(apiKey, query) {
  try {
    const params = {
      key: apiKey,
      query,
    };

    const response = await axios.get(`${BASE_URL}/shodan/host/count`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Count failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get search filters available in Shodan
 * @param {string} apiKey - Shodan API key
 * @returns {Promise<object>} Available filters
 */
async function filters(apiKey) {
  try {
    const params = { key: apiKey };

    const response = await axios.get(`${BASE_URL}/shodan/host/search/filters`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Filters lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get list of ports Shodan crawls
 * @param {string} apiKey - Shodan API key
 * @returns {Promise<array>} List of port numbers
 */
async function ports(apiKey) {
  try {
    const params = { key: apiKey };

    const response = await axios.get(`${BASE_URL}/shodan/ports`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Ports lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get list of protocols Shodan crawls
 * @param {string} apiKey - Shodan API key
 * @returns {Promise<object>} List of protocols
 */
async function protocols(apiKey) {
  try {
    const params = { key: apiKey };

    const response = await axios.get(`${BASE_URL}/shodan/protocols`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Protocols lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Request Shodan to scan a network
 * @param {string} apiKey - Shodan API key
 * @param {string|array} networks - CIDR notation network(s) to scan
 * @param {object} options - Optional parameters
 *   - comment: string - Description of scan
 * @returns {Promise<object>} Scan submission result
 */
async function scan(apiKey, networks, options = {}) {
  try {
    // Convert array to comma-separated if needed
    const networkString = Array.isArray(networks) ? networks.join(',') : networks;

    const params = {
      key: apiKey,
      network: networkString,
      ...options,
    };

    const response = await axios.post(`${BASE_URL}/shodan/scan`, null, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Scan request failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get scan results
 * @param {string} apiKey - Shodan API key
 * @param {string} scanId - Scan ID from submission
 * @returns {Promise<object>} Scan results
 */
async function scanStatus(apiKey, scanId) {
  try {
    const params = { key: apiKey };

    const response = await axios.get(`${BASE_URL}/shodan/scan/${scanId}`, {
      params,
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      `Scan status lookup failed: ${error.response?.data?.error || error.message}`
    );
  }
}

module.exports = {
  search,
  host,
  count,
  filters,
  ports,
  protocols,
  scan,
  scanStatus,
};
