-- ─────────────────────────────────────────────────────────────
-- 최종정산서: 계약(견적) 진행 후 실제로 나간 비용을 기입해 실제 수익률을
-- 확인하기 위한 "사후(after)" 정산 기록. 계약 1건당 정산서 1건.
-- 실제 매출은 항상 contracts.total_amount를 그대로 참조하고(스냅샷 저장 안 함),
-- 실제 총비용만 settlement_items 합계를 settlements.actual_total_cost에 캐싱한다.
-- 이 프로젝트는 다른 테이블과 마찬가지로 RLS를 사용하지 않는다.
-- ─────────────────────────────────────────────────────────────

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  actual_total_cost numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.settlements disable row level security;

-- estimate_item_id가 있으면 견적서의 계획 항목에서 가져온 줄, null이면 정산 시점에
-- 새로 추가한 예상치 못한 비용 항목(is_extra=true)이다.
create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  estimate_item_id uuid references public.estimate_items(id) on delete set null,
  category text not null default '',
  name text not null default '',
  size text not null default '',
  unit text not null default '',
  quantity numeric not null default 1,
  planned_unit_cost numeric not null default 0,
  actual_unit_cost numeric not null default 0,
  actual_amount numeric not null default 0,
  is_extra boolean not null default false,
  memo text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.settlement_items disable row level security;
create index idx_settlement_items_settlement on public.settlement_items(settlement_id);
