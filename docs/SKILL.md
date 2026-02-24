# Shodan Recon Skill

Shodan.io API integration for reconnaissance and asset discovery. Provides methods to search for devices, services, and domains across the internet.

**Phase 1 Extended:** Custom implementation with full API control for recon agent optimization.

## Quick Start

### 1. Install Dependencies

```bash
cd skills/shodan-recon
npm install
```

### 2. Set API Key

Get your API key from https://account.shodan.io/

```bash
export SHODAN_API_KEY=your_api_key_here
```

Or save to file:
```bash
mkdir -p ~/.shodan
echo "your_api_key_here" > ~/.shodan/key
```

Or add to `TOOLS.md`:
```markdown
### Shodan
SHODAN_API_KEY: your_api_key_here
```

### 3. Quick Test

```bash
node examples/search-example.js
node examples/dns-example.js
```

## Phase 2: Caching & Export ✨

### Automatic Caching

All search results are automatically cached locally for 24 hours. Repeated queries return cached data **without using credits**.

```javascript
// First call - uses 1 credit
const search1 = await shodan.search('product:nginx');
// { metadata: { creditsUsed: 1, cached: false } }

// Second call - uses 0 credits (served from cache!)
const search2 = await shodan.search('product:nginx');
// { metadata: { creditsUsed: 0, cached: true, _cacheAge: 5 } }
```

**Disable caching** if needed:
```javascript
const search = await shodan.search('query', {}, false);  // useCache = false
shodan.setCaching(false);  // Disable for all queries
```

### Export Results

Export search results to multiple formats:

```javascript
// Export after searching
const results = await shodan.search('product:nginx');

// Export to JSON, CSV, and Markdown
const exports = shodan.export(
  'product:nginx',
  results.results,
  ['json', 'csv', 'markdown']
);

// Returns: [
//   { success: true, format: 'json', file: 'product_nginx_2026-02-20.json', ... },
//   { success: true, format: 'csv', file: 'product_nginx_2026-02-20.csv', ... },
//   { success: true, format: 'markdown', file: 'product_nginx_2026-02-20.md', ... }
// ]
```

**Export formats:**
- **JSON** — Full result structure, easy to parse
- **CSV** — Spreadsheet-friendly, IPs, ports, products, orgs
- **Markdown** — Human-readable reports with facets and tables

### Cache Management

**Get cache statistics:**
```javascript
shodan.getCacheStats();
// {
//   validEntries: 3,
//   expiredEntries: 0,
//   totalSizeMB: "0.05",
//   cacheDir: "~/.openclaw/workspace/.shodan-cache"
// }
```

**List cached queries:**
```javascript
shodan.listCache();
// [
//   { method: 'search', params: {...}, cached: '2026-02-20T16:00:00Z', age: 120 },
//   { method: 'host', params: {...}, cached: '2026-02-20T15:50:00Z', age: 600 }
// ]
```

**Clear cache:**
```javascript
shodan.clearCache();  // Clear all
shodan.clearCache('search', { query: 'product:nginx' });  // Clear specific
```

**List exports:**
```javascript
shodan.listExports();
// {
//   count: 5,
//   exportDir: "~/.openclaw/workspace/shodan-exports",
//   files: [...]
// }
```

## API Methods

### Core Search Methods

#### `search(query, options)`

Search for hosts matching a query string.

```javascript
const ShodanClient = require('./lib/shodan-client');
const shodan = new ShodanClient();

const results = await shodan.search('product:nginx country:US port:443', {
  facets: 'org,country,port',
  page: 1,
});
```

**Query Syntax Examples:**
- `product:nginx` — Find Nginx servers
- `country:US` — Limit to United States
- `port:443` — HTTPS servers only
- `version:1.18` — Specific version
- `org:"Google"` — Specific organization
- `product:apache country:US` — Combined filters

