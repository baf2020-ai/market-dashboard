/**
 * fetch-assets.mjs
 *
 * 금(XAU) 및 비트코인(BTC) 시세를 수집하여
 * src/data/assets.json에 저장한다.
 *
 * 데이터 소스: yahoo-finance2
 * 출력 스키마: gold-bitcoin-prices.design.md 2절 참조
 */

import yahooFinance from 'yahoo-finance2';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeJSON, readJSON } from './utils/file-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'assets.json');

// --- 설정 ---

const ASSET_CONFIGS = [
  { symbol: 'GC=F', name: 'Gold', displayName: '금 (XAU)', currency: 'USD', unit: 'oz' },
  { symbol: 'BTC-USD', name: 'Bitcoin', displayName: '비트코인 (BTC)', currency: 'USD', unit: 'BTC' },
];

// yahoo-finance2 경고 억제
yahooFinance.suppressNotices(['yahooSurvey']);

// --- 메인 ---

async function main() {
  console.log('=== Asset Prices Fetch ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    console.log('\n[1/1] Fetching asset quotes...');
    const symbols = ASSET_CONFIGS.map((c) => c.symbol);
    const quotes = await yahooFinance.quote(symbols);
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    const assets = [];
    for (const config of ASSET_CONFIGS) {
      const quote = quotesArray.find((q) => q.symbol === config.symbol);
      if (quote && quote.regularMarketPrice != null) {
        assets.push(formatAsset(quote, config));
        console.log(`  ${config.displayName}: $${roundNum(quote.regularMarketPrice)}`);
      } else {
        console.warn(`  ${config.displayName}: quote not available, skipping`);
      }
    }

    if (assets.length === 0) {
      throw new Error('No asset data collected');
    }

    const result = {
      fetchedAt: new Date().toISOString(),
      assets,
    };

    const writeResult = await writeJSON(OUTPUT_PATH, result);

    console.log('\n=== Summary ===');
    console.log(`Assets collected: ${assets.length}/${ASSET_CONFIGS.length}`);
    console.log(`Output: ${OUTPUT_PATH}`);
    console.log(`Write status: ${writeResult.success ? 'OK' : 'FAILED'}`);

    if (!writeResult.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n[FATAL] ${error.message}`);

    const existing = await readJSON(OUTPUT_PATH);
    if (existing) {
      console.log('Existing data preserved.');
    } else {
      console.warn('No existing data file found.');
    }

    process.exit(1);
  }
}

// --- 변환 ---

function formatAsset(quote, config) {
  return {
    symbol: config.symbol,
    name: config.name,
    displayName: config.displayName,
    price: roundNum(quote.regularMarketPrice),
    change: roundNum(quote.regularMarketChange),
    changePercent: roundNum(quote.regularMarketChangePercent),
    dayHigh: roundNum(quote.regularMarketDayHigh),
    dayLow: roundNum(quote.regularMarketDayLow),
    currency: config.currency,
    unit: config.unit,
  };
}

function roundNum(value) {
  if (value == null || isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

// --- 실행 ---
main();
