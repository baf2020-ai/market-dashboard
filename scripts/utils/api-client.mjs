/**
 * api-client.mjs
 * HTTP 요청 유틸리티 - 재시도(exponential backoff), 에러 처리
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Exponential backoff 재시도를 포함한 fetch 래퍼
 * @param {string} url - 요청 URL
 * @param {object} options - fetch 옵션 + 재시도 설정
 * @param {number} [options.maxRetries=3] - 최대 재시도 횟수
 * @param {number} [options.baseDelay=1000] - 기본 대기 시간 (ms)
 * @param {number} [options.timeout=15000] - 요청 타임아웃 (ms)
 * @param {object} [options.headers] - HTTP 헤더
 * @returns {Promise<Response>} fetch Response 객체
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY_MS,
    timeout = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} — ${url}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[api-client] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${url}: ${error.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `[api-client] All ${maxRetries + 1} attempts failed for ${url}: ${lastError.message}`
  );
}

/**
 * JSON 응답을 파싱하여 반환하는 편의 함수
 * @param {string} url - 요청 URL
 * @param {object} [options] - fetchWithRetry 옵션
 * @returns {Promise<any>} 파싱된 JSON 데이터
 */
export async function fetchJSON(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.json();
}

/**
 * 지정된 시간(ms) 동안 대기
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
