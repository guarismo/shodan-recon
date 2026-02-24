/**
 * Example: Using Shodan Search Methods
 * Run: SHODAN_API_KEY=your_key node examples/search-example.js
 */

const ShodanClient = require('../lib/shodan-client');

async function runExamples() {
  console.log('🔍 Shodan Search Examples\n');

  try {
    const shodan = new ShodanClient();

    // Example 1: Check account and credits first
    console.log('1️⃣  Checking account and remaining credits...');
    const account = await shodan.account();

    if (account.success) {
      console.log(`   Credits remaining: ${account.results.credits}`);
      console.log(`   Display name: ${account.results.display_name}`);
    } else {
      console.error(`   Error: ${account.error}`);
      throw new Error('Cannot continue without valid API key');
    }

    // Example 2: Count results before searching (uses 0 credits)
    console.log('\n2️⃣  Counting Nginx servers in the US (free)...');
    const nginxCount = await shodan.count('product:nginx country:US');

    if (nginxCount.success) {
      console.log(`   Total matches: ${nginxCount.results.total}`);
    } else {
      console.error(`   Error: ${nginxCount.error}`);
    }

    // Example 3: Search with facets
    console.log('\n3️⃣  Searching for Nginx servers with facets...');
    const nginxSearch = await shodan.search('product:nginx country:US', {
      facets: 'org:10,port:10',
      page: 1,
    });

    if (nginxSearch.success) {
      console.log(`   Found: ${nginxSearch.results.total} results`);
      if (nginxSearch.results.facets?.org) {
        console.log(`   Top orgs:`);
        nginxSearch.results.facets.org.slice(0, 3).forEach(org => {
          console.log(`     - ${org.value}: ${org.count}`);
        });
      }
      if (nginxSearch.results.matches && nginxSearch.results.matches.length > 0) {
        const first = nginxSearch.results.matches[0];
        console.log(`   First match: ${first.ip_str}:${first.port}`);
      }
    } else {
      console.error(`   Error: ${nginxSearch.error}`);
    }

    // Example 4: Get host details for a known IP
    console.log('\n4️⃣  Getting host details for 8.8.8.8...');
    const hostDetails = await shodan.host('8.8.8.8');

    if (hostDetails.success) {
      console.log(`   Country: ${hostDetails.results.country_name}`);
      console.log(`   Organization: ${hostDetails.results.org}`);
      console.log(`   Open ports: ${hostDetails.results.ports?.join(', ') || 'N/A'}`);
    } else {
      console.error(`   Error: ${hostDetails.error}`);
    }

    // Example 5: Check your external IP
    console.log('\n5️⃣  Getting your external IP as seen by Shodan...');
    const myIp = await shodan.myIp();

    if (myIp.success) {
      console.log(`   Your IP: ${myIp.results}`);
    } else {
      console.error(`   Error: ${myIp.error}`);
    }

    // Example 6: Get available ports
    console.log('\n6️⃣  Getting list of ports Shodan crawls...');
    const portsList = await shodan.ports();

    if (portsList.success) {
      console.log(`   Total ports: ${portsList.results.length}`);
      console.log(`   Sample ports: ${portsList.results.slice(0, 10).join(', ')}`);
    } else {
      console.error(`   Error: ${portsList.error}`);
    }

    // Example 7: Get available protocols
    console.log('\n7️⃣  Getting list of protocols Shodan uses...');
    const protocolsList = await shodan.protocols();

    if (protocolsList.success) {
      const protocols = protocolsList.results || {};
      const count = Object.keys(protocols).length;
      console.log(`   Total protocols: ${count}`);
      console.log(`   Sample: ${Object.keys(protocols).slice(0, 5).join(', ')}`);
    } else {
      console.error(`   Error: ${protocolsList.error}`);
    }

    console.log('\n✅ Examples completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure SHODAN_API_KEY is set:');
    console.log('  export SHODAN_API_KEY=your_api_key');
    console.log('  npm install');
    console.log('  node examples/search-example.js');
  }
}

runExamples();
