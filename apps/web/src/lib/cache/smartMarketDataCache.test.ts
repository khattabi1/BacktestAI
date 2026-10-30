import { SmartMarketDataCacheManager, TimeInterval } from './smartMarketDataCache';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

async function runTests() {
  console.log('--- Testing SmartMarketDataCacheManager Interval Math ---');
  const cache = new SmartMarketDataCacheManager();

  // Test 1: Empty cache returns full requested range
  const gaps1 = cache.getMissingIntervals('XAUUSD:1h', 1000, 2000);
  assert(gaps1.length === 1 && gaps1[0].start === 1000 && gaps1[0].end === 2000, 'Test 1 Failed');
  console.log('✓ Test 1 Passed: Empty cache returns full range');

  // Test 2: 100% Cache Hit returns zero missing gaps
  (cache as any).intervals.set('XAUUSD:1h', [{ start: 1000, end: 2000 }]);
  const gaps2 = cache.getMissingIntervals('XAUUSD:1h', 1200, 1800);
  assert(gaps2.length === 0, 'Test 2 Failed');
  console.log('✓ Test 2 Passed: Sub-slice returns 0 missing gaps (100% Cache Hit)');

  // Test 3: Right expansion: Cached [2023-2024], Request [2023-2025] -> Missing ONLY [2024-2025]
  const t2023 = 1672531200;
  const t2024 = 1704067200;
  const t2025 = 1735689600;
  (cache as any).intervals.set('XAUUSD:1h', [{ start: t2023, end: t2024 }]);
  const gaps3 = cache.getMissingIntervals('XAUUSD:1h', t2023, t2025);
  assert(gaps3.length === 1 && gaps3[0].start === t2024 && gaps3[0].end === t2025, 'Test 3 Failed');
  console.log('✓ Test 3 Passed: [2023-2025] with cached [2023-2024] requests ONLY [2024-2025]');

  // Test 4: Left and Right expansion: Cached [2023-2024], Request [2022-2025]
  const t2022 = 1640995200;
  const gaps4 = cache.getMissingIntervals('XAUUSD:1h', t2022, t2025);
  assert(gaps4.length === 2, 'Test 4 Failed length');
  assert(gaps4[0].start === t2022 && gaps4[0].end === t2023, 'Test 4 left gap failed');
  assert(gaps4[1].start === t2024 && gaps4[1].end === t2025, 'Test 4 right gap failed');
  console.log('✓ Test 4 Passed: Gap differencing detects both left and right missing intervals');

  // Test 5: End-to-end getBars with mock fetcher
  const fetcherCalls: TimeInterval[] = [];
  const mockFetcher = async (sym: string, tf: string, s: number, e: number) => {
    fetcherCalls.push({ start: s, end: e });
    return [
      { time: s, open: 100, high: 105, low: 95, close: 102 },
      { time: e, open: 102, high: 106, low: 101, close: 105 },
    ];
  };

  cache.clear();
  // Step 1: Initial fetch 1000 - 2000
  const b1 = await cache.getBars('XAUUSD', '1h', 1000, 2000, mockFetcher);
  assert(fetcherCalls.length === 1, 'Mock fetcher call count step 1');
  assert(b1.length > 0, 'b1 has bars');
  console.log('✓ Test 5.1 Passed: Initial fetch populates cache');

  // Step 2: Sub-slice 1200 - 1800 (0 network calls)
  fetcherCalls.length = 0;
  const b2 = await cache.getBars('XAUUSD', '1h', 1200, 1800, mockFetcher);
  assert(fetcherCalls.length === 0, 'Sub-slice must trigger 0 network calls');
  console.log('✓ Test 5.2 Passed: Sub-slice makes 0 network calls (Instant 0ms Cache Hit)');

  // Step 3: Expanded fetch 1000 - 3000 (Fetches ONLY 2000 - 3000)
  fetcherCalls.length = 0;
  const b3 = await cache.getBars('XAUUSD', '1h', 1000, 3000, mockFetcher);
  assert(fetcherCalls.length === 1 && fetcherCalls[0].start === 2000 && fetcherCalls[0].end === 3000, 'Step 3 must fetch only missing gap');
  console.log('✓ Test 5.3 Passed: Expanded fetch fetches strictly the missing gap [2000-3000]');

  console.log('\n[ALL TESTS PASSED SUCCESSFULLY]');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
