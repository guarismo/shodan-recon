# Shodan Recon

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)]()

Comprehensive Node.js wrapper for [Shodan.io](https://www.shodan.io/) API with built-in caching, analysis tools, and workflow automation for reconnaissance and asset discovery.

Perfect for penetration testers, security researchers, and threat hunters who need programmatic access to Shodan data.

## ✨ Features

- ✅ **Complete API Coverage** - 17+ methods covering all Shodan endpoints
- ✅ **Automatic Caching** - 24-hour TTL cache saves API credits
- ✅ **Smart Analysis** - Threat scoring, anomaly detection, infrastructure mapping
- ✅ **Batch Operations** - DNS resolution for multiple hosts
- ✅ **Multi-Format Export** - JSON, CSV, Markdown reports
- ✅ **Domain Enumeration** - Discover subdomains via certificate transparency
- ✅ **Workflow Automation** - High-level methods for common tasks
- ✅ **Error Handling** - Comprehensive error messages and validation
- ✅ **Zero External Dependencies** - Only axios for HTTP (included)

## 📦 Installation

### npm

```bash
npm install shodan-recon
```

### From Git

```bash
git clone https://github.com/yourusername/shodan-recon.git
cd shodan-recon
npm install
```

## 🚀 Quick Start

### 1. Get Your Shodan API Key

Sign up at [https://www.shodan.io/](https://www.shodan.io/) and get your API key.

### 2. Set API Key

```bash
# Option A: Environment variable
export SHODAN_API_KEY=your_api_key_here

# Option B: File (~/.shodan/key)
mkdir -p ~/.shodan
echo "your_api_key_here" > ~/.shodan/key

# Option C: Pass to client
const shodan = new ShodanClient('your_api_key_here');
```

### 3. Basic Usage

```javascript
const ShodanClient = require('shodan-recon');

const shodan = new ShodanClient();

// Search for hosts
const results = await shodan.search('product:nginx country:US');
console.log(`Found ${results.total} hosts`);

// Get detailed info about an IP
const host = await shodan.host('8.8.8.8');
console.log(`Host runs: ${host.os}`);

// DNS lookup
const ips = await shodan.dns.resolve('example.com');
console.log(`example.com resolves to: ${ips.join(', ')}`);
```

## 📚 API Documentation

### Search Methods

```javascript
// Search for hosts
const results = await shodan.search('apache');
// { total: 123456, results: [...] }

// Count matches
const count = await shodan.count('product:nginx');
// { count: 5000000 }

// Get detailed host info
const host = await shodan.host('192.168.1.1');
// { ip: '192.168.1.1', ports: [...], vulns: [...] }
```

### DNS Methods

```javascript
// Forward DNS lookup
const ips = await shodan.dns.resolve('example.com');
// ['93.184.216.34']

// Reverse DNS lookup
const domains = await shodan.dns.reverse('8.8.8.8');
// ['google-dns-a.google.com']

// Get subdomains and DNS records
const dns = await shodan.dns.domain('example.com');
// { subdomains: [...], dns: {...} }
```

### Account Methods

```javascript
// Get account info and credits
const account = await shodan.account();
// { member: true, credits: 123, username: '...' }

// Get your public IP
const myIp = await shodan.myIp();
// '203.0.113.45'
```

### Analysis Methods

```javascript
// Threat scoring
const threats = shodan.analysis.rankByThreat(results);
// Ranked by CVSS score and vulnerabilities

// Infrastructure mapping
const graph = shodan.analysis.mapInfrastructure(results);
// Network topology and clustering

// Anomaly detection
const anomalies = shodan.analysis.findAnomalies(results);
// Suspicious patterns detected
```

### Export Methods

```javascript
// Export search results
const exports = shodan.export('product:nginx', results, ['json', 'csv', 'markdown']);
// Creates files:
//   - product_nginx_2026-02-23.json
//   - product_nginx_2026-02-23.csv
//   - product_nginx_2026-02-23.md
```

## 💡 Common Workflows

### Reconnaissance

```javascript
// Find all web servers in country
const webservers = await shodan.search('product:apache country:US');

// Analyze threats
const threats = shodan.analysis.rankByThreat(webservers.results);
console.log(`Top threat: ${threats[0].ip} (${threats[0].riskLevel})`);
```

### Vulnerability Hunting

```javascript
// Find vulnerable services
const vulnerable = await shodan.search('product:apache http.title:"Apache"');

// Score by vulnerability
const scored = shodan.analysis.rankByThreat(vulnerable.results);
scored.forEach(host => {
  console.log(`${host.ip}: ${host.vulns.length} CVEs`);
});
```

### Network Mapping

```javascript
// Map organization's internet footprint
const targets = await shodan.search('org:"Acme Corp"');
const infrastructure = shodan.analysis.mapInfrastructure(targets.results);

// Exports network graph
console.log(infrastructure);
```

### Batch Operations

```javascript
// Resolve multiple hostnames
const domains = ['google.com', 'cloudflare.com', 'amazon.com'];
const resolved = await shodan.dns.resolve(domains);
// { 'google.com': [...], 'cloudflare.com': [...], ... }
```

## ⚙️ Configuration

### API Key Options

```javascript
// Priority order:
// 1. Passed to constructor
const shodan = new ShodanClient('your-api-key');

// 2. Environment variable
process.env.SHODAN_API_KEY = 'your-api-key';

// 3. File at ~/.shodan/key
// mkdir -p ~/.shodan && echo 'your-api-key' > ~/.shodan/key
```

### Caching

```javascript
// Caching is enabled by default (24-hour TTL)
const results = await shodan.search('nginx');  // 1 credit used

// Second call uses cache (0 credits)
const results2 = await shodan.search('nginx');  // 0 credits

// Disable caching for a query
const fresh = await shodan.search('nginx', {}, false);  // Force fresh query

// Disable caching globally
shodan.setCaching(false);
```

### Cache Management

```javascript
// Get cache statistics
const stats = shodan.getCacheStats();
console.log(`Cached entries: ${stats.validEntries}`);

// List cached queries
const entries = shodan.listCache();

// Clear specific cache
shodan.clearCache('product:nginx');

// Clear all cache
shodan.clearAllCache();
```

## 📊 Threat Analysis

### Threat Scoring

Hosts are scored 0-100 based on:
- Open ports (5 pts each)
- Critical services (10 pts)
- Known CVEs (8 pts each)
- Exposed data (2 pts)

Risk levels:
- 🔴 **CRITICAL** (70+)
- 🟠 **HIGH** (50-69)
- 🟡 **MEDIUM** (30-49)
- 🟢 **LOW** (0-29)

### Usage

```javascript
const results = await shodan.search('apache');
const threats = shodan.analysis.rankByThreat(results.results);

threats.forEach(host => {
  console.log(`${host.ip}: ${host.riskLevel} (${host.score}/100)`);
});
```

## 🔍 Examples

### Quick Search

```bash
node examples/search-example.js
```

### DNS Reconnaissance

```bash
node examples/dns-example.js
```

### Account Information

```bash
node examples/account-example.js
```

### Cache Statistics

```bash
npm run cache:stats
```

See `examples/` for more samples.

## 🐛 Troubleshooting

### Authentication Error

```
Error: API key not found
```

**Solution:** Set `SHODAN_API_KEY` environment variable or `~/.shodan/key` file.

### Rate Limiting

```
Error: Rate limit exceeded
```

**Solution:** Use caching to avoid repeated queries. Each query costs 1 credit.

### No Results

```javascript
const results = await shodan.search('impossible-product-name-12345');
console.log(results.total);  // 0
```

**Solution:** Adjust search query. See Shodan search syntax at https://www.shodan.io/search/syntax

## 📈 API Credits

Each search costs **1 credit**. Check your balance:

```javascript
const account = await shodan.account();
console.log(`Credits remaining: ${account.credits}`);
```

**Tips to save credits:**
- Use caching (enabled by default)
- Combine queries efficiently
- Reuse results when possible

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Shodan.io](https://www.shodan.io/) - Internet search engine for internet-connected devices
- Community security researchers and penetration testers

## ⚠️ Disclaimer

This tool is for authorized security testing only. Unauthorized access to computer systems is illegal. Always get written permission before testing systems you don't own.

## 📞 Support

For issues and questions:
- GitHub Issues: [Report a bug](https://github.com/yourusername/shodan-recon/issues)
- Discussions: [Ask a question](https://github.com/yourusername/shodan-recon/discussions)
- Shodan Docs: [Shodan API Reference](https://developer.shodan.io/)

---

**Made with ❤️ for security professionals**
