/**
 * Shodan Recon Skill - Main export
 */

const ShodanClient = require('./shodan-client');

module.exports = {
  ShodanClient,
  createClient: (apiKey) => new ShodanClient(apiKey),
};
