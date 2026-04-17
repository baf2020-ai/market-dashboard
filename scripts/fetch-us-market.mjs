/**
 * fetch-us-market.mjs
 *
 * US 주요 지수(S&P 500, NASDAQ, DOW)와 상승/하락 상위 종목을 수집하여
 * src/data/us-market.json에 저장한다.
 *
 * 데이터 소스: yahoo-finance2
 * 출력 스키마: 01_architecture.md 3.1절 참조
 */

import yahooFinance from 'yahoo-finance2';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeJSON, readJSON } from './utils/file-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'us-market.json');

// --- 설정 ---

const INDEX_SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'NASDAQ Composite' },
  { symbol: '^DJI', name: 'Dow Jones Industrial Average' },
];

// 주요 대형주 워치리스트 (movers 후보 풀)
const WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'UNH', 'JNJ', 'JPM', 'V', 'PG', 'XOM', 'HD', 'MA', 'AVGO', 'CVX',
  'MRK', 'ABBV', 'KO', 'PEP', 'COST', 'LLY', 'WMT', 'TMO', 'MCD',
  'CRM', 'CSCO', 'ACN', 'AMD', 'NFLX', 'INTC', 'ORCL', 'DIS',
  'BA', 'NKE', 'PYPL', 'QCOM', 'TXN',
];

const MOVERS_COUNT = 5;

// yahoo-finance2 경고 억제
yahooFinance.suppressNotices(['yahooSurvey']);

// --- 메인 ---

async function main() {
  console.log('=== US Market Data Fetch ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // 1) 지수 데이터 수집
    console.log('\n[1/3] Fetching index data...');
    const indices = await fetchIndices();
    console.log(`  Fetched ${indices.length} indices`);

    // 2) 워치리스트 종목 데이터 수집
    console.log('\n[2/3] Fetching watchlist quotes...');
    const watchlistQuotes = await fetchWatchlistQuotes();
    console.log(`  Fetched ${watchlistQuotes.length} stock quotes`);

    // 3) 상승/하락 상위 종목 추출
    console.log('\n[3/3] Computing top movers...');
    const movers = computeMovers(watchlistQuotes);
    console.log(`  Gainers: ${movers.gainers.length}, Losers: ${movers.losers.length}`);

    // 결과 조립
    const result = {
      fetchedAt: new Date().toISOString(),
      indices,
      movers,
    };

    // 저장
    const writeResult = await writeJSON(OUTPUT_PATH, result);

    // 요약 로그
    console.log('\n=== Summary ===');
    console.log(`Indices: ${indices.map((i) => `${i.name}: ${i.price}`).join(', ')}`);
    console.log(`Top Gainer: ${movers.gainers[0]?.symbol ?? 'N/A'} (${movers.gainers[0]?.changePercent ?? 0}%)`);
    console.log(`Top Loser: ${movers.losers[0]?.symbol ?? 'N/A'} (${movers.losers[0]?.changePercent ?? 0}%)`);
    console.log(`Output: ${OUTPUT_PATH}`);
    console.log(`Write status: ${writeResult.success ? 'OK' : 'FAILED'}`);

    if (!writeResult.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n[FATAL] ${error.message}`);

    // 기존 데이터 유지 확인
    const existing = await readJSON(OUTPUT_PATH);
    if (existing) {
      console.log('Existing data preserved.');
    } else {
      console.warn('No existing data file found.');
    }

    process.exit(1);
  }
}

// --- 데이터 수집 함수 ---

/**
 * 주요 지수 데이터를 수집한다.
 * @returns {Promise<Array>} 설계서 스키마에 맞는 indices 배열
 */
async function fetchIndices() {
  const symbols = INDEX_SYMBOLS.map((i) => i.symbol);
  const quotes = await yahooFinance.quote(symbols);

  // quote()가 단일 객체를 반환할 수 있으므로 배열로 정규화
  const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

  return quotesArray.map((q) => {
    const config = INDEX_SYMBOLS.find((i) => i.symbol === q.symbol);
    return {
      symbol: q.symbol,
      name: config?.name ?? q.shortName ?? q.longName ?? q.symbol,
      price: roundNum(q.regularMarketPrice),
      change: roundNum(q.regularMarketChange),
      changePercent: roundNum(q.regularMarketChangePercent),
      previousClose: roundNum(q.regularMarketPreviousClose),
      dayHigh: roundNum(q.regularMarketDayHigh),
      dayLow: roundNum(q.regularMarketDayLow),
    };
  });
}

/**
 * 워치리스트 종목의 시세를 일괄 조회한다.
 * @returns {Promise<Array>} 종목 시세 배열
 */
async function fetchWatchlistQuotes() {
  const results = [];

  // Rate limit 고려: 20개씩 배치 처리
  const batchSize = 20;
  for (let i = 0; i < WATCHLIST.length; i += batchSize) {
    const batch = WATCHLIST.slice(i, i + batchSize);

    try {
      const quotes = await yahooFinance.quote(batch);
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of quotesArray) {
        if (q && q.regularMarketPrice != null) {
          results.push({
            symbol: q.symbol,
            name: q.shortName ?? q.longName ?? q.symbol,
            price: roundNum(q.regularMarketPrice),
            change: roundNum(q.regularMarketChange),
            changePercent: roundNum(q.regularMarketChangePercent),
            volume: q.regularMarketVolume ?? 0,
          });
        }
      }
    } catch (error) {
      console.warn(`  Batch fetch failed for [${batch.join(', ')}]: ${error.message}`);
    }

    // 배치 간 딜레이
    if (i + batchSize < WATCHLIST.length) {
      await delay(500);
    }
  }

  return results;
}

/**
 * 워치리스트 시세에서 상승/하락 상위 종목을 추출한다.
 * @param {Array} quotes - 종목 시세 배열
 * @returns {{ gainers: Array, losers: Array }}
 */
function computeMovers(quotes) {
  const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);

  const gainers = sorted
    .filter((q) => q.changePercent > 0)
    .slice(0, MOVERS_COUNT);

  const losers = sorted
    .filter((q) => q.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, MOVERS_COUNT);

  return { gainers, losers };
}

// --- 유틸 ---

function roundNum(value) {
  if (value == null || isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 실행 ---
main();
