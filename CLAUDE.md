# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run examples (there are no automated tests - examples serve as integration tests)
npm test                    # Runs examples/search-example.js
npm run test:dns            # Runs examples/dns-example.js
npm run test:account        # Runs examples/account-example.js
npm run cache:stats         # Show cache statistics

# Run any specific example directly
SHODAN_API_KEY=your_key node examples/search-example.js
node examples/domain-enumeration-example.js
```

**Note:** All example scripts require a valid `SHODAN_API_KEY`. The package has no test suite — examples serve as manual integration tests.

## API Key Resolution

`lib/utils.js:getApiKey()` resolves the key in this priority order:
1. `SHODAN_API_KEY` environment variable
2. `~/.shodan/key` file (plain text)
3. `~/.openclaw/workspace/TOOLS.md` (parses `SHODAN_API_KEY: value` pattern)

## Architecture

This is a Node.js library (not a CLI) wrapping the Shodan.io REST API. The entry point is `lib/shodan-client.js` which exports `ShodanClient`. `lib/index.js` re-exports it with a `createClient` factory helper.

### Module Responsibilities

| Module | Role |
|---|---|
| `lib/shodan-client.js` | Central class; composes all modules; exposes the full public API |
| `lib/search.js` | Low-level Shodan search/host/count/scan API calls |
| `lib/dns.js` | DNS forward/reverse/domain lookups |
| `lib/cache.js` | File-based cache with SHA-256 keyed JSON files at `~/.openclaw/workspace/.shodan-cache/` |
| `lib/exporter.js` | Export results to JSON/CSV/Markdown at `~/.openclaw/workspace/shodan-exports/` |
| `lib/analysis.js` | Pure functions: threat scoring, filtering, infrastructure mapping, anomaly detection |
| `lib/workflows.js` | High-level orchestration chaining search → host lookup → DNS enrichment → export |
| `lib/domain-enumeration.js` | Subdomain discovery via crt.sh, SecurityTrails, GitHub API, and optional CLI tools (subfinder, findomain, amass, assetfinder) |
| `lib/utils.js` | `getApiKey()`, `formatResponse()`, `formatError()` shared by all modules |

### Response Shape

All async methods return a uniform envelope:
```javascript
{ success: boolean, method, query, results, metadata: { timestamp, creditsUsed, cached } }
// On error: { success: false, method, query, error: string, metadata }
```

### Threat Scoring

Hosts are scored 0–100 in `lib/workflows.js:calculateThreatScore()` and categorized by `lib/analysis.js:categorizeScore()`:
- CRITICAL ≥ 70, HIGH ≥ 50, MEDIUM ≥ 30, LOW ≥ 10, MINIMAL < 10
- Score factors: open ports (5 pts each, max 30), critical services (10 pts each, max 25), CVEs (8 pts each, max 30), data points (2 pts each, max 15)

### Caching

- File-based, stored in `~/.openclaw/workspace/.shodan-cache/` as SHA-256-named JSON files
- Default TTL: 24 hours
- Cache bypass: pass `false` as third argument to `search()` / `host()`, or call `shodan.setCaching(false)`
- Analysis methods (`filterResults`, `rankByThreat`, etc.) are synchronous and never cached

### Domain Enumeration

`DomainEnumeration` gracefully degrades — it detects installed CLI tools at construction time and skips missing ones. `crt.sh` is always available (no key required). `SecurityTrails` requires `SECURITYTRAILS_API_KEY` and `GitHub` requires `GITHUB_TOKEN`.
