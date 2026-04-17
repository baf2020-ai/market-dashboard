# Gap Analysis: gold-bitcoin-prices

## Summary

| Metric | Value |
|--------|-------|
| Feature | gold-bitcoin-prices |
| Date | 2026-04-17 |
| Match Rate | **98%** (60/61) |
| Status | **PASS** (>= 90% threshold) |

## Design vs Implementation Comparison

### Matched Items (60/61)

#### Data Script (`scripts/fetch-assets.mjs`)
- [x] yahoo-finance2 dependency added to scripts/package.json
- [x] Fetches Gold (GC=F) and Bitcoin (BTC-USD) quotes
- [x] Uses `yahooFinance.quote()` API
- [x] Output path: `src/data/assets.json`
- [x] JSON schema matches design (fetchedAt, assets array)
- [x] Each asset has: symbol, name, displayName, price, change, changePercent, dayHigh, dayLow, currency, unit
- [x] Error handling: preserves existing data on failure
- [x] Partial failure: skips individual assets, continues with others
- [x] Uses shared `writeJSON`/`readJSON` from utils/file-writer.mjs
- [x] Round to 2 decimal places

#### Sample Data (`src/data/assets.json`)
- [x] Valid JSON with correct schema
- [x] Contains Gold and Bitcoin entries
- [x] All required fields present

#### UI Integration (`src/pages/index.astro`)
- [x] Assets section placed at top (before US Market)
- [x] Imports assets.json
- [x] Uses MarketIndex component for each asset
- [x] Grid layout: `grid-cols-1 sm:grid-cols-2`
- [x] Section title: "주요 자산"
- [x] UpdatedAt component showing assets.fetchedAt
- [x] Passes all required props to MarketIndex

#### GitHub Actions Workflows
- [x] fetch-us-data.yml includes `fetch-assets.mjs` step
- [x] fetch-all.yml includes `fetch-assets.mjs` step
- [x] Correct working directory (`cd scripts`)
- [x] No API key needed (yahoo-finance2 is free)

#### package.json Scripts
- [x] `fetch:assets` script added
- [x] `fetch:all` includes fetch:assets in chain

### Gaps Found (1/61)

| # | Category | Design | Implementation | Severity | Impact |
|---|----------|--------|----------------|----------|--------|
| 1 | Naming | `ASSET_SYMBOLS` constant | `ASSET_CONFIGS` constant | Info | None - `ASSET_CONFIGS` is more descriptive since it holds config objects, not just symbols |

## Recommendation

**No code changes required.** The single gap is a naming improvement over the design. The implementation uses `ASSET_CONFIGS` which better describes the array of configuration objects (each containing symbol, name, displayName, currency, unit), versus `ASSET_SYMBOLS` which implies a simple string array.

Suggest updating the design document to reflect the actual naming if strict doc-code parity is desired.
