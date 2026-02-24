/**
 * Agent Workflows Example
 * Demonstrates how the recon agent can use high-level workflows and analysis tools
 */

const ShodanClient = require('../lib/shodan-client');

async function main() {
  // Initialize client
  const shodan = new ShodanClient();

  console.log('🔍 SHODAN RECON AGENT - WORKFLOW EXAMPLES\n');

  // ====== EXAMPLE 1: Full Reconnaissance Workflow ======
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 EXAMPLE 1: Full Recon Workflow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const recon = await shodan.fullReconWorkflow('product:nginx', {
      maxHosts: 15,
      exportFormats: ['json', 'markdown'],
      enrichDns: true,
      threatThreshold: 10,
    });

    if (recon.success) {
      console.log('✅ Workflow Complete!\n');
      console.log(`📊 Summary:`);
      console.log(`   Total matches: ${recon.data.summary.totalHosts}`);
      console.log(`   Processed: ${recon.data.summary.processed}`);
      console.log(`   Exported: ${recon.data.summary.exported} files`);
      console.log(`   Credits used: ${recon.data.summary.creditsUsed}`);
      console.log(`   Time: ${recon.data.summary.executionTime}`);

      if (recon.data.errors.length > 0) {
        console.log(`\n⚠️ Errors:`);
        recon.data.errors.forEach(err => console.log(`   - ${err}`));
      }

      // Get host details for next step
      const hostDetails = recon.data.stages.hostLookup;
      console.log(`\n📈 Host Lookup Results:`);
      console.log(`   Processed: ${hostDetails.processed}`);
      console.log(`   Successful: ${hostDetails.successful}`);
      console.log(`   Credits used: ${hostDetails.creditsUsed}`);
    } else {
      console.log(`❌ Workflow failed: ${recon.error}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // ====== EXAMPLE 2: Search and Export ======
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 EXAMPLE 2: Quick Search & Export');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const searchResult = await shodan.searchAndExport('port:22 ssh', ['csv', 'json']);

    if (searchResult.success) {
      console.log(`✅ Search & Export Complete!`);
      console.log(`   Total matches: ${searchResult.data.totalMatches}`);
      console.log(`   Results exported: ${searchResult.data.resultsExported}`);
      console.log(`   Exported files:`);
      searchResult.data.exports.forEach(exp => {
        console.log(`     - ${exp.format.toUpperCase()}: ${exp.file}`);
      });
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // ====== EXAMPLE 3: DNS Batch Operations ======
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 EXAMPLE 3: Batch DNS Operations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example IPs for reverse lookup
  const ipsToReverse = ['8.8.8.8', '1.1.1.1', '208.67.222.222'];

  try {
    const reverseDns = await shodan.reverseDnsBatch(ipsToReverse);

    if (reverseDns.success) {
      console.log(`✅ Reverse DNS Results:`);
      Object.entries(reverseDns.data.mappings).forEach(([ip, hostname]) => {
        console.log(`   ${ip} → ${hostname}`);
      });
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // Example hostnames for forward resolution
  const hostnamesToResolve = ['google.com', 'github.com', 'example.com'];

  try {
    const dnsResolve = await shodan.dnsResolveBatch(hostnamesToResolve);

    if (dnsResolve.success) {
      console.log(`\n✅ DNS Resolution Results:`);
      Object.entries(dnsResolve.data.mappings).forEach(([hostname, ip]) => {
        console.log(`   ${hostname} → ${ip}`);
      });
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // ====== EXAMPLE 4: Result Analysis ======
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 EXAMPLE 4: Analyzing Search Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // First, get some results
    const searchResult = await shodan.search('product:nginx country:US', {
      minify: true,
    });

    if (searchResult.success && searchResult.data.results.length > 0) {
      // Enrich with threat scores
      const results = await Promise.all(
        searchResult.data.results.slice(0, 10).map(host =>
          shodan.host(host.ip).then(r => r.data)
        )
      );

      console.log(`\n📊 Analyzing ${results.length} hosts...\n`);

      // 1. Full analysis
      const fullAnalysis = shodan.analyzeResults(results);
      if (fullAnalysis.success) {
        const report = fullAnalysis.data;
        console.log(`📈 Analysis Report:`);
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

        console.log(`\n   Vulnerability Stats:`);
        console.log(`     Hosts with vulns: ${report.vulnerabilityStats.hostsWithVulns}`);
        console.log(`     Total vulns: ${report.vulnerabilityStats.totalVulns}`);
        console.log(`     Critical vulns: ${report.vulnerabilityStats.criticalVulns}`);

        console.log(`\n   Key Insights:`);
        report.insights.forEach(insight => {
          console.log(`     • ${insight}`);
        });
      }

      // 2. Rank by threat
      console.log(`\n🎯 Top Threat Hosts:`);
      const topThreats = shodan.rankByThreat(results, 5);
      topThreats.forEach(host => {
        console.log(`   #${host.rank} [${host.riskLevel}] ${host.ip} (Score: ${host.threatScore})`);
        console.log(`       Services: ${host.services.join(', ')}`);
        console.log(`       Vulnerabilities: ${host.vulns}`);
      });

      // 3. Filter by criteria
      console.log(`\n🔎 Filtering by criteria...`);
      const filtered = shodan.filterResults(results, {
        minThreatScore: 50,
        hasVulns: true,
      });
      console.log(`   Found ${filtered.length} hosts with threat score ≥50 and known vulns`);

      // 4. Infrastructure mapping
      console.log(`\n🌐 Infrastructure Map:`);
      const map = shodan.mapInfrastructure(results);
      if (map.success) {
        const mapData = map.data;
        console.log(`   Nodes: ${mapData.summary.totalNodes}`);
        console.log(`   Clusters (orgs): ${mapData.summary.totalClusters}`);
        console.log(`\n   Organization Distribution:`);
        Object.entries(mapData.clusters).forEach(([org, ips]) => {
          console.log(`     ${org}: ${ips.length} hosts`);
        });
      }

      // 5. Find anomalies
      console.log(`\n⚠️ Anomalies & Patterns:`);
      const anomalies = shodan.findAnomalies(results);
      if (anomalies.length === 0) {
        console.log('   No anomalies detected');
      } else {
        anomalies.forEach(anom => {
          console.log(`   [${anom.severity}] ${anom.type}`);
          console.log(`      ${anom.description}`);
        });
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  console.log('\n✅ All examples complete!');
}

main().catch(console.error);
