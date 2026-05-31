---
name: reference-korean-news-sources
description: 한국 금융 뉴스 소스 활용 가이드 및 소형 해외 종목 검색 한계
metadata:
  type: reference
---

뉴스 수집 시 소스별 특성:

- **NaverSearch search_news**: 한국 국내 종목·대형 글로벌 종목에는 유효하나, 소형 해외 주니어 종목(예: Santacruz Silver "산타크루즈 실버")은 결과 0건. 한국어 커버리지 없음.
- **UsStockInfo get_finance_news**: 티커 기반(SCZMF 등). Yahoo Finance 기사 반환, 다소 과거 기사 포함되므로 날짜 확인 필요.
- **WebSearch**: 소형 해외 종목 최신 뉴스에 가장 효과적. 신뢰 소스: 회사 IR(santacruzsilver.com), newsfilecorp.com, stocktitan.net, investingnews.com(INN), Seeking Alpha, Simply Wall St, Crux Investor, Junior Mining Network.

**How to apply:** 소형 해외 종목은 WebSearch + UsStockInfo 우선. NaverSearch는 한국 관련성 확인용으로만 시도하고 결과 없으면 "한국어 뉴스 커버리지 없음" 명시.