**Common Facets:**
- `country` — Results by country code
- `org` — Results by organization
- `port` — Results by port number
- `product` — Results by software product
- `version` — Results by software version
- `os` — Results by operating system
- `asn` — Results by autonomous system number

**Response Format:**
```javascript
{
  success: true,
  method: "search",
  query: "product:nginx",
  results: {
    matches: [
      {
        ip_str: "1.2.3.4",
        port: 443,
        product: "nginx",
        version: "1.18.0",
        org: "Example Org",
        country_code: "US",
        // ... more fields
      }
    ],
    facets: {
      country: [
        { value: "US", count: 12345 },
        { value: "CN", count: 5432 }
      ]
    },
    total: 23047224
  },
  metadata: {
    timestamp: "2026-02-20T17:18:00Z",
    creditsUsed: 1,
    cached: false
  }
}
```

#### `host(ip, options)`

Get detailed information about a single IP address.

```javascript
const hostInfo = await shodan.host('8.8.8.8');

// Response includes:
// - country_name, country_code
// - organization, isp, asn
// - open ports and services
// - http data if applicable
// - historical data
```

#### `count(query)`

Count total matches for a query **without** returning results (uses 0 credits).

```javascript
const count = await shodan.count('product:apache');
// Returns: { total: 5432156 }
```

#### `filters()`

Get available search filters and their syntax.

```javascript
const filters = await shodan.filters();
// Returns list of all valid filters you can use in queries
```

#### `account()`

Get account information and remaining credits.

```javascript
const account = await shodan.account();
// Returns: { credits: 42, display_name: "Your Name", ... }
```

#### `ports()`

Get list of ports that Shodan crawls.

```javascript
const ports = await shodan.ports();
// Returns array of port numbers: [22, 80, 443, 8080, ...]
```

#### `protocols()`

Get list of protocols that Shodan uses for scanning.

```javascript
const protocols = await shodan.protocols();
// Returns object with protocol names and descriptions
```

### Exploits Methods (Premium Only)

**⚠️ Requires Shodan Premium Account** — Free accounts will get 404 errors.

#### `exploits(query, options)`

Search the exploits database.

```javascript
const results = await shodan.exploits('apache', {
  page: 1,
});

// Returns:
// {
//   matches: [
//     { title, description, source, ... }
//   ],
//   total: 12345
// }
// Requires: Premium API key
```

#### `exploitCount(query, options)`

Count exploits for a query.

```javascript
const count = await shodan.exploitCount('rce');
// Returns: { total: 5432 }
// Requires: Premium API key
```

### Utility Methods

#### `myIp()`

Get your external IP address as seen by Shodan.

```javascript
const ip = await shodan.myIp();
// Returns: "203.0.113.42"
```

### Scanning Methods (Enterprise/Premium)

#### `scan(networks, options)`

Request Shodan to scan a network (asynchronous).

```javascript
// Single network
const scan = await shodan.scan('192.168.1.0/24');

// Multiple networks
const scan = await shodan.scan(['192.168.1.0/24', '10.0.0.0/8']);

// With description
const scan = await shodan.scan('192.168.1.0/24', {
  comment: 'Office network scan'
});

// Returns:
// {
//   id: 'R2XRT5HH6X67PFAB',
//   count: 256,
//   credits_left: 5119
// }
```

**Note:** Scanning is asynchronous. Use `scanStatus()` to check results or monitor via streaming API.

#### `scanStatus(scanId)`

Get the status/results of a submitted scan.

```javascript
const status = await shodan.scanStatus('R2XRT5HH6X67PFAB');

// Returns information about the scan progress
```

### DNS Methods

#### `dns.domain(domain, options)`

Get all subdomains and DNS records for a domain.  
**Uses 1 query credit per lookup**

