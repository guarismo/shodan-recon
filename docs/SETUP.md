# Shodan Recon - Setup Guide

## Prerequisites

- Node.js 14+ (Check: `node --version`)
- npm or yarn
- Shodan account with API key
- Active internet connection

## Installation

### Option 1: npm Package

```bash
npm install shodan-recon
```

### Option 2: From GitHub

```bash
git clone https://github.com/yourusername/shodan-recon.git
cd shodan-recon
npm install
```

### Option 3: Local Development

```bash
git clone <repo-url>
cd shodan-recon
npm install

# Test it works
npm test
```

## Configuration

### Getting Your API Key

1. **Create Shodan Account** (free): https://www.shodan.io/
2. **Get API Key**: https://account.shodan.io/
3. **Copy** your API key (e.g., `u123abc456def789ghi`)

### Setting API Key

**Option A: Environment Variable (Recommended)**

```bash
export SHODAN_API_KEY=your_api_key_here

# Verify
echo $SHODAN_API_KEY
```

**Option B: File (~/.shodan/key)**

```bash
mkdir -p ~/.shodan
echo "your_api_key_here" > ~/.shodan/key
chmod 600 ~/.shodan/key
```

**Option C: Direct to Client**

```javascript
const ShodanClient = require('shodan-recon');
const shodan = new ShodanClient('your_api_key_here');
```

**Option D: .env File**

```bash
# Create .env
echo "SHODAN_API_KEY=your_api_key_here" > .env

# Load in Node.js
require('dotenv').config();
const shodan = new ShodanClient();
```

## First Run

### 1. Test Installation

```bash
npm test
```

This runs a basic Shodan search.

### 2. Check API Credits

```bash
SHODAN_API_KEY=your_key node examples/account-example.js
```

Shows your account balance and credit usage.

### 3. Try a Search

```bash
SHODAN_API_KEY=your_key node examples/search-example.js
```

Searches for a popular product and displays results.

## API Credit Management

### Understanding Credits

- Each **search query** = **1 credit**
- Each **host lookup** = **1 credit**
- Each **DNS lookup** = **1 credit**
- **Caching** = **0 credits** (reuses cached results)

### Free vs. Paid Tiers

| Tier | Credits/Month | Cost |
|------|---------------|------|
| Free | 1 | Free |
| Professional | 100 | $10 |
| Small Business | 1,000 | $60 |
| Large Business | 10,000+ | Custom |

**⏰ Credits reset monthly on your billing date.**

### Maximize Credits

1. **Use Caching** (enabled by default)
   ```javascript
   // First call: 1 credit
   await shodan.search('nginx');
   
   // Second call: 0 credits (cached)
   await shodan.search('nginx');
   ```

2. **Batch Operations**
   ```javascript
   // More efficient
   const domains = ['a.com', 'b.com', 'c.com'];
   const resolved = await shodan.dns.resolve(domains);
   ```

3. **Combine Queries**
   ```javascript
   // Instead of:
   await shodan.search('nginx');
   await shodan.search('apache');
   
   // Do:
   await shodan.search('product:nginx OR product:apache');
   ```

4. **Clear Old Cache**
   ```javascript
   shodan.clearAllCache();
   ```

## Usage Patterns

### Pattern 1: Simple Search

```javascript
const ShodanClient = require('shodan-recon');
const shodan = new ShodanClient();

const results = await shodan.search('product:nginx');
console.log(`Found ${results.total} nginx servers`);
```

### Pattern 2: Threat Analysis

```javascript
const results = await shodan.search('apache country:US');

// Rank by threat
const threats = shodan.analysis.rankByThreat(results.results);

// Display critical threats
threats
  .filter(t => t.riskLevel === 'CRITICAL')
  .forEach(t => {
    console.log(`${t.ip}: ${t.vulns.length} vulnerabilities`);
  });
```

### Pattern 3: DNS Reconnaissance

```javascript
// Get subdomains
const dns = await shodan.dns.domain('example.com');
console.log(`Subdomains: ${dns.subdomains.join(', ')}`);

// Resolve each
const ips = await shodan.dns.resolve(dns.subdomains);
dns.subdomains.forEach(domain => {
  console.log(`${domain} → ${ips[domain].join(', ')}`);
});
```

### Pattern 4: Export Reports

```javascript
const results = await shodan.search('nginx');

// Export in all formats
const exports = shodan.export(
  'product:nginx',
  results.results,
  ['json', 'csv', 'markdown']
);

console.log('Exported files:');
exports.forEach(exp => {
  console.log(`  ${exp.file} (${exp.size})`);
});
```

