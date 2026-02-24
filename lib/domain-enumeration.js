/**
 * Domain Enumeration Module
 * Subdomain discovery via tools + APIs
 * Feeds results to Shodan for comprehensive reconnaissance
 * 
 * Gracefully degrades - skips unavailable tools
 */

const { execSync, spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DomainEnumeration {
  constructor(options = {}) {
    this.tools = {
      subfinder: { installed: false, cmd: 'subfinder' },
      findomain: { installed: false, cmd: 'findomain' },
      amass: { installed: false, cmd: 'amass' },
      assetfinder: { installed: false, cmd: 'assetfinder' },
    };

    this.apis = {
      crtsh: { enabled: true, name: 'Certificate Transparency' },
      securitytrails: { enabled: !!process.env.SECURITYTRAILS_API_KEY, key: process.env.SECURITYTRAILS_API_KEY },
      github: { enabled: !!process.env.GITHUB_TOKEN, token: process.env.GITHUB_TOKEN },
    };

    this.results = {
      domains: new Set(),
      subdomains: new Set(),
      sources: {},
      stats: {},
      timestamp: new Date().toISOString(),
    };

    this._detectInstalledTools();
  }

  /**
   * Check which tools are installed
   * @private
   */
  _detectInstalledTools() {
    Object.entries(this.tools).forEach(([name, tool]) => {
      try {
        execSync(`which ${tool.cmd} > /dev/null 2>&1`);
        this.tools[name].installed = true;
        console.log(`  ✓ ${name} detected`);
      } catch (err) {
        console.log(`  ○ ${name} not installed (skipping)`);
      }
    });
  }

  /**
   * Main enumeration workflow
   * @param {string} domain - Target domain
   * @param {object} options - Enumeration options
   * @returns {Promise<object>} Enumeration results
   */
  async enumerate(domain, options = {}) {
    const {
      useTools = true,
      useAPIs = true,
      consolidateOnly = false,
      outputFile = null,
      timeout = 60000, // 60s timeout per tool
    } = options;

    console.log(`\n🔍 Domain Enumeration: ${domain}`);
    console.log(`${'─'.repeat(50)}`);

    this.results.target = domain;
    this.results.sources = {};

    // Stage 1: Run tools
    if (useTools) {
      console.log(`\n🛠️  Running subdomain discovery tools...`);
      await this._runTools(domain, timeout);
    }

    // Stage 2: Query APIs
    if (useAPIs) {
      console.log(`\n🌐 Querying APIs...`);
      await this._queryAPIs(domain);
    }

    // Stage 3: Consolidate
    console.log(`\n📊 Consolidating results...`);
    this._consolidateResults();

    // Export if requested
    if (outputFile) {
      this._exportResults(outputFile);
    }

    return this.results;
  }

  /**
   * Run subdomain discovery tools
   * @private
   */
  async _runTools(domain, timeout) {
    // Subfinder
    if (this.tools.subfinder.installed) {
      try {
        console.log(`  🔎 subfinder...`);
        const result = execSync(`subfinder -d ${domain} -all -recursive 2>/dev/null || true`, {
          timeout,
          encoding: 'utf-8',
        });
        const subs = result.split('\n').filter(s => s.trim());
        this.results.sources.subfinder = subs.length;
        subs.forEach(s => this.results.subdomains.add(s.trim()));
        console.log(`     → ${subs.length} subdomains`);
      } catch (err) {
        console.log(`     ⚠️ timeout or error`);
      }
    }

    // Findomain
    if (this.tools.findomain.installed) {
      try {
        console.log(`  🔎 findomain...`);
        const result = execSync(`findomain -t ${domain} 2>/dev/null || true`, {
          timeout,
          encoding: 'utf-8',
        });
        const subs = result.split('\n').filter(s => s.trim() && s.includes(domain));
        this.results.sources.findomain = subs.length;
        subs.forEach(s => this.results.subdomains.add(s.trim()));
        console.log(`     → ${subs.length} subdomains`);
      } catch (err) {
        console.log(`     ⚠️ timeout or error`);
      }
    }

    // Amass
    if (this.tools.amass.installed) {
      try {
        console.log(`  🔎 amass...`);
        const result = execSync(`amass enum -passive -d ${domain} -norecursive -noalts 2>/dev/null || true`, {
          timeout,
          encoding: 'utf-8',
        });
        const subs = result.split('\n')
          .filter(s => s.includes(domain))
          .map(s => s.trim().split(' ')[0]);
        this.results.sources.amass = subs.length;
        subs.forEach(s => this.results.subdomains.add(s));
        console.log(`     → ${subs.length} subdomains`);
      } catch (err) {
        console.log(`     ⚠️ timeout or error`);
      }
    }

    // Assetfinder
    if (this.tools.assetfinder.installed) {
      try {
        console.log(`  🔎 assetfinder...`);
        const result = execSync(`assetfinder --subs-only ${domain} 2>/dev/null || true`, {
          timeout,
          encoding: 'utf-8',
        });
        const subs = result.split('\n').filter(s => s.trim());
        this.results.sources.assetfinder = subs.length;
        subs.forEach(s => this.results.subdomains.add(s.trim()));
        console.log(`     → ${subs.length} subdomains`);
      } catch (err) {
        console.log(`     ⚠️ timeout or error`);
      }
    }
  }

  /**
   * Query online APIs
   * @private
   */
  async _queryAPIs(domain) {
    // Certificate Transparency (crt.sh)
    if (this.apis.crtsh.enabled) {
      try {
        console.log(`  🌐 crt.sh (Certificate Transparency)...`);
        const url = `https://crt.sh/?q=%25.${domain}&output=json`;
        const response = await axios.get(url, { timeout: 10000 });

        if (Array.isArray(response.data)) {
          const subs = response.data
            .map(cert => cert.name_value)
            .join('\n')
            .split('\n')
            .map(s => s.replace(/^\*\./, '').trim())
            .filter(s => s && s.includes(domain));

          this.results.sources.crtsh = subs.length;
          subs.forEach(s => this.results.subdomains.add(s));
          console.log(`     → ${subs.length} subdomains`);
        }
      } catch (err) {
        console.log(`     ⚠️ error: ${err.message}`);
      }
    }

    // SecurityTrails API
    if (this.apis.securitytrails.enabled && this.apis.securitytrails.key) {
      try {
        console.log(`  🌐 SecurityTrails API...`);
        const url = `https://api.securitytrails.com/v1/domain/${domain}/subdomains`;
        const response = await axios.get(url, {
          headers: { 'APIKEY': this.apis.securitytrails.key },
          timeout: 10000,
        });

        if (response.data.subdomains) {
          const subs = response.data.subdomains.map(s => `${s}.${domain}`);
          this.results.sources.securitytrails = subs.length;
          subs.forEach(s => this.results.subdomains.add(s));
          console.log(`     → ${subs.length} subdomains`);
        }
      } catch (err) {
        console.log(`     ⚠️ error or invalid key`);
      }
    }

    // GitHub API (github-subdomain alternative)
    if (this.apis.github.enabled && this.apis.github.token) {
      try {
        console.log(`  🌐 GitHub API...`);
        const query = `${domain} in:file language:json`;
        const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=100`;
        const response = await axios.get(url, {
          headers: { 'Authorization': `token ${this.apis.github.token}` },
          timeout: 10000,
        });

        // Extract subdomains from matched files (rough parsing)
        const subs = new Set();
        if (response.data.items) {
          response.data.items.forEach(item => {
            const matches = item.name.match(/[\w\-]+\.${domain}/g) || [];
            matches.forEach(m => subs.add(m));
          });
        }

        this.results.sources.github = subs.size;
        subs.forEach(s => this.results.subdomains.add(s));
        console.log(`     → ${subs.size} subdomains`);
      } catch (err) {
        console.log(`     ⚠️ error or rate limited`);
      }
    }
  }

  /**
   * Consolidate and deduplicate results
   * @private
   */
  _consolidateResults() {
    // Convert to arrays, sort, deduplicate
    const uniqueSubs = Array.from(this.results.subdomains)
      .map(s => s.toLowerCase().trim())
      .filter(s => s && s.includes(this.results.target))
      .sort();

    // Remove wildcards and cleanup
    const cleaned = uniqueSubs
      .map(s => s.replace(/^\*\./, ''))
      .filter((s, idx, arr) => arr.indexOf(s) === idx); // Final dedup

    this.results.subdomains = cleaned;
    this.results.stats = {
      totalSources: Object.keys(this.results.sources).length,
      totalSubdomains: cleaned.length,
      uniqueSubdomains: cleaned.length,
      sourceBreakdown: this.results.sources,
    };

    console.log(`\n📈 Results:`);
    console.log(`   Total subdomains: ${cleaned.length}`);
    console.log(`   Sources used: ${Object.keys(this.results.sources).length}`);
    console.log(`   Source breakdown: ${JSON.stringify(this.results.sources)}`);
  }

  /**
   * Export consolidated results
   * @private
   */
  _exportResults(filePath) {
    const outputPath = filePath.endsWith('.txt')
      ? filePath
      : filePath.replace(/\.\w+$/, '.txt');

    fs.writeFileSync(
      outputPath,
      this.results.subdomains.join('\n')
    );

    console.log(`\n💾 Exported to: ${outputPath}`);
  }

  /**
   * Get results formatted for Shodan searches
   */
  getSearchQueries(includeWildcard = false) {
    return this.results.subdomains.map(sub => {
      if (includeWildcard) {
        return `domain:"${sub}" OR hostname:"${sub}"`;
      }
      return `hostname:"${sub}"`;
    });
  }

  /**
   * Get results as simple array
   */
  getSubdomains() {
    return this.results.subdomains;
  }

  /**
   * Get full results object
   */
  getResults() {
    return this.results;
  }
}

module.exports = DomainEnumeration;
