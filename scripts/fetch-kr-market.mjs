/**
 * fetch-kr-market.mjs
 *
 * KR 시장 데이터(KOSPI/KOSDAQ 지수, 거래량 상위, 등락 상위/하위 종목)를
 * 네이버 금융 비공식 API에서 수집하여 src/data/kr-market.json에 저장한다.
 *
 * 데이터 소스: 네이버 금융 (m.stock.naver.com)
 * 출력 스키마: 01_architecture.md 3.3절 참조
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchJSON, sleep } from './utils/api-client.mjs';
import { writeJSON, readJSON } from './utils/file-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'kr-market.json');

// --- 설정 ---

const NAVER_BASE = 'https://m.stock.naver.com/api';

const NAVER_HEADERS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://m.stock.naver.com/',
  },
};

const STOCK_LIST_SIZE = 10;

// --- 메인 ---

async function main() {
  console.log('=== KR Market Data Fetch ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // 1) 지수 데이터 수집
    console.log('\n[1/4] Fetching KOSPI/KOSDAQ indices...');
    const indices = await fetchIndices();
    console.log(`  Fetched ${indices.length} indices`);

    await sleep(300);

    // 2) 거래량 상위 종목
    console.log('\n[2/4] Fetching top volume stocks...');
    const topVolume = await fetchStockList('volume', 'KOSPI');
    console.log(`  Fetched ${topVolume.length} stocks`);

    await sleep(300);

    // 3) 상승 상위 종목
    console.log('\n[3/4] Fetching top gainers...');
    const topGainers = await fetchStockList('up', 'KOSPI');
    console.log(`  Fetched ${topGainers.length} stocks`);

    await sleep(300);

    // 4) 하락 상위 종목
    console.log('\n[4/4] Fetching top losers...');
    const topLosers = await fetchStockList('down', 'KOSPI');
    console.log(`  Fetched ${topLosers.length} stocks`);

    // 결과 조립
    const result = {
      fetchedAt: new Date().toISOString(),
      indices,
      topVolume,
      topGainers,
      topLosers,
    };

    // 저장
    const writeResult = await writeJSON(OUTPUT_PATH, result);

    // 요약 로그
    console.log('\n=== Summary ===');
    for (const idx of indices) {
      const sign = idx.change >= 0 ? '+' : '';
      console.log(`  ${idx.name}: ${idx.price} (${sign}${idx.changePercent}%)`);
    }
    console.log(`  Top Volume: ${topVolume.length} stocks`);
    console.log(`  Top Gainers: ${topGainers.length} stocks`);
    console.log(`  Top Losers: ${topLosers.length} stocks`);
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

// --- 데이터 수집 함수 ---

/**
 * KOSPI/KOSDAQ 지수 데이터를 수집한다.
 * @returns {Promise<Array>} 설계서 스키마에 맞는 indices 배열
 */
async function fetchIndices() {
  const indexSymbols = ['KOSPI', 'KOSDAQ'];
  const indices = [];

  for (const symbol of indexSymbols) {
    try {
      const url = `${NAVER_BASE}/index/${symbol}/basic`;
      const data = await fetchJSON(url, NAVER_HEADERS);

      indices.push(parseIndexData(symbol, data));
    } catch (error) {
      console.warn(`  Failed to fetch ${symbol}: ${error.message}`);
      // null 필드로 채워서 스키마 유지
      indices.push(createEmptyIndex(symbol));
    }

    await sleep(200);
  }

  return indices;
}

/**
 * 네이버 금융 지수 API 응답을 설계서 스키마로 변환한다.
 * @param {string} symbol - KOSPI 또는 KOSDAQ
 * @param {object} data - 네이버 API 응답
 * @returns {object}
 */
