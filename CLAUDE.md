# 주식 분석 멀티에이전트 시스템

## 프로젝트 개요
이 프로젝트는 한국 주식 종목에 대한 종합 투자 분석을 수행하는 멀티에이전트 파이프라인입니다.  
네 개의 전문 에이전트가 협력하여 재무·뉴스·업종 분석을 병렬로 수행하고, 공격적 투자 전략가가 최종 판단을 내립니다.

## 에이전트 구성

| 에이전트 | 역할 |
|---|---|
| `financial-analyst-kr` | 재무제표 분석 — PER·PBR·ROE·부채비율 등 8개 지표, 재무 건전성 등급 산출 |
| `news-sentiment-analyst` | 최근 1개월 뉴스 수집·분류 — 호재/악재 판정, 시장 심리 판정 |
| `sector-researcher` | 글로벌 업종 흐름·경쟁사·규제 분석, 업종 전망 판정 |
| `aggressive-investment-strategist` | 세 분석가 결과 종합 → 최종 투자 판단 (적극매수/분할매수/관망/비중축소/매도) |

---

## 오케스트레이션 워크플로우

사용자가 종목 분석을 요청하면 다음 절차를 따릅니다.

### 1단계 — 병렬 분석 실행
아래 세 에이전트를 **단일 메시지에서 동시에 (병렬로)** 호출합니다:
- `financial-analyst-kr`
- `news-sentiment-analyst`
- `sector-researcher`

### 2단계 — 종합 판단
세 에이전트 결과가 모두 반환되면 `aggressive-investment-strategist`를 호출하여 최종 투자 리포트를 작성합니다.

### 3단계 — 결과 기록
최종 리포트가 완성되면 아래 **분석 결과 히스토리** 섹션에 추가하고, 전체 리포트는 `reports/YYYYMMDD_종목명.md`로 저장합니다.

### 4단계 — Vercel 자동 동기화 (필수)
리포트 파일 저장 직후, 반드시 아래 명령어를 실행하여 Supabase에 업로드합니다. 이 단계를 빠뜨리면 Vercel(https://web-psi-fawn-99.vercel.app)에 리포트가 표시되지 않습니다.
```
cd C:\Users\20110079\stock\web && node scripts/seed-reports.mjs
```

### 5단계 — 빈 리포트·중복 종목 정리 (필수)
세션 한도 초과·빈 메시지 등으로 인해 실제 분석 내용이 없는 **빈 리포트**(예: "You've hit your session limit", "메시지가 비어 있습니다" 같은 placeholder 텍스트만 담긴 파일)나, 같은 종목을 다른 날짜로 재분석해 예전 리포트가 고아로 남는 **중복 종목 리포트**가 생기면 항상 정리합니다.
1. `reports/` 폴더에서 비정상적으로 작은 파일(수십~백 바이트)이나 placeholder 문구만 있는 `.md`를 찾아 로컬에서 삭제
2. Supabase `reports` 테이블에서도 동일 slug 행을 삭제 — anon 키는 RLS로 인해 delete가 무시되므로(0 rows affected), Supabase 대시보드 SQL Editor(`postgres` role, RLS 우회)에서 `delete from reports where slug in (...)`를 직접 실행해야 함 (Playwright MCP로 `https://supabase.com/dashboard/project/thbhrtnamqyuuelkoswi/sql/new` 접속 → 쿼리 입력 → Run → 확인 다이얼로그 승인)
3. 삭제 후 로컬 파일 목록과 Supabase `reports` slug 목록이 1:1로 일치하는지 확인

---

## 오케스트레이터 지침

> 이 섹션은 Claude(오케스트레이터)가 따라야 할 실행 지침입니다.

1. **트리거 조건**: 사용자가 종목명 또는 티커와 함께 분석·리서치·투자 판단을 요청하면 이 파이프라인을 실행합니다.
2. **병렬 실행 필수**: `financial-analyst-kr`, `news-sentiment-analyst`, `sector-researcher` 세 에이전트는 반드시 동시에 (같은 메시지에서 세 개의 Agent 툴 호출로) 실행합니다. 순차 실행 금지.
3. **종합 단계**: 세 결과를 모두 수집한 뒤, 각 결과를 `aggressive-investment-strategist`의 프롬프트에 완전히 포함시켜 호출합니다.
4. **CLAUDE.md 업데이트**: 최종 리포트 완성 후 아래 히스토리 섹션에 날짜·종목명·판정 결과를 한 줄로 추가하고, 전체 리포트는 `reports/YYYYMMDD_종목명.md`로 저장합니다.
5. **Vercel 동기화 필수**: 리포트 파일 저장 후 반드시 `cd C:\Users\20110079\stock\web && node scripts/seed-reports.mjs`를 실행하여 Supabase에 업로드합니다. 이 단계 없이는 Vercel에 리포트가 나타나지 않습니다.
6. **언어**: 모든 에이전트 결과와 사용자 응답은 한국어로 출력합니다.
7. **빈 리포트·중복 종목 자동 정리**: 매 분석 사이클 종료 시(또는 정리 요청 시) `reports/` 폴더와 Supabase `reports` 테이블을 점검하여 placeholder뿐인 빈 리포트와, 동일 종목의 오래된 중복 리포트(로컬 파일 없이 Supabase에만 남은 고아 행 포함)를 항상 삭제합니다. Supabase 삭제는 anon 키로는 RLS에 막히므로 SQL Editor(postgres role)에서 직접 `delete from reports where slug in (...)`를 실행합니다.

---

## 분석 결과 히스토리

<!-- 분석이 완료될 때마다 아래에 행을 추가합니다 -->

| 날짜 | 종목명 | 재무등급 | 뉴스심리 | 업종전망 | 최종판정 | 리포트 |
|------|--------|----------|----------|----------|----------|--------|
| 2026-06-17 | PKC 피케이씨 (001340) [3차] | C (보통) | 긍정 📈 (호재 67%) | 긍정 ✅ (근거 교체: 美반덤핑→中공급규율) | 🟠 분할 매수 (유지, 확신 횡보) | [리포트](reports/20260617_PKC_001340.md) |
| 2026-06-08 | RISE 200TR ETF (361580) | — (ETF, 보수 0.012%·추적오차 0.29%) | 중립 ➡️ (거품론 vs 정상화론 공존) | 중립 ⚖️ (코스피 사상최고가·외국인 매도 지속) | 🟠 분할 매수 | [리포트](reports/20260608_RISE_200TR_361580.md) |
| 2026-05-31 | LG전자 (066570) | B (양호) | 긍정 📈 (호재 73%) | 긍정 ✅ | 🟠 분할 매수 | [리포트](reports/20260531_LG전자_066570.md) |
| 2026-05-30 | 제주반도체 (080220) | A (우수) | 중립 ➡️ | 긍정 ✅ | 🟠 분할 매수 | [리포트](reports/20260530_제주반도체.md) |
| 2026-05-29 | 삼성전자 (005930) | A (우수) | 긍정 📈 | 긍정 ✅ | 🟠 분할 매수 | [리포트](reports/20260529_Samsung_Electronics.md) |
| 2026-05-27 | Santacruz Silver Mining (SCZ) | B (양호) | 긍정 📈 | 중립 ⚖️ | 🟠 분할 매수 | [리포트](reports/20260527_Santacruz_Silver.md) |