```javascript
const results = await shodan.dns.domain('google.com', {
  history: false,    // Include historical DNS data (optional)
  type: 'A',         // Filter by DNS type: A, AAAA, CNAME, NS, SOA, MX, TXT (optional)
  page: 1            // Pagination (optional)
});

// Returns:
// {
//   subdomains: ['www', 'mail', 'drive', ...],
//   data: [
//     { type: 'A', value: '142.251.41.14' },
//     { type: 'MX', value: 'aspmx.l.google.com' }
//   ]
// }
```

#### `dns.resolve(hostnames)`

Simple hostname → IP resolution (batch supported).  
**Uses 0 credits** (if premium) or **1 credit** (free tier)

```javascript
const ips = await shodan.dns.resolve('google.com');
// Single hostname

const ips = await shodan.dns.resolve(['google.com', 'facebook.com']);
// Multiple hostnames

// Returns:
// {
//   'google.com': '142.251.41.14',
//   'facebook.com': '31.13.85.36'
// }
```

#### `dns.reverse(ips)`

Get domains associated with one or more IPs (reverse lookup).  
**Uses 0 credits** (if premium) or **1 credit per IP** (free tier)

```javascript
const domains = await shodan.dns.reverse('8.8.8.8');
// Single IP

const domains = await shodan.dns.reverse(['8.8.8.8', '1.1.1.1']);
// Multiple IPs (batch)

// Returns:
// {
//   '8.8.8.8': ['dns.google', 'google-dns-a.google.com'],
//   '1.1.1.1': ['one.one.one.one', 'cloudflare-dns.com']
// }
```

## Credit Costs

| Method | Credits | Cached | Notes |
|--------|---------|--------|-------|
| `search()` | 1 | 0 | Per query (cached 24h) |
| `host()` | 1 | 0 | Per IP (cached 24h) |
| `count()` | 0 | - | Free way to test queries |
| `dns.forward()` | 1 | 0 | Per domain (cached 24h) |
| `dns.reverse()` | 1 | 0 | Per IP (cached 24h) |
| `account()` | 0 | - | Free |
| `ports()` | 0 | 0 | Free (cached 24h) |
| `protocols()` | 0 | 0 | Free (cached 24h) |

## Query Tips

### Finding Vulnerable Services

```javascript
// Find unpatched Apache
await shodan.search('product:apache version:2.2');

// Find default credentials (often visible in HTTP headers)
await shodan.search('http.title:"admin"');

// Find exposed databases
await shodan.search('product:mongodb port:27017');
```

### Asset Discovery

```javascript
// Find all infrastructure owned by an org
await shodan.search('org:"Example Corp"', { facets: 'port,product' });

// Find company website servers
await shodan.search('ssl.cert.subject.CN:"*.example.com"');

// Find infrastructure by ASN (if you know the company's ASN)
await shodan.search('asn:AS12345');
```

### Geographic Analysis

```javascript
// Find services by country
await shodan.search('product:ssh country:RU', { facets: 'city,org' });

// Top countries running a service
await shodan.search('product:nginx', { facets: 'country' });
```

## Error Handling

All responses include `success` and `error` fields:

```javascript
const result = await shodan.search('invalid query syntax!@#');

if (!result.success) {
  console.error(`Error: ${result.error}`);
}
```

**Common Errors:**
- `Invalid API key` — Check SHODAN_API_KEY
- `API access denied` — Key may be restricted
- `Account limit exceeded` — No credits remaining
- `Query validation failed` — Invalid syntax in search string
- `IP not found in Shodan database` — IP hasn't been scanned by Shodan

## Rate Limits

- API calls: 1 per second (free tier)
- Search queries: Limited by credits
- Check `account()` to see remaining credits

## Best Practices

1. **Use `count()` first** — Test your query syntax without using credits
2. **Use facets wisely** — Facets provide summary data without large result sets
3. **Paginate results** — Use `page` option to avoid huge responses
4. **Cache results** — Phase 2 will add built-in caching
5. **Check credits** — Call `account()` to monitor remaining credits

## Recon Workflow Example

