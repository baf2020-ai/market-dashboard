# Plan: 금 시세 & 비트코인 시세 추가

> Feature: gold-bitcoin-prices
> Created: 2026-04-18
> Status: Draft

---

## 1. 요구사항 요약

기존 주식 대시보드에 **금(Gold) 시세**와 **비트코인(BTC) 시세**를 추가한다.
대시보드 상단에 주요 자산 현황으로 한눈에 보이도록 배치한다.

## 2. 상세 요구사항

### 2.1 금 시세
- 국제 금 현물가 (XAU/USD, 트로이온스 기준)
- 현재가, 전일 대비 등락, 등락률(%)
- 일중 고가/저가

### 2.2 비트코인 시세
- BTC/USD 현재가
- 24시간 대비 등락, 등락률(%)
- 24시간 고가/저가
- 24시간 거래량 (선택)

## 3. 데이터 소스

| 자산 | 1순위 소스 | 방식 | API 키 | 2순위 대체 |
|------|-----------|------|--------|-----------|
| **금 (XAU)** | yahoo-finance2 (`GC=F`) | npm 패키지 | 불필요 | Alpha Vantage |
| **비트코인 (BTC)** | yahoo-finance2 (`BTC-USD`) | npm 패키지 | 불필요 | CoinGecko API (무료) |

> yahoo-finance2는 이미 US 시장 데이터에 사용 중이므로 추가 의존성 없이 확장 가능.

### CoinGecko 대체 엔드포인트 (비트코인)
```
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true
```

## 4. 데이터 스키마

### `src/data/assets.json` (신규 파일)

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

## 5. 변경 범위

### 5.1 신규 파일
| 파일 | 용도 |
|------|------|
| `scripts/fetch-assets.mjs` | 금/비트코인 데이터 수집 스크립트 |
| `src/data/assets.json` | 수집된 자산 데이터 (샘플 포함) |

### 5.2 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/pages/index.astro` | 상단에 자산 현황 섹션 추가 |
| `.github/workflows/fetch-us-data.yml` | `fetch-assets.mjs` 실행 추가 (US 마감 시간에 함께 수집) |
| `.github/workflows/fetch-all.yml` | `fetch-assets.mjs` 실행 추가 |
| `scripts/package.json` | 스크립트 명령 추가 (`fetch:assets`) |

### 5.3 기존 컴포넌트 재사용
- `MarketIndex.astro` — 금/비트코인 카드에 그대로 사용 가능 (동일한 price/change/changePercent 구조)
- `UpdatedAt.astro` — 갱신 시각 표시 재사용

## 6. UI 배치

```
┌─────────────────────────────────────────┐
│  헤더                                    │
├─────────────────────────────────────────┤
│  ★ 주요 자산 (신규)                       │
│  [금 (XAU)] [비트코인 (BTC)]              │
├─────────────────────────────────────────┤
│  US 시장 현황 (기존)                      │
│  ...                                    │
├─────────────────────────────────────────┤
│  KR 시장 현황 (기존)                      │
│  ...                                    │
└─────────────────────────────────────────┘
```

금/비트코인은 US 시장 섹션 **위에** 별도 섹션으로 배치한다.

## 7. 스케줄

금과 비트코인은 24시간 거래되므로, 기존 US 마감 수집 시간(UTC 21:00)에 함께 수집한다.
별도 cron은 추가하지 않는다.

## 8. 구현 우선순위

1. `fetch-assets.mjs` 스크립트 작성 + 샘플 JSON 생성
2. `index.astro`에 자산 섹션 추가
3. GitHub Actions 워크플로우 수정
4. 빌드 테스트

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| yahoo-finance2가 `GC=F` 심볼을 지원하지 않을 수 있음 | CoinGecko + Alpha Vantage로 대체 |
| 비트코인 가격 변동이 빈번하여 데이터가 금방 outdated | 대시보드에 "실시간 아님" 안내 표시 (이미 푸터에 있음) |
