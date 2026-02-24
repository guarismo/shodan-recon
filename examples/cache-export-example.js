/**
 * Example: Caching and Exporting Results
 * Demonstrates how to save API credits by caching queries and exporting results
 * Run: SHODAN_API_KEY=your_key node examples/cache-export-example.js
 */

const ShodanClient = require('../lib/shodan-client');

async function runExample() {
  console.log('💾 Shodan Cache & Export Example\n');

  try {
    const shodan = new ShodanClient();

    // Example 1: First search (uses 1 credit)
    console.log('1️⃣  First search for Nginx (uses 1 credit)...');
    const search1 = await shodan.search('product:nginx country:US', {
      facets: 'org:5,port:5',
      page: 1,
    });

    if (search1.success) {
      console.log(`   ✅ Found: ${search1.results.total} results`);
      console.log(`   Credits used: ${search1.metadata.creditsUsed}`);
      console.log(`   Cached: ${search1.metadata.cached}`);
    } else {
      console.error(`   Error: ${search1.error}`);
    }

    // Example 2: Same search again (uses 0 credits - served from cache!)
    console.log('\n2️⃣  Same search again (should be cached)...');
    const search2 = await shodan.search('product:nginx country:US', {
      facets: 'org:5,port:5',
      page: 1,
    });

    if (search2.success) {
      console.log(`   ✅ Found: ${search2.results.total} results`);
      console.log(`   Credits used: ${search2.metadata.creditsUsed}`);
      console.log(`   Cached: ${search2.metadata.cached}`);
      if (search2.metadata.cached) {
        console.log(`   💰 Saved 1 credit! Age: ${search2.metadata._cacheAge}s`);
      }
    } else {
      console.error(`   Error: ${search2.error}`);
    }

    // Example 3: Different search (uses 1 credit)
    console.log('\n3️⃣  Different search for Apache...');
    const search3 = await shodan.search('product:apache', {
      facets: 'country:5',
      page: 1,
    });

    if (search3.success) {
      console.log(`   ✅ Found: ${search3.results.total} results`);
      console.log(`   Credits used: ${search3.metadata.creditsUsed}`);
      console.log(`   Cached: ${search3.metadata.cached}`);
    } else {
      console.error(`   Error: ${search3.error}`);
    }

    // Example 4: Cache statistics
    console.log('\n4️⃣  Cache statistics...');
    const cacheStats = shodan.getCacheStats();
    console.log(`   Valid entries: ${cacheStats.validEntries}`);
    console.log(`   Total cache size: ${cacheStats.totalSizeMB} MB`);
    console.log(`   Cache directory: ${cacheStats.cacheDir}`);

    // Example 5: List cached entries
    console.log('\n5️⃣  Cached queries...');
    const cachedQueries = shodan.listCache();
    cachedQueries.slice(0, 5).forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.method}: ${JSON.stringify(entry.params)}`);
    });

    // Example 6: Export results
    console.log('\n6️⃣  Exporting search results...');
    const exports = shodan.export('product:nginx country:US', search1.results, [
      'json',
      'csv',
      'markdown',
    ]);

    exports.forEach(exp => {
      if (exp.success) {
        console.log(`   ✅ ${exp.format.toUpperCase()}: ${exp.file}`);
        console.log(`      Size: ${exp.size} bytes`);
        if (exp.rows) console.log(`      Rows: ${exp.rows}`);
      } else {
        console.log(`   ❌ ${exp.format.toUpperCase()}: ${exp.error}`);
      }
    });

    // Example 7: List exports
    console.log('\n7️⃣  Exported files...');
    const exportList = shodan.listExports();
    console.log(`   Total exports: ${exportList.count}`);
    console.log(`   Export directory: ${exportList.exportDir}`);
    exportList.files.slice(0, 3).forEach(file => {
      console.log(`   - ${file.file} (${file.size} bytes)`);
    });

    // Summary
    console.log('\n📊 Summary');
    console.log('   💾 Caching: Saves credits on repeated queries');
    console.log('   📄 Export: JSON, CSV, Markdown formats');
    console.log('   🔍 Cache TTL: 24 hours (customizable)');

    console.log('\n✅ Cache & Export example completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure SHODAN_API_KEY is set:');
    console.log('  export SHODAN_API_KEY=your_api_key');
    console.log('  npm install');
    console.log('  node examples/cache-export-example.js');
  }
}

runExample();