```javascript
const shodan = new ShodanClient();

// 1. Check credits
const account = await shodan.account();
console.log(`Credits: ${account.results.credits}`);

// 2. Count matches first
const count = await shodan.count('product:nginx country:US');
console.log(`Found ${count.results.total} results`);

// 3. Search with facets to understand data
const summary = await shodan.search('product:nginx country:US', {
  facets: 'org,port,version',
  page: 1,
});

// 4. Get details for specific IPs
for (const match of summary.results.matches) {
  const details = await shodan.host(match.ip_str);
  console.log(`${match.ip_str}: ${details.results.org}`);
}

// 5. DNS enrichment
for (const match of summary.results.matches) {
  const domains = await shodan.dns.reverse(match.ip_str);
  console.log(`${match.ip_str} -> ${domains.results}`);
}
```

## Limitations (Phase 1)

- ❌ No caching (Phase 2)
- ❌ No result export (CSV/JSON bulk)
- ❌ No multi-IP batch operations
- ❌ No query builder UI

## What's Next (Phase 2)

- Local caching with TTL
- Result formatting (CSV, JSON export)
- Batch DNS lookups
- Recon agent integration helpers

## Security Notes

- **Never commit API keys** to git
- **Use environment variables** for API keys
- **Rotate keys regularly** if compromised
- **Monitor credit usage** to detect abuse
- **Read Shodan ToS** before large-scale scanning

## Troubleshooting

**"API key not found"**
```bash
# Set environment variable
export SHODAN_API_KEY=your_key
# or create key file
mkdir -p ~/.shodan && echo "your_key" > ~/.shodan/key
```

**"Account limit exceeded"**
- Check credits: `await shodan.account()`
- Use `count()` to validate queries first (0 credits)
- Consider upgrading your Shodan account

