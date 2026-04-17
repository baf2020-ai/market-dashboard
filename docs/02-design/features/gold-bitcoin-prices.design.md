# Design: 금 시세 & 비트코인 시세 추가

> Feature: gold-bitcoin-prices
> Plan: `docs/01-plan/features/gold-bitcoin-prices.plan.md`
> Created: 2026-04-18
> Status: Draft

---

## 1. 변경 파일 목록

### 신규 생성
| # | 파일 | 용도 |
|---|------|------|
| 1 | `scripts/fetch-assets.mjs` | 금/비트코인 데이터 수집 |
| 2 | `src/data/assets.json` | 샘플 데이터 (빌드 즉시 렌더링용) |

### 수정
| # | 파일 | 변경 내용 |
|---|------|----------|
| 3 | `src/pages/index.astro` | 자산 섹션 추가 (US 섹션 위) |
| 4 | `scripts/package.json` | `fetch:assets` 스크립트 추가, `fetch:all` 수정 |
| 5 | `.github/workflows/fetch-us-data.yml` | `fetch-assets.mjs` step 추가 |
| 6 | `.github/workflows/fetch-all.yml` | `fetch-assets.mjs` step 추가 |

### 변경 없음
- `MarketIndex.astro` — 기존 props 구조로 금/BTC 카드 렌더링 가능
- `UpdatedAt.astro` — 그대로 재사용
- `BaseLayout.astro` — 변경 불필요

## 2. 데이터 스키마

### `src/data/assets.json`

```json
{
  "fetchedAt": "2026-04-18T21:00:00Z",
  "assets": [
    {
      "symbol": "GC=F",
      "name": "Gold",
      "displayName": "금 (XAU)",
      "price": 2380.50,
      "change": 12.30,
      "changePercent": 0.52,
      "dayHigh": 2395.00,
      "dayLow": 2365.00,
      "currency": "USD",
      "unit": "oz"
    },
    {
      "symbol": "BTC-USD",
      "name": "Bitcoin",
      "displayName": "비트코인 (BTC)",
      "price": 84250.00,
      "change": -1200.50,
      "changePercent": -1.40,
      "dayHigh": 86000.00,
      "dayLow": 83500.00,
      "currency": "USD",
      "unit": "BTC"
    }
  ]
}
```

**필드 정의:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `fetchedAt` | string (ISO 8601) | 데이터 수집 시각 (UTC) |
| `assets[].symbol` | string | yahoo-finance2 티커 심볼 |
| `assets[].name` | string | 영문 이름 |
| `assets[].displayName` | string | 대시보드 표시용 한글 이름 |
| `assets[].price` | number | 현재가 (USD) |
| `assets[].change` | number | 전일/24h 대비 변동 |
| `assets[].changePercent` | number | 변동률 (%) |
| `assets[].dayHigh` | number | 일중/24h 고가 |
| `assets[].dayLow` | number | 일중/24h 저가 |
| `assets[].currency` | string | 가격 통화 |
| `assets[].unit` | string | 단위 (oz, BTC) |

## 3. 스크립트 설계: `fetch-assets.mjs`

### 구조

```
fetch-assets.mjs
├── ASSET_SYMBOLS 상수 (['GC=F', 'BTC-USD'])
├── main()
│   ├── yahooFinance.quote(ASSET_SYMBOLS)
│   ├── 응답을 스키마에 맞게 변환
│   └── writeJSON(OUTPUT_PATH, result)
└── formatAsset(quote, config)
    ├── quote 필드 매핑 (regularMarketPrice → price 등)
    └── roundNum() 적용
```

### yahoo-finance2 quote 필드 매핑

| yahoo-finance2 필드 | assets.json 필드 |
|---------------------|-----------------|
| `regularMarketPrice` | `price` |
| `regularMarketChange` | `change` |
| `regularMarketChangePercent` | `changePercent` |
| `regularMarketDayHigh` | `dayHigh` |
| `regularMarketDayLow` | `dayLow` |

### 에러 처리
- 전체 실패: 기존 `assets.json` 유지, `process.exit(1)`
- 개별 자산 실패: 해당 자산만 스킵, 나머지 저장

### 기존 코드 패턴 준수
- `fetch-us-market.mjs`와 동일한 구조: import → 상수 → main() → 수집 함수 → 유틸
- `writeJSON`/`readJSON` 재사용
- `yahooFinance.suppressNotices` 호출
- stdout 요약 로그 출력

## 4. UI 변경: `index.astro`

### 추가할 코드 위치

`import` 블록에 추가:
```javascript
import assets from "../data/assets.json";
```

US Market Section **위에** 새 섹션 삽입:

```astro
{/* Assets Section */}
<section class="mb-8">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-bold flex items-center gap-2">
      주요 자산
    </h2>
    <UpdatedAt iso={assets.fetchedAt} label="Assets" />
  </div>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {assets.assets.map((asset) => (
      <MarketIndex
        symbol={asset.symbol}
        name={asset.displayName}
        price={asset.price}
        change={asset.change}
        changePercent={asset.changePercent}
        previousClose={asset.price - asset.change}
        dayHigh={asset.dayHigh}
        dayLow={asset.dayLow}
      />
    ))}
  </div>
</section>
```

### 레이아웃
- `sm:grid-cols-2` — 금과 비트코인 2개 카드가 나란히 배치
- 모바일: 세로 스택 (`grid-cols-1`)

## 5. 워크플로우 변경

### `fetch-us-data.yml` — step 추가

기존 `Fetch US news` step 다음에 추가:

```yaml
- name: Fetch asset prices
  run: cd scripts && node fetch-assets.mjs
```

### `fetch-all.yml` — step 추가

기존 `Fetch KR market data` step 다음에 추가:

```yaml
- name: Fetch asset prices
  run: cd scripts && node fetch-assets.mjs
```

### `scripts/package.json` — scripts 수정

```json
"fetch:assets": "node fetch-assets.mjs",
"fetch:all": "npm run fetch:us-market && npm run fetch:us-news && npm run fetch:kr-market && npm run fetch:assets"
```

## 6. 구현 순서

1. `src/data/assets.json` — 샘플 데이터 생성
2. `scripts/fetch-assets.mjs` — 데이터 수집 스크립트
3. `scripts/package.json` — 스크립트 명령 추가
4. `src/pages/index.astro` — 자산 섹션 UI 추가
5. `.github/workflows/fetch-us-data.yml` — step 추가
6. `.github/workflows/fetch-all.yml` — step 추가
7. 빌드 테스트 (`npm run build`)
