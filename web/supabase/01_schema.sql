-- ============================================================
-- predictions 테이블 + 자동계산 view
-- 출처: stock-analysis/advice/01_schema.sql (적중률 추적 기능)
-- ============================================================

create table if not exists predictions (
  id          bigint generated always as identity primary key,
  종목         text    not null,
  코드         text,
  판정일       date    not null,
  방향         text    not null,
  진입가       numeric,
  목표가_3m    numeric,
  손절가       numeric,
  검증일       date    not null,
  실제가       numeric,
  report_slug text,
  created_at  timestamptz default now()
);

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
      then (실제가 >= 목표가_3m)
    when 진입가 > 0
      then (실제가 > 진입가)
  end as 적중
from predictions;

alter table predictions enable row level security;

create policy "공개 읽기" on predictions
  for select using (true);
-- 쓰기 정책 없음: service_role 키로만 INSERT/UPDATE 가능