**"Query validation failed"**
- Test syntax on shodan.io website first
- Check [Shodan query reference](https://www.shodan.io/search/filters)
- Use simple queries: `product:nginx` before complex ones

## Resources

- Shodan API Docs: https://developer.shodan.io/api
- Query Filters: https://www.shodan.io/search/filters
- Account: https://account.shodan.io/

---

**Status:** Phase 1 Extended ✅
- Search methods: Complete (search, host, count, filters)
- DNS methods: Complete (forward, reverse, facets)
- Utility methods: Complete (account, ports, protocols, myIp)
- Exploit search: Complete (exploits, exploitCount)
- Error handling: Complete
- Examples: Complete (search, DNS, exploits)
- Custom response formatting: Complete

## Tested & Working ✅

Your API key (One Time Pay tier) verified on 2026-02-20:

- ✅ `search()` — 10.3M+ results per query
- ✅ `count()` — Query counting (0 credits)
- ✅ `host()` — Detailed IP lookup
- ✅ `filters()` — Available search filters
- ✅ `ports()` — 3,846 ports catalogued
- ✅ `protocols()` — 242 protocols
- ✅ `account()` — 20 credits available
- ✅ `myIp()` — External IP lookup
- ✅ `dns.domain()` — Get subdomains & DNS records (1 credit)
- ✅ `dns.resolve()` — Hostname → IP (0 credits premium / 1 credit free)
- ✅ `dns.reverse()` — IP → hostname (0 credits premium / 1 credit free)

**One Time Pay Tier includes:**
- Host search & lookup (1 credit)
- Faceted results (1 credit)
- Metadata queries (0 credits)
- DNS domain lookup (1 credit)
- DNS resolve & reverse (1 credit per lookup)
- 20 query credits total

**Not included (requires higher tier):**
- ❌ `exploits()` — Requires Essentials+ tier

---

**Status:** Phase 2 Complete ✅ — Full API Implementation
- **Search methods:** search, host, count, filters, ports, protocols (6 methods)
- **DNS methods:** domain, resolve, reverse (3 methods, batch support)
- **Utility methods:** account, myIp (2 methods)
- **Scanning methods:** scan, scanStatus (2 methods, enterprise tier)
- **Exploit search:** exploits, exploitCount (2 methods, essentials+ tier)
- **Caching:** 24h TTL, auto-cache, management functions
- **Export:** JSON, CSV, Markdown formats
- **Error handling:** Complete with try/catch
- **Examples:** search, DNS, exploits, cache & export
- **API Reference:** Complete with all endpoints, parameters, credits
- **Custom response formatting:** Consistent format with metadata

**Total Implemented Methods:** 17 API endpoints
**Total Caching:** Auto on all cacheable methods
**Tier Support:** Free (One Time Pay) → Premium → Enterprise

---

## Phase 3: Agent Workflows & Analysis Tools ✨

High-level helpers for building recon agents. Chain multiple API calls and analyze results automatically.

### Agent Workflows

#### 1. Full Reconnaissance Workflow
Complete chain: Search → Host Lookup → DNS → Export

```javascript
const result = await shodan.fullReconWorkflow('product:nginx', {
  maxHosts: 25,              // Process up to 25 hosts (default: 10)
  exportFormats: ['json', 'markdown'],  // Export these formats
  enrichDns: true,           // Perform DNS lookups on results
  threatThreshold: 10,       // Only include hosts with score ≥10
});

// Returns:
// {
//   success: true,
//   data: {
//     query: 'product:nginx',
//     timestamp: '2026-02-21T22:30:00Z',
//     stages: {
//       search: { totalMatches, resultsReturned, creditsUsed, cached },
//       hostLookup: { processed, successful, creditsUsed, filtered },
//       dnsEnrichment: { successful, failed },
//       export: { formats, files }
//     },
//     summary: {
//       totalHosts,
//       processed,
//       exported,
//       creditsUsed,
//       dnsLookupsPerformed,
//       executionTime
//     }
//   }
// }
```

**Use Cases:**
- Complete reconnaissance of target infrastructure
- Automated asset discovery and documentation
- Multi-stage threat assessment

#### 2. Search & Export
Quick search with immediate export to multiple formats

```javascript
const result = await shodan.searchAndExport('port:443 ssl:nginx', [
  'json',
  'csv',
  'markdown'
]);

// Returns exported files with metadata
```

#### 3. Batch DNS Operations
Process multiple IPs/hostnames in one call

```javascript
// Reverse DNS (IP → hostname)
const reverse = await shodan.reverseDnsBatch([
  '8.8.8.8',
  '1.1.1.1',
  '208.67.222.222'
]);
// { success: true, data: { mappings: { '8.8.8.8': 'dns.google', ... } } }

// Forward DNS (hostname → IP)
const forward = await shodan.dnsResolveBatch([
  'google.com',
  'github.com'
]);
// { success: true, data: { mappings: { 'google.com': '172.217.0.0', ... } } }
```

### Result Analysis Tools

#### 1. Filter Results
Multiple filter criteria in one call

```javascript
const filtered = shodan.filterResults(results, {
  minThreatScore: 50,        // Threat score range
  maxThreatScore: 100,
  hasVulns: true,            // Only hosts with known vulns
  hasData: true,             // Only hosts with exposed data
  services: ['ssh', 'http'], // Services to match
  countries: ['US', 'UK'],   // Country codes
  organizations: ['Google', 'AWS'],  // Org substring match
  ports: [22, 443, 80],      // Specific ports
  productMatch: 'Apache|Nginx',  // Product regex match
});
```

#### 2. Analyze Results
Get comprehensive insights from results

```javascript
const analysis = shodan.analyzeResults(results);
// {
//   success: true,
//   data: {
//     totalHosts: 150,
//     threatDistribution: { CRITICAL: 5, HIGH: 12, MEDIUM: 28, ... },
//     serviceDistribution: { 'nginx': 87, 'Apache': 45, 'IIS': 18, ... },
//     countryDistribution: { 'US': 65, 'CN': 28, 'RU': 15, ... },
//     orgDistribution: { 'Google': 12, 'AWS': 8, ... },
//     commonPorts: { '443': 95, '80': 87, '22': 42, ... },
//     vulnerabilityStats: {
//       hostsWithVulns: 34,
//       totalVulns: 127,
//       criticalVulns: 8
//     },
//     exposedDataStats: {
//       hostsWithData: 42,
//       totalDataPoints: 156
//     },
//     insights: [
//       'Most hosts located in US (43.3%)',
//       'Most common service: nginx (58%)',
//       '⚠️ 5 host(s) with CRITICAL threat level'
//     ]
//   }
// }
```

#### 3. Threat Ranking
Score and sort hosts by risk level

```javascript
const topThreats = shodan.rankByThreat(results, 10);
// [
//   {
//     rank: 1,
//     ip: '203.0.113.1',
//     threatScore: 92,
//     riskLevel: 'CRITICAL',
//     ports: 8,
//     services: ['SSH', 'HTTP', 'HTTPS', ...],
//     country: 'CN',
//     org: 'Unknown',
//     vulns: 5
//   },
//   ...
// ]
```

#### 4. Infrastructure Mapping
Build network topology from results

```javascript
const map = shodan.mapInfrastructure(results);
// {
//   success: true,
//   data: {
//     nodes: [
//       { id: '203.0.113.1', label: '203.0.113.1', org: 'Google', ... },
//       { id: '203.0.113.2', label: '203.0.113.2', org: 'AWS', ... }
//     ],
//     edges: [
//       { source: '203.0.113.1', target: '203.0.113.2', type: 'organization' }
//     ],
//     clusters: {
//       'Google': ['203.0.113.1', '203.0.113.3'],
//       'AWS': ['203.0.113.2']
//     },
//     summary: {
//       totalNodes: 150,
//       totalClusters: 12,
//       totalConnections: 45
//     }
//   }
// }
```

**Use for:**
- Visualization of target infrastructure
- Identifying organizational relationships
- Mapping complex network topology

#### 5. Anomaly Detection
Find high-risk patterns and unusual behaviors

```javascript
const anomalies = shodan.findAnomalies(results);
// [
//   {
//     type: 'KNOWN_VULNERABILITIES',
//     severity: 'HIGH',
//     count: 7,
//     description: '7 host(s) with known vulnerabilities',
//     samples: [
//       { ip: '203.0.113.1', vulns: 3 },
//       { ip: '203.0.113.4', vulns: 2 }
//     ]
//   },
//   {
//     type: 'CRITICAL_THREAT_CONCENTRATION',
//     severity: 'CRITICAL',
//     count: 5,
//     description: '5 host(s) with critical threat scores (≥70)',
//     samples: [...]
//   },
//   ...
// ]
```

**Detects:**
- Hosts with unusually high open port counts
- Known vulnerabilities and CVEs
- Critical threat score concentrations
- Unusual service-port combinations

### Threat Scoring Algorithm

Hosts are automatically scored (0-100) based on:
- **Open ports** (5 pts each, max 30)
- **Critical services** (10 pts each, max 25) — SSH, RDP, SMB, Telnet, FTP, HTTP(S)
- **Known vulnerabilities** (8 pts each, max 30)
- **Exposed data points** (2 pts each, max 15)

Risk levels:
- **CRITICAL:** 70-100
- **HIGH:** 50-69
- **MEDIUM:** 30-49
- **LOW:** 10-29
- **MINIMAL:** 0-9

### Examples

Run full agent workflow example:
```bash
node examples/agent-workflows.js
```

The example demonstrates:
- Full recon workflow with all stages
- Search & export operations
- Batch DNS operations
- Result analysis & ranking
- Infrastructure mapping
- Anomaly detection

**Next:** Phase 4 (Report generation, multi-target campaigns, scheduled scans)
