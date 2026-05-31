---
name: framework-valuation-input-consistency-check
description: 동일 종목 밸류에이션 입력이 상충(PER LTM vs forward)할 때 정합성 검증 후 보수적 전제 채택 프레임
metadata:
  type: feedback
---

재무 분석가의 밸류에이션 입력(특히 PER)이 같은 종목·근접 일자에 크게 다르게 들어오면(예: 삼성전자 PER 9~10배 vs 21.6배), 자동으로 신뢰하지 말고 **기준 시점(LTM 실적 기준 vs 2026E 선행 기준)을 명시적으로 의심**하라. 통상 고배수=과거 LTM, 저배수=이익 급증 반영 forward.

**Why:** 2026-05-29 삼성전자 분석에서 동일 일자 직전 기록은 PER 9~10배(저PER 후발주자 리레이팅 thesis), 이번 입력은 PER 21.6배·PBR 3.79배(고평가 선반영 thesis)로 정반대 프레임이 들어왔다. 같은 가격이 forward로는 싸고 LTM으로는 비싸 보이는 전형적 사례. 이를 못 잡으면 정반대 판정(적극매수 vs 분할매수)이 나온다.

**How to apply:** (1) 상충 감지 시 리포트 상단에 "밸류에이션 데이터 정합성 경고"를 명시. (2) 불명확하면 보수적 전제(고평가=LTM)를 채택해 첫 트랜치 비중을 낮추고 진입가에 제동. (3) 방향성(상승)은 뉴스·업종이 받쳐주면 유지하되, 진입 강도만 다운그레이드. (4) 진입 전 사용자에게 PER 기준 시점 확정을 요청. [[pattern-memory-supercycle-laggard-rerating]] [[verdict-2026-05-29-samsung-electronics]]