function parseIndexData(symbol, data) {
  // 네이버 API 응답 구조 적응: 다양한 필드명 변형에 대응
  const nameMap = { KOSPI: '코스피', KOSDAQ: '코스닥' };

  const price = parseNum(data.closePrice ?? data.nowVal ?? data.marketPrice);
  const change = parseNum(data.compareToPreviousClosePrice ?? data.changeVal ?? data.change);
  const changePercent = parseNum(
    data.compareToPreviousPrice?.rate ??
    data.fluctuationsRatio ??
    data.changeRate ??
    data.changePct
  );
  const previousClose = parseNum(data.previousClosePrice ?? data.prevVal);
  const dayHigh = parseNum(data.highPrice ?? data.highVal);
  const dayLow = parseNum(data.lowPrice ?? data.lowVal);
  const volume = parseNum(data.accumulatedTradingVolume ?? data.accTrdVol);
  const tradingValue = parseNum(data.accumulatedTradingValue ?? data.accTrdVal);

  return {
    symbol,
    name: nameMap[symbol] ?? symbol,
    price,
    change,
    changePercent,
    previousClose,
    dayHigh,
    dayLow,
    volume,
    tradingValue,
  };
}

/**
 * API 실패 시 빈 지수 데이터를 반환한다.
 * @param {string} symbol
 * @returns {object}
 */
function createEmptyIndex(symbol) {
  const nameMap = { KOSPI: '코스피', KOSDAQ: '코스닥' };
  return {
    symbol,
    name: nameMap[symbol] ?? symbol,
    price: null,
    change: null,
    changePercent: null,
    previousClose: null,
    dayHigh: null,
    dayLow: null,
    volume: null,
    tradingValue: null,
  };
}

/**
 * 종목 리스트를 수집한다 (거래량/상승/하락).
 * @param {'volume'|'up'|'down'} type - 종목 리스트 유형
 * @param {'KOSPI'|'KOSDAQ'} market - 시장
 * @returns {Promise<Array>} 설계서 스키마에 맞는 종목 배열
 */
async function fetchStockList(type, market) {
  // 네이버 금융 엔드포인트: /api/stocks/{type}?market={market}&pageSize={n}
  const url = `${NAVER_BASE}/stocks/${type}?market=${market}&pageSize=${STOCK_LIST_SIZE}`;

  try {
    const data = await fetchJSON(url, NAVER_HEADERS);

    // 네이버 API 응답은 배열이거나 { stocks: [...] } 형태
    const stocks = Array.isArray(data) ? data : (data.stocks ?? data.datas ?? data.data ?? []);

    return stocks.map(parseStockItem).filter(Boolean);
  } catch (error) {
    console.warn(`  Failed to fetch ${type} stocks: ${error.message}`);
    return [];
  }
}

/**
 * 네이버 금융 종목 데이터를 설계서 스키마로 변환한다.
 * @param {object} item - 네이버 API 종목 객체
 * @returns {object|null}
 */
function parseStockItem(item) {
  if (!item) return null;

  const symbol = item.itemCode ?? item.code ?? item.stockCode ?? '';
  const name = item.stockName ?? item.itemName ?? item.name ?? '';

  if (!symbol && !name) return null;

  return {
    symbol,
    name,
    price: parseNum(item.closePrice ?? item.nowVal ?? item.price),
    change: parseNum(
      item.compareToPreviousClosePrice ?? item.changeVal ?? item.change
    ),
    changePercent: parseNum(
      item.fluctuationsRatio ?? item.changeRate ?? item.changePct
    ),
    volume: parseNum(item.accumulatedTradingVolume ?? item.accTrdVol ?? item.volume),
  };
}

// --- 유틸 ---

/**
 * 문자열/숫자를 숫자로 파싱한다. 실패 시 null을 반환한다.
 * 네이버 금융은 숫자를 쉼표가 포함된 문자열로 반환할 수 있다.
 * @param {any} value
 * @returns {number|null}
 */
function parseNum(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value * 100) / 100;

  const cleaned = String(value).replace(/,/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

// --- 실행 ---
main();
