---
name: shodan-recon
description: Use when performing Shodan.io reconnaissance - searching internet-connected hosts, DNS lookups, threat scoring, subdomain enumeration, or exporting scan results using the shodan-recon Node.js library
---

# Shodan Recon

Node.js library wrapping the Shodan.io REST API. Entry point: `lib/shodan-client.js`.

## Setup

```javascript
const ShodanClient = require('shodan-recon'); // or require('./lib/shodan-client')
const shodan = new ShodanClient();
```

API key resolution (priority order): `SHODAN_API_KEY` env → `~/.shodan/key` → `~/.openclaw/workspace/TOOLS.md`

## Response Envelope

Every async method returns:
```javascript
{ success: boolean, method, query, results, metadata: { timestamp, creditsUsed, cached } }
```
Always check `result.success` before accessing `result.results`.

## Credit Costs

| Method | Credits | Notes |
|--------|---------|-------|
| `search(query, opts, useCache)` | 1 | Cached 24h |
| `host(ip, opts, useCache)` | 1 | Cached 24h |
| `count(query)` | 0 | Use to validate queries first |
| `dns.domain(domain)` | 1 | Subdomains + DNS records |
| `dns.resolve(hostnames)` | 0–1 | Batch supported |
| `dns.reverse(ips)` | 0–1 | Batch supported |
| `account()`, `myIp()`, `filters()`, `ports()`, `protocols()` | 0 | Free |
| `exploits()`, `exploitCount()` | — | Essentials+ tier only |
| `scan()`, `scanStatus()` | — | Enterprise tier only |

**Always call `count()` before `search()`** to validate query syntax without spending credits.

## Search Syntax

```
product:nginx country:US port:443
org:"Google"
ssl.cert.subject.CN:"*.example.com"
asn:AS12345
http.title:"admin"
```

## Caching

Auto-enabled, 24h TTL, stored in `~/.openclaw/workspace/.shodan-cache/`.

```javascript
await shodan.search('nginx', {}, false)  // bypass for one call
shodan.setCaching(false)                  // disable globally
shodan.getCacheStats()
shodan.listCache()
shodan.clearCache()                              // all entries
shodan.clearCache('search', { query: 'nginx' }) // specific entry
```

## Export

```javascript
shodan.export(query, results.results, ['json', 'csv', 'markdown'])
// Writes to ~/.openclaw/workspace/shodan-exports/
shodan.listExports()
```

## Analysis (Synchronous, No Credits)

```javascript
shodan.filterResults(results, {
  minThreatScore, maxThreatScore,
  hasVulns,          // boolean
  services,          // ['ssh', 'http']
  countries,         // ['US', 'UK']
  ports,             // [22, 443]
  productMatch,      // regex string
})
shodan.rankByThreat(results, limit)    // top N hosts sorted by score
shodan.analyzeResults(results)          // distributions + auto-generated insights
shodan.mapInfrastructure(results)       // org-clustered network graph (nodes + edges)
shodan.findAnomalies(results)           // flags high port counts, CVEs, critical concentrations
```

**Threat scoring (0–100):**
- Open ports: ×5 pts (max 30)
- Critical services (SSH/RDP/SMB/Telnet/FTP/HTTP): ×10 pts (max 25)
- CVEs: ×8 pts (max 30)
- Exposed data points: ×2 pts (max 15)

**Risk levels:** CRITICAL ≥70 · HIGH ≥50 · MEDIUM ≥30 · LOW ≥10 · MINIMAL <10

## High-Level Workflows

```javascript
// Full pipeline: search → host enrichment → DNS enrichment → export
await shodan.fullReconWorkflow('org:"Acme Corp"', {
  maxHosts: 25,
  exportFormats: ['json', 'markdown'],
  enrichDns: true,
  threatThreshold: 10,
});

// Search + instant export
await shodan.searchAndExport('port:443 ssl:nginx', ['json', 'csv', 'markdown']);

// Batch DNS
await shodan.reverseDnsBatch(['8.8.8.8', '1.1.1.1']);
await shodan.dnsResolveBatch(['google.com', 'github.com']);
```

## Domain Enumeration (No Shodan Credits)

Discovers subdomains before starting Shodan searches:

```javascript
await shodan.enumerateDomain('example.com', { useTools: true, useAPIs: true });
// or
const enumerator = shodan.createDomainEnumerator();
await enumerator.enumerate('example.com');
enumerator.getSearchQueries() // returns Shodan hostname: queries ready to use
```

Sources (gracefully skipped if unavailable):
- **crt.sh** — always enabled, no key required
- **SecurityTrails** — requires `SECURITYTRAILS_API_KEY`
- **GitHub** — requires `GITHUB_TOKEN`
- **CLI tools** — subfinder, findomain, amass, assetfinder (auto-detected)

## Common Mistakes

- Pass `result.results` (the array), not the full response envelope, to analysis methods
- `exploits()` returns 404 on free/One-Time-Pay tier — requires Essentials+
- `scan()` is asynchronous — poll status with `scanStatus(id)`; requires Enterprise tier
- `dns.domain()` costs 1 credit; `dns.resolve()` / `dns.reverse()` cost 0 on premium, 1 on free
