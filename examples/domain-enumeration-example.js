#!/usr/bin/env node

/**
 * Domain Enumeration Example
 * Stage 0: Discover all subdomains before hitting Shodan
 * 
 * Gracefully degrades - uses whatever tools are installed
 */

const ShodanClient = require('../lib/shodan-client');
const DomainEnumeration = require('../lib/domain-enumeration');

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Domain Enumeration → Shodan Reconnaissance Pipeline      ║
║  Comprehensive subdomain discovery + Shodan analysis      ║
╚════════════════════════════════════════════════════════════╝
`);

  const targetDomain = process.argv[2] || 'example.com';

  // ====== STAGE 0: Domain Enumeration ======
  console.log(`\n📋 STAGE 0: Domain Enumeration`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const enumerator = new DomainEnumeration();

  try {
    const enumResults = await enumerator.enumerate(targetDomain, {
      useTools: true,
      useAPIs: true,
      outputFile: `./enum-${targetDomain}.txt`,
    });

    console.log(`\n✅ Enumeration Results:`);
    console.log(`   Total unique subdomains: ${enumResults.subdomains.length}`);
    console.log(`   Sources: ${Object.keys(enumResults.sources).join(', ')}`);

    if (enumResults.subdomains.length === 0) {
      console.log(`\n⚠️ No subdomains found. Falling back to direct domain search.`);
    } else {
      console.log(`\n📄 Sample subdomains:`);
      enumResults.subdomains.slice(0, 5).forEach(sub => {
        console.log(`   - ${sub}`);
      });
      if (enumResults.subdomains.length > 5) {
        console.log(`   ... and ${enumResults.subdomains.length - 5} more`);
      }
    }

    // ====== STAGE 1: Shodan Reconnaissance ======
    console.log(`\n\n📋 STAGE 1: Shodan Reconnaissance`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const shodan = new ShodanClient();

    // Build search queries from subdomains
    let searchQueries = [];
    if (enumResults.subdomains.length > 0) {
      // Create queries for top subdomains
      searchQueries = enumResults.subdomains.slice(0, 10).map(sub => `hostname:"${sub}"`);
      console.log(`\n🔍 Built ${searchQueries.length} queries from discovered subdomains`);
    } else {
      // Fallback to domain-based search
      searchQueries = [`domain:"${targetDomain}"`, `org:"${targetDomain}"`];
      console.log(`\n🔍 Using fallback queries for ${targetDomain}`);
    }

    const allHosts = [];
    let creditsUsed = 0;

    // Execute searches
    for (let i = 0; i < searchQueries.length && i < 5; i++) {
      const query = searchQueries[i];
      console.log(`\n  Searching: ${query}`);
      try {
        const result = await shodan.search(query, { minify: true });
        if (result.success) {
          allHosts.push(...result.data.results);
          creditsUsed += result.metadata.creditsUsed;
          console.log(`  ✓ ${result.data.results.length} hosts found`);
        }
      } catch (err) {
        console.log(`  ⚠️ Search failed: ${err.message}`);
      }
    }

    console.log(`\n✅ Search Results:`);
    console.log(`   Total hosts: ${allHosts.length}`);
    console.log(`   Credits used: ${creditsUsed}`);

    if (allHosts.length === 0) {
      console.log(`\n⚠️ No hosts found in Shodan`);
      return;
    }

    // ====== STAGE 2: Analysis ======
    console.log(`\n\n📋 STAGE 2: Analysis`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Get host details
    const hostsToAnalyze = allHosts.slice(0, 20);
    const hostDetails = [];

    console.log(`\n  Analyzing ${hostsToAnalyze.length} hosts...`);
    for (let i = 0; i < hostsToAnalyze.length; i++) {
      try {
        const detail = await shodan.host(hostsToAnalyze[i].ip);
        if (detail.success) {
          hostDetails.push(detail.data);
        }
      } catch (err) {
        // Silent fail
      }
    }

    console.log(`  ✓ Retrieved ${hostDetails.length} host details`);

    // Analysis
    const analysis = shodan.analyzeResults(hostDetails);
    if (analysis.success) {
      const report = analysis.data;
      console.log(`\n📊 Analysis Report:`);
      console.log(`   Total hosts: ${report.totalHosts}`);
      console.log(`\n   Threat Distribution:`);
      Object.entries(report.threatDistribution).forEach(([level, count]) => {
        console.log(`     ${level}: ${count}`);
      });

      console.log(`\n   Top Services:`);
      Object.entries(report.serviceDistribution)
        .slice(0, 5)
        .forEach(([service, count]) => {
          console.log(`     ${service}: ${count}`);
        });

      console.log(`\n   Key Insights:`);
      report.insights.forEach(insight => {
        console.log(`     • ${insight}`);
      });
    }

    // Top threats
    const topThreats = shodan.rankByThreat(hostDetails, 5);
    if (topThreats.length > 0) {
      console.log(`\n🚨 Top Threats:`);
      topThreats.forEach(threat => {
        console.log(`   #${threat.rank} [${threat.riskLevel}] ${threat.ip}`);
        console.log(`       Score: ${threat.threatScore}, Services: ${threat.services.slice(0, 3).join(', ')}`);
      });
    }

    // Anomalies
    const anomalies = shodan.findAnomalies(hostDetails);
    if (anomalies.length > 0) {
      console.log(`\n⚠️ Anomalies Detected:`);
      anomalies.slice(0, 3).forEach(anom => {
        console.log(`   [${anom.severity}] ${anom.type}: ${anom.description}`);
      });
    }

    console.log(`\n\n✅ Complete reconnaissance pipeline executed!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Stage 0 (Enumeration): ${enumResults.subdomains.length} subdomains`);
    console.log(`   Stage 1 (Shodan): ${allHosts.length} hosts (${hostDetails.length} analyzed)`);
    console.log(`   Stage 2 (Analysis): ${topThreats.length} critical threats, ${anomalies.length} anomalies`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

main();