## Search Syntax

Shodan has powerful search syntax. Examples:

```javascript
// By product
shodan.search('product:nginx');

// By country
shodan.search('country:US');

// By port
shodan.search('port:22');

// Combined
shodan.search('product:apache country:US port:80');

// Organization
shodan.search('org:"Google"');

// HTTP status
shodan.search('http.status:200');

// SSL certificate
shodan.search('ssl:google');

// Geographic
shodan.search('geo:40.7,-74.0');  // NYC area
```

For more syntax: https://www.shodan.io/search/syntax

## Caching Configuration

### Default Behavior

- **Enabled** by default
- **24-hour TTL** (time-to-live)
- **Stored in** `.cache/` directory

### Disable Caching

```javascript
// For single query
const results = await shodan.search('nginx', {}, false);

// Disable globally
shodan.setCaching(false);
```

### Manage Cache

```javascript
// View cache stats
const stats = shodan.getCacheStats();
console.log(`Cache size: ${stats.totalSizeMB} MB`);

// List cached entries
const entries = shodan.listCache();

// Clear specific query
shodan.clearCache('product:nginx');

// Clear all
shodan.clearAllCache();
```

## Troubleshooting

### API Key Not Found

```
Error: API key not found. Set SHODAN_API_KEY env var or add to ~/.shodan/key
```

**Solution:**
```bash
export SHODAN_API_KEY=your_key_here
# Verify:
echo $SHODAN_API_KEY
```

### Insufficient Credits

```
Error: You have insufficient credits
```

**Solution:**
- Check credit balance: `shodan.account()`
- Upgrade account at https://www.shodan.io/
- Use caching to avoid repeated queries

### Rate Limiting

```
Error: Rate limit exceeded
```

**Solution:**
- Shodan limits requests per minute
- Add delays between requests
- Use batch operations when possible

### No Results

```javascript
const results = await shodan.search('product:xyz');
console.log(results.total);  // 0
```

**Solution:**
- Check search syntax
- Try broader search
- Verify Shodan has indexed those servers

## Performance Tips

### 1. Reuse Client Instance

```javascript
// ✅ Good
const shodan = new ShodanClient();
const r1 = await shodan.search('nginx');
const r2 = await shodan.search('apache');

// ❌ Bad - creates new instance each time
const r1 = await new ShodanClient().search('nginx');
```

### 2. Batch Operations

```javascript
// ✅ Good - batch DNS
const resolved = await shodan.dns.resolve([
  'domain1.com',
  'domain2.com'
]);

// ❌ Slow - individual lookups
for (const domain of domains) {
  await shodan.dns.resolve(domain);
}
```

### 3. Filter Locally

```javascript
// ✅ Good - fetch once, filter multiple ways
const results = await shodan.search('apache');
const us = results.filter(r => r.location.country_name === 'US');
const high_risk = shodan.analysis.rankByThreat(results);

// ❌ Bad - multiple queries
await shodan.search('apache country:US');
```

## Integration with Other Tools

### With Express.js

```javascript
const express = require('express');
const ShodanClient = require('shodan-recon');

const app = express();
const shodan = new ShodanClient();

app.get('/search', async (req, res) => {
  try {
    const results = await shodan.search(req.query.q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### With Automation

```javascript
// Automated reconnaissance
async function recon(target) {
  const shodan = new ShodanClient();
  
  // Find hosts
  const hosts = await shodan.search(`org:"${target}"`);
  
  // Analyze threats
  const threats = shodan.analysis.rankByThreat(hosts.results);
  
  // Export report
  shodan.export(target, hosts.results, ['json', 'markdown']);
}
```

## Advanced Configuration

### Custom Cache Directory

```javascript
const shodan = new ShodanClient();
shodan.setCacheDir('/custom/path/cache');
```

### Request Timeout

```javascript
const shodan = new ShodanClient('your-key', {
  timeout: 60000  // 60 second timeout
});
```

## Next Steps

- Read [SKILL.md](SKILL.md) for complete API reference
- Check [examples/](../examples/) for working samples
- Review [search syntax](https://www.shodan.io/search/syntax)
- Join Shodan community for tips and techniques

## Support

- 📖 [Full Documentation](SKILL.md)
- 🐛 [Report Issues](https://github.com/yourusername/shodan-recon/issues)
- 📊 [Shodan Stats](https://www.shodan.io/stats)
- 💬 [Shodan Forum](https://forums.shodan.io/)
