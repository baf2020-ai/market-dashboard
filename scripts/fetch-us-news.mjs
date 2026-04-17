/**
 * fetch-us-news.mjs
 *
 * US 금융 뉴스를 Finlight API v2로 수집하고
 * 한글 요약을 추가하여 src/data/us-news.json에 저장한다.
 *
 * 데이터 소스: Finlight API v2 (https://api.finlight.me/v2/articles)
 * 번역: google-translate-api-x (비공식 무료)
 */

import translate from 'google-translate-api-x';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeJSON, readJSON } from './utils/file-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'us-news.json');

// --- 설정 ---

const FINLIGHT_API_URL = 'https://api.finlight.me/v2/articles';
const FINLIGHT_API_KEY = process.env.FINLIGHT_API_KEY;

const MAX_ARTICLES = 15;
const MAX_SUMMARY_LENGTH = 200;

// --- 메인 ---

async function main() {
  console.log('=== US News Data Fetch ===');
  console.log(`Time: ${new Date().toISOString()}`);

  if (!FINLIGHT_API_KEY) {
    console.error('[FATAL] FINLIGHT_API_KEY is not set');
    const existing = await readJSON(OUTPUT_PATH);
    if (existing) console.log('Existing data preserved.');
    process.exit(1);
  }

  try {
    // 1. Finlight API로 뉴스 수집
    console.log('\n[1/3] Fetching news from Finlight API...');
    const articles = await fetchFinlightNews();
    console.log(`  Articles fetched: ${articles.length}`);

    if (articles.length === 0) {
      throw new Error('No articles returned from Finlight API');
    }

    // 2. 한글 번역
    console.log('\n[2/3] Translating to Korean...');
    const translated = await translateArticles(articles);
    console.log(`  Translated: ${translated.length}/${articles.length}`);

    // 3. 저장
    console.log('\n[3/3] Writing output...');
    const result = {
      fetchedAt: new Date().toISOString(),
      articles: translated,
    };

    const writeResult = await writeJSON(OUTPUT_PATH, result);

    console.log('\n=== Summary ===');
    console.log(`Articles collected: ${translated.length}`);
    if (translated.length > 0) {
      console.log(`Latest: "${translated[0].titleKo}" (${translated[0].source})`);
    }
    console.log(`Output: ${OUTPUT_PATH}`);
    console.log(`Write status: ${writeResult.success ? 'OK' : 'FAILED'}`);

    if (!writeResult.success) process.exit(1);
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

// --- Finlight API ---

async function fetchFinlightNews() {
  const body = {
    query: 'stock market OR US economy OR Federal Reserve OR S&P 500 OR NASDAQ',
    language: 'en',
    pageSize: MAX_ARTICLES,
    orderBy: 'publishDate',
    order: 'DESC',
  };

  const response = await fetch(FINLIGHT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': FINLIGHT_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Finlight API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.articles || !Array.isArray(data.articles)) {
    throw new Error('Unexpected Finlight API response format');
  }

  return data.articles.map(formatArticle);
}

function formatArticle(item) {
  let summary = item.summary ?? '';
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
  }

  return {
    title: item.title ?? 'Untitled',
    source: extractSourceName(item.source ?? ''),
    url: item.link ?? '',
    publishedAt: item.publishDate ?? new Date().toISOString(),
    summary,
    sentiment: item.sentiment ?? 'neutral',
  };
}

/**
 * "www.reuters.com" → "Reuters" 형태로 변환
 */
function extractSourceName(domain) {
  const name = domain.replace(/^www\./, '').replace(/\.(com|org|net|co\.uk|io)$/, '');
  // 첫 글자 대문자
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// --- 번역 ---

async function translateArticles(articles) {
  const results = [];

  for (const article of articles) {
    try {
      // 제목 + 요약을 한 번에 번역 (API 호출 최소화)
      const textsToTranslate = [article.title];
      if (article.summary) textsToTranslate.push(article.summary);

      const translated = await translate(textsToTranslate, { from: 'en', to: 'ko' });

      const translatedArr = Array.isArray(translated) ? translated : [translated];

      results.push({
        ...article,
        titleKo: translatedArr[0]?.text ?? article.title,
        summaryKo: translatedArr[1]?.text ?? article.summary,
      });
    } catch (err) {
      // 번역 실패 시 원문 유지
      console.warn(`  Translation failed for "${article.title.slice(0, 40)}...": ${err.message}`);
      results.push({
        ...article,
        titleKo: article.title,
        summaryKo: article.summary,
      });
    }

    // 번역 API 속도 제한 방지
    await delay(200);
  }

  return results;
}

// --- 유틸 ---

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 실행 ---
main();
