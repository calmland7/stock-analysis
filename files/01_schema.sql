-- ============================================================
-- 적중률 추적 스키마  (Supabase SQL Editor에서 실행)
-- ============================================================

-- 1) 판정 기록 테이블
create table if not exists predictions (
  id          bigint generated always as identity primary key,
  종목         text    not null,
  코드         text,
  판정일       date    not null,
  방향         text    not null,        -- 적극매수 / 분할매수 / 관망 / 매도 / 긍정 / 중립
  진입가       numeric,                  -- 판정 시점 기준가 (모르면 null)
  목표가_3m    numeric,                  -- 3개월 목표가 (적중 판정 기준)
  손절가       numeric,
  검증일       date    not null,        -- 보통 판정일 + 30일
  실제가       numeric,                  -- 검증 후 입력 (처음엔 null)
  report_slug text,                     -- 예: 20260608_PKC_001340
  created_at  timestamptz default now()
);

-- 2) 적중/수익률 자동 계산 view
--    실제가만 채우면 적중·수익률이 자동 계산됩니다.
--    [적중 기준]
--    - 목표가가 있으면: 실제가 >= 목표가_3m  → 적중
--    - 목표가가 없으면: 실제가 >  진입가       → 적중 (단순 상승 여부)
create or replace view prediction_results as
select
  *,
  case
    when 실제가 is not null and 진입가 > 0
      then round((실제가 - 진입가) / 진입가 * 100, 1)
  end as 수익률,
  case
    when 실제가 is null then null
    when 목표가_3m is not null and 목표가_3m > 0
      then (실제가 >= 목표가_3m)        -- 목표가 도달 = 적중
    when 진입가 > 0
      then (실제가 > 진입가)            -- 목표가 없으면 단순 상승
  end as 적중
from predictions;

-- 3) (선택) RLS — 읽기는 공개, 쓰기는 서버키만
alter table predictions enable row level security;

create policy "공개 읽기" on predictions
  for select using (true);
-- 쓰기 정책은 만들지 않음 → service_role(서버) 키로만 INSERT/UPDATE 가능
