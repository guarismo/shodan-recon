/**
 * Example: Shodan DNS Methods
 * Run: SHODAN_API_KEY=your_key node examples/dns-example.js
 */

const ShodanClient = require('../lib/shodan-client');

async function runExamples() {
  console.log('🌐 Shodan DNS Examples\n');

  try {
    const shodan = new ShodanClient();

    // Example 1: Domain lookup - get all subdomains and DNS records
    console.log('1️⃣  Domain lookup - get subdomains (1 credit)');
    const domainResult = await shodan.dns.domain('google.com', {
      type: 'A'  // Optional: filter by DNS type
    });

    if (domainResult.success) {
      const data = domainResult.results || {};
      console.log(`   ✅ Subdomains: ${data.subdomains?.length || 0}`);
      console.log(`   ✅ DNS records: ${data.data?.length || 0}`);
      if (data.subdomains && data.subdomains.length > 0) {
        console.log(`   Samples: ${data.subdomains.slice(0, 5).join(', ')}`);
      }
    } else {
      console.error(`   ❌ Error: ${domainResult.error}`);
    }

    // Example 2: Resolve - simple hostname to IP
    console.log('\n2️⃣  Hostname resolution (resolve single)');
    const resolve1 = await shodan.dns.resolve('google.com');

    if (resolve1.success) {
      console.log(`   ✅ Results:`, resolve1.results);
    } else {
      console.error(`   ❌ Error: ${resolve1.error}`);
    }

    // Example 3: Resolve batch - multiple hostnames
    console.log('\n3️⃣  Hostname resolution (batch)');
    const resolveBatch = await shodan.dns.resolve(['google.com', 'facebook.com', 'github.com']);

    if (resolveBatch.success) {
      console.log(`   ✅ Resolved:`);
      Object.entries(resolveBatch.results || {}).forEach(([host, ip]) => {
        console.log(`     - ${host}: ${ip}`);
      });
    } else {
      console.error(`   ❌ Error: ${resolveBatch.error}`);
    }

    // Example 4: Reverse DNS - single IP
    console.log('\n4️⃣  Reverse DNS lookup (single IP)');
    const reverse1 = await shodan.dns.reverse('8.8.8.8');

    if (reverse1.success) {
      console.log(`   ✅ Results:`, reverse1.results);
    } else {
      console.error(`   ❌ Error: ${reverse1.error}`);
    }

    // Example 5: Reverse DNS - batch
    console.log('\n5️⃣  Reverse DNS lookup (batch)');
    const reverseBatch = await shodan.dns.reverse(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

    if (reverseBatch.success) {
      console.log(`   ✅ Resolved:`);
      Object.entries(reverseBatch.results || {}).forEach(([ip, domains]) => {
        const domainList = Array.isArray(domains) ? domains.join(', ') : domains;
        console.log(`     - ${ip}: ${domainList}`);
      });
    } else {
      console.error(`   ❌ Error: ${reverseBatch.error}`);
    }

    console.log('\n✅ DNS examples completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure SHODAN_API_KEY is set:');
    console.log('  export SHODAN_API_KEY=your_api_key');
    console.log('  npm install');
    console.log('  node examples/dns-example.js');
  }
}

runExamples();
