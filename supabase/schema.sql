-- ASO System WMS Database Schema
-- Run this in your Supabase SQL Editor

-- Items master list
create table if not exists items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('모듈프레임', '파트', '마감재', '팔레트', '공구')),
  unit text not null default 'EA',
  description text,
  created_at timestamptz default now()
);

-- Projects
create table if not exists wms_projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client text,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- All inventory movements
create table if not exists inventory_transactions (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references items(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('입고', '출고', '반입', '손실')),
  quantity integer not null check (quantity > 0),
  project_id uuid references wms_projects(id) on delete set null,
  transaction_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Disable Row Level Security (for internal tool usage)
alter table items disable row level security;
alter table wms_projects disable row level security;
alter table inventory_transactions disable row level security;

-- Optional: Create indexes for performance
create index if not exists idx_transactions_item_id on inventory_transactions(item_id);
create index if not exists idx_transactions_project_id on inventory_transactions(project_id);
create index if not exists idx_transactions_date on inventory_transactions(transaction_date);
create index if not exists idx_transactions_type on inventory_transactions(transaction_type);
create index if not exists idx_items_category on items(category);

-- Current stock formula per item:
-- SUM(quantity WHERE type='입고') - SUM(quantity WHERE type='출고') + SUM(quantity WHERE type='반입') - SUM(quantity WHERE type='손실')

-- ============================================================
-- 견적서(Estimate) 기능
-- ============================================================

create table if not exists item_master (
  id uuid default gen_random_uuid() primary key,
  category text not null check (category in (
    '시스템 자재','그래픽','전기/조명','가구/비품','운송',
    '설치/철거 인건비','전시장 비용','디자인/PM','기타'
  )),
  name text not null,
  description text,
  unit text not null default 'EA',
  default_execution_unit_cost numeric not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  unique (category, name)
);

create table if not exists pricing_policies (
  id uuid default gen_random_uuid() primary key,
  client_type text not null check (client_type in ('기획사용', '참가사용')),
  -- 'OVERALL' = 고객유형 전체 목표/최소/최대 이윤율(최종이윤율 경고 판정용).
  -- 그 외 값은 카테고리별 기본 이윤율(견적항목 margin_rate 기본값용).
  -- 카테고리별 min/max는 명세서에 별도 수치가 없어 OVERALL과 동일값 사용.
  category text not null check (category in (
    '시스템 자재','그래픽','전기/조명','가구/비품','운송',
    '설치/철거 인건비','전시장 비용','디자인/PM','기타','OVERALL'
  )),
  default_margin_rate numeric not null,
  min_margin_rate numeric not null,
  max_margin_rate numeric not null,
  created_at timestamptz default now(),
  unique (client_type, category)
);

create table if not exists risk_options (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  default_rate numeric not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists estimates (
  id uuid default gen_random_uuid() primary key,
  estimate_number text not null unique,
  client_type text not null check (client_type in ('기획사용', '참가사용')),
  client_name text not null,
  client_contact text,
  exhibition_name text,
  venue text,
  booth_size text,
  booth_type text,
  install_date date,
  dismantle_date date,
  pm text,
  valid_until date,
  project_id uuid references wms_projects(id) on delete set null,
  status text not null default '작성중' check (status in ('작성중','발송완료','계약완료','취소')),
  review_required boolean not null default false,
  vat_rate numeric not null default 0.10,
  notes text,
  customer_notes text,
  payment_terms text,
  included_scope text,
  excluded_scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists estimate_items (
  id uuid default gen_random_uuid() primary key,
  estimate_id uuid not null references estimates(id) on delete cascade,
  item_master_id uuid references item_master(id) on delete set null,
  category text not null check (category in (
    '시스템 자재','그래픽','전기/조명','가구/비품','운송',
    '설치/철거 인건비','전시장 비용','디자인/PM','기타'
  )),
  name text not null,
  description text,
  unit text not null default 'EA',
  execution_unit_cost numeric not null default 0,
  quantity numeric not null default 0,
  margin_rate numeric not null,
  execution_total numeric not null default 0,
  quoted_amount numeric not null default 0,
  show_to_client boolean not null default true,
  supplier text,
  memo text,
  is_custom boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists estimate_adjustments (
  id uuid default gen_random_uuid() primary key,
  estimate_id uuid not null references estimates(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('overhead', 'discount')),
  label text,
  value_type text not null check (value_type in ('rate', 'fixed')),
  value numeric not null default 0,
  created_at timestamptz default now(),
  unique (estimate_id, adjustment_type)
);

create table if not exists estimate_risks (
  id uuid default gen_random_uuid() primary key,
  estimate_id uuid not null references estimates(id) on delete cascade,
  risk_option_id uuid references risk_options(id) on delete set null,
  name text not null,
  rate numeric not null,
  created_at timestamptz default now(),
  unique (estimate_id, risk_option_id)
);

alter table item_master disable row level security;
alter table pricing_policies disable row level security;
alter table risk_options disable row level security;
alter table estimates disable row level security;
alter table estimate_items disable row level security;
alter table estimate_adjustments disable row level security;
alter table estimate_risks disable row level security;

create index if not exists idx_item_master_category on item_master(category);
create index if not exists idx_pricing_policies_client_category on pricing_policies(client_type, category);
create index if not exists idx_estimates_status on estimates(status);
create index if not exists idx_estimates_client_type on estimates(client_type);
create index if not exists idx_estimate_items_estimate_id on estimate_items(estimate_id);
create index if not exists idx_estimate_adjustments_estimate_id on estimate_adjustments(estimate_id);
create index if not exists idx_estimate_risks_estimate_id on estimate_risks(estimate_id);

-- Seed: 고객유형 전체 목표/최소/최대 이윤율
insert into pricing_policies (client_type, category, default_margin_rate, min_margin_rate, max_margin_rate) values
  ('기획사용', 'OVERALL', 0.37, 0.35, 0.40),
  ('참가사용', 'OVERALL', 0.45, 0.40, 0.50)
on conflict (client_type, category) do nothing;

-- Seed: 기획사용 카테고리별 기본 이윤율 (min/max는 OVERALL과 동일값 사용)
insert into pricing_policies (client_type, category, default_margin_rate, min_margin_rate, max_margin_rate) values
  ('기획사용', '시스템 자재',       0.38, 0.35, 0.40),
  ('기획사용', '그래픽',           0.37, 0.35, 0.40),
  ('기획사용', '전기/조명',        0.35, 0.35, 0.40),
  ('기획사용', '가구/비품',        0.35, 0.35, 0.40),
  ('기획사용', '운송',             0.35, 0.35, 0.40),
  ('기획사용', '설치/철거 인건비', 0.38, 0.35, 0.40),
  ('기획사용', '전시장 비용',      0.35, 0.35, 0.40),
  ('기획사용', '디자인/PM',        0.40, 0.35, 0.40),
  ('기획사용', '기타',             0.37, 0.35, 0.40)
on conflict (client_type, category) do nothing;

-- Seed: 참가사용 카테고리별 기본 이윤율 (min/max는 OVERALL과 동일값 사용)
insert into pricing_policies (client_type, category, default_margin_rate, min_margin_rate, max_margin_rate) values
  ('참가사용', '시스템 자재',       0.45, 0.40, 0.50),
  ('참가사용', '그래픽',           0.45, 0.40, 0.50),
  ('참가사용', '전기/조명',        0.42, 0.40, 0.50),
  ('참가사용', '가구/비품',        0.42, 0.40, 0.50),
  ('참가사용', '운송',             0.40, 0.40, 0.50),
  ('참가사용', '설치/철거 인건비', 0.45, 0.40, 0.50),
  ('참가사용', '전시장 비용',      0.40, 0.40, 0.50),
  ('참가사용', '디자인/PM',        0.50, 0.40, 0.50),
  ('참가사용', '기타',             0.45, 0.40, 0.50)
on conflict (client_type, category) do nothing;

-- Seed: 리스크 옵션 9종
insert into risk_options (name, default_rate, sort_order) values
  ('일정 촉박', 0.03, 1),
  ('야간 설치', 0.03, 2),
  ('지방 전시장', 0.03, 3),
  ('신규 고객', 0.02, 4),
  ('디자인 미확정', 0.03, 5),
  ('그래픽 자료 미확정', 0.03, 6),
  ('복잡한 구조물', 0.04, 7),
  ('주최사 규정 까다로움', 0.02, 8),
  ('현장 수정 가능성 높음', 0.03, 9)
on conflict (name) do nothing;

-- Seed: 품목마스터 86개 (실행단가 0으로 시작, 추후 Supabase 테이블 에디터로 직접 수정)
insert into item_master (category, name, sort_order) values
  ('시스템 자재','알루비젼 프레임',1),('시스템 자재','알루비젼 커넥터',2),('시스템 자재','시스템 패널',3),
  ('시스템 자재','시스템 도어',4),('시스템 자재','락커룸 구조',5),('시스템 자재','상담실 구조',6),
  ('시스템 자재','인포데스크 구조',7),('시스템 자재','쇼케이스 구조',8),('시스템 자재','타워 구조',9),
  ('시스템 자재','천장 구조',10),('시스템 자재','선반 구조',11),('시스템 자재','모니터 브라켓',12),
  ('시스템 자재','기타 시스템 부속',13),

  ('그래픽','패브릭 출력',1),('그래픽','포맥스 출력',2),('그래픽','시트 출력',3),
  ('그래픽','배너 출력',4),('그래픽','현수막 출력',5),('그래픽','로고 커팅',6),
  ('그래픽','그래픽 디자인 수정',7),('그래픽','그래픽 설치',8),('그래픽','그래픽 철거',9),
  ('그래픽','긴급 재출력',10),

  ('전기/조명','LED 암스팟',1),('전기/조명','LED 바 조명',2),('전기/조명','매립 조명',3),
  ('전기/조명','콘센트',4),('전기/조명','전기 배선',5),('전기/조명','전기 간선',6),
  ('전기/조명','조명 설치',7),('전기/조명','조명 철거',8),('전기/조명','전시장 전기 신청 대행',9),
  ('전기/조명','추가 전기 작업',10),

  ('가구/비품','상담 테이블',1),('가구/비품','상담 의자',2),('가구/비품','바 테이블',3),
  ('가구/비품','바 체어',4),('가구/비품','카운터',5),('가구/비품','인포데스크',6),
  ('가구/비품','쇼케이스',7),('가구/비품','냉장고',8),('가구/비품','카탈로그 스탠드',9),
  ('가구/비품','쓰레기통',10),('가구/비품','파이텍스',11),('가구/비품','바닥재',12),
  ('가구/비품','기타 비품',13),

  ('운송','1톤 차량',1),('운송','2.5톤 차량',2),('운송','5톤 차량',3),
  ('운송','지방 운송',4),('운송','왕복 운송',5),('운송','상차 인력',6),
  ('운송','하차 인력',7),('운송','지게차',8),('운송','포장비',9),('운송','보관비',10),

  ('설치/철거 인건비','설치 인력',1),('설치/철거 인건비','철거 인력',2),('설치/철거 인건비','현장 반장',3),
  ('설치/철거 인건비','야간 설치',4),('설치/철거 인건비','야간 철거',5),('설치/철거 인건비','추가 작업 인력',6),
  ('설치/철거 인건비','지방 출장비',7),('설치/철거 인건비','숙박비',8),('설치/철거 인건비','식대',9),
  ('설치/철거 인건비','주차비',10),

  ('전시장 비용','장치 신고비',1),('전시장 비용','전기 신청비',2),('전시장 비용','인터넷 신청비',3),
  ('전시장 비용','급배수 신청비',4),('전시장 비용','압축공기 신청비',5),('전시장 비용','폐기물 처리비',6),
  ('전시장 비용','야간 작업 신청비',7),('전시장 비용','반입증/출입증 비용',8),('전시장 비용','주최사 지정 비용',9),
  ('전시장 비용','기타 전시장 비용',10),

  ('디자인/PM','부스 디자인',1),('디자인/PM','3D 디자인',2),('디자인/PM','도면 작업',3),
  ('디자인/PM','그래픽 편집',4),('디자인/PM','프로젝트 관리비',5),('디자인/PM','현장 관리비',6),
  ('디자인/PM','고객 커뮤니케이션 비용',7),('디자인/PM','사전 미팅',8),('디자인/PM','현장 실측',9),
  ('디자인/PM','사후 정산 업무',10)
on conflict (category, name) do nothing;
-- '기타' 카테고리는 기본 품목 없음 — 견적 작성 시 사용자가 직접 추가

-- ============================================================
-- 견적단가(품목마스터) 구조 개편
-- 카테고리를 12종으로 재정의하고, 사이즈/견적단가(고정 판매단가) 필드를 추가한다.
-- 기존 시드 데이터(실행단가 0, 실사용 없음)는 초기화하고 새 구조로 다시 입력한다.
-- ============================================================

delete from item_master;

alter table item_master drop constraint if exists item_master_category_check;
alter table item_master add constraint item_master_category_check check (category in (
  '시스템 자재','마감재','바닥','그래픽','전기/조명','가구/비품','운송',
  '인건비','전시장비용','디자인','관리비','기타'
));

alter table item_master add column if not exists size text;
alter table item_master add column if not exists quoted_unit_price numeric not null default 0;

alter table item_master alter column unit drop default;
alter table item_master drop constraint if exists item_master_unit_check;
alter table item_master add constraint item_master_unit_check check (unit in ('개','회배','식','세트','회'));
alter table item_master alter column unit set default '개';

alter table item_master drop constraint if exists item_master_category_name_key;
alter table item_master add constraint item_master_category_name_size_key unique (category, name, size);

-- estimate_items도 동일한 카테고리/단위 체계로 갱신하고 사이즈/견적단가(단가)를 추가한다.
-- (아직 저장된 견적이 없어 데이터 마이그레이션 불필요)
alter table estimate_items drop constraint if exists estimate_items_category_check;
alter table estimate_items add constraint estimate_items_category_check check (category in (
  '시스템 자재','마감재','바닥','그래픽','전기/조명','가구/비품','운송',
  '인건비','전시장비용','디자인','관리비','기타'
));

alter table estimate_items add column if not exists size text;
alter table estimate_items add column if not exists quoted_unit_price numeric not null default 0;

alter table estimate_items alter column unit drop default;
alter table estimate_items drop constraint if exists estimate_items_unit_check;
alter table estimate_items add constraint estimate_items_unit_check check (unit in ('개','회배','식','세트','회'));
alter table estimate_items alter column unit set default '개';

create index if not exists idx_item_master_category_name on item_master(category, name);

-- ============================================================
-- 견적단가 대량 등록(아소시스템 단가표)에 맞춰 카테고리 5종, 단위 6종 확장
-- ============================================================

alter table item_master drop constraint if exists item_master_category_check;
alter table item_master add constraint item_master_category_check check (category in (
  '시스템 자재','목재','마감재','바닥','필름','그래픽','그래픽인건비','전기/조명','가구/비품',
  '영상장비','운송','인건비','전시장비용','현장비','디자인','관리비','기타'
));

alter table item_master drop constraint if exists item_master_unit_check;
alter table item_master add constraint item_master_unit_check check (unit in (
  '개','회배','식','세트','회','장','미터','대','시간','KW','모듈'
));

alter table estimate_items drop constraint if exists estimate_items_category_check;
alter table estimate_items add constraint estimate_items_category_check check (category in (
  '시스템 자재','목재','마감재','바닥','필름','그래픽','그래픽인건비','전기/조명','가구/비품',
  '영상장비','운송','인건비','전시장비용','현장비','디자인','관리비','기타'
));

alter table estimate_items drop constraint if exists estimate_items_unit_check;
alter table estimate_items add constraint estimate_items_unit_check check (unit in (
  '개','회배','식','세트','회','장','미터','대','시간','KW','모듈'
));

-- ============================================================
-- 견적 목록에서 실행가/최종금액/이윤율/예상이익을 바로 보여주기 위한 요약값 저장
-- (매 저장 시 계산되어 채워짐 — 목록 화면에서 견적마다 품목을 다시 조회하지 않도록 비정규화)
-- ============================================================
alter table estimates add column if not exists execution_total numeric not null default 0;
alter table estimates add column if not exists final_total_amount numeric not null default 0;
alter table estimates add column if not exists expected_profit numeric not null default 0;
alter table estimates add column if not exists final_profit_rate numeric not null default 0;

-- ============================================================
-- 카테고리 정리: "그래픽인건비"는 "그래픽"으로 통합, "전시장비용"/"디자인"은 삭제
-- (기존 데이터는 이미 UPDATE로 이관 완료 — 이 블록은 체크 제약조건만 갱신한다)
-- ============================================================
alter table item_master drop constraint if exists item_master_category_check;
alter table item_master add constraint item_master_category_check check (category in (
  '시스템 자재','목재','마감재','바닥','필름','그래픽','전기/조명','가구/비품',
  '영상장비','운송','인건비','현장비','관리비','기타'
));

alter table estimate_items drop constraint if exists estimate_items_category_check;
alter table estimate_items add constraint estimate_items_category_check check (category in (
  '시스템 자재','목재','마감재','바닥','필름','그래픽','전기/조명','가구/비품',
  '영상장비','운송','인건비','현장비','관리비','기타'
));

-- ============================================================
-- 견적단가 화면에서 프리셋 외 새 분류를 직접 입력해 추가할 수 있도록
-- category 체크 제약조건을 제거한다(빈 문자열만 방지, 자유 텍스트 허용).
-- ============================================================
alter table item_master drop constraint if exists item_master_category_check;
alter table item_master add constraint item_master_category_not_empty check (btrim(category) <> '');

alter table estimate_items drop constraint if exists estimate_items_category_check;
alter table estimate_items add constraint estimate_items_category_not_empty check (btrim(category) <> '');

-- ============================================================
-- 견적단가를 고객유형(기획사용/참가사용)별로 분리 관리한다.
-- 기존 117개 품목은 전부 "참가사용"으로 확정하고, "기획사용"은 참가사용 목록을
-- 그대로 복제해 새로 만든다(실행단가/견적단가는 이후 화면에서 각자 조정).
-- ============================================================
alter table item_master add column if not exists client_type text not null default '참가사용'
  check (client_type in ('기획사용', '참가사용'));

alter table item_master drop constraint if exists item_master_category_name_size_key;
alter table item_master add constraint item_master_client_category_name_size_key
  unique (client_type, category, name, size);

update item_master set client_type = '참가사용' where client_type is distinct from '참가사용' and client_type is distinct from '기획사용';

insert into item_master (category, name, size, unit, default_execution_unit_cost, quoted_unit_price, sort_order, is_active, client_type)
select p.category, p.name, p.size, p.unit, p.default_execution_unit_cost, p.quoted_unit_price, p.sort_order, p.is_active, '기획사용'
from item_master p
where p.client_type = '참가사용'
  and not exists (
    select 1 from item_master existing
    where existing.client_type = '기획사용'
      and existing.category = p.category
      and existing.name = p.name
      and coalesce(existing.size, '') = coalesce(p.size, '')
  );

-- ============================================================
-- 계약서(Contract) 기능 — 견적서를 불러와 발주처/시공사/계약금액을 자동 채우고
-- 계약정보·결제정보를 정리한다. 시공사(아소시스템) 자체 정보는 코드 상수로 관리한다.
-- ============================================================
create table if not exists contracts (
  id uuid default gen_random_uuid() primary key,
  contract_number text not null unique,
  estimate_id uuid references estimates(id) on delete set null,

  client_name text not null,
  client_contact text,
  client_business_number text,
  client_representative text,
  client_address text,

  exhibition_name text,
  venue text,
  booth_size text,
  install_date date,
  dismantle_date date,

  total_amount numeric not null default 0,
  contract_date date,
  payment_terms text,
  special_terms text,
  notes text,

  status text not null default '작성중' check (status in ('작성중','발송완료','서명완료','계산서요청','완료','취소')),
  invoice_requested_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table contracts disable row level security;

create index if not exists idx_contracts_estimate_id on contracts(estimate_id);
create index if not exists idx_contracts_status on contracts(status);

-- ============================================================
-- 조정 항목에 "기업이윤"(company_profit) 추가 — 제작관리비는 공급가 기준으로 계산되도록
-- 코드에서 변경했고(스키마 변경 없음), 여기서는 조정 유형만 확장한다.
-- ============================================================
alter table estimate_adjustments drop constraint if exists estimate_adjustments_adjustment_type_check;
alter table estimate_adjustments add constraint estimate_adjustments_adjustment_type_check
  check (adjustment_type in ('overhead', 'company_profit', 'discount'));

-- ============================================================
-- 견적서/견적단가 화면에서 프리셋 외 새 단위를 직접 입력해 추가할 수 있도록
-- unit 체크 제약조건을 제거한다(빈 문자열만 방지, 자유 텍스트 허용, category와 동일한 방식).
-- ============================================================
alter table item_master drop constraint if exists item_master_unit_check;
alter table item_master add constraint item_master_unit_not_empty check (btrim(unit) <> '');

alter table estimate_items drop constraint if exists estimate_items_unit_check;
alter table estimate_items add constraint estimate_items_unit_not_empty check (btrim(unit) <> '');

-- ============================================================
-- 조정 항목에 "공과잡비"(public_dues) 추가 — 제작관리비(공급가 기준)와 별개로,
-- 실행가 총합 기준으로 자동 계산되는 관리비 항목(기본 5%).
-- ============================================================
alter table estimate_adjustments drop constraint if exists estimate_adjustments_adjustment_type_check;
alter table estimate_adjustments add constraint estimate_adjustments_adjustment_type_check
  check (adjustment_type in ('overhead', 'company_profit', 'public_dues', 'discount'));

-- ============================================================
-- 고객관리(Clients) — 참가사/기획사 등 거래 고객사 마스터 목록
-- ============================================================
create table if not exists clients (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  industry text,
  manager text,
  contact_name text,
  phone text,
  email text,
  invoice_email text,
  address text,
  business_reg_url text,
  notes text,
  created_at timestamptz default now()
);
alter table clients disable row level security;
create index if not exists idx_clients_name on clients(name);

-- ============================================================
-- 전시목록(Exhibition List) — 전시회 자체의 마스터 정보(장소/기간/주최사 등).
-- 프로젝트(wms_projects.exhibition)와는 이름으로 매칭되는 별도 참조 테이블이다.
-- ============================================================
create table if not exists exhibition_list (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  venue text,
  city text,
  country text,
  start_date date,
  end_date date,
  organizer text,
  official_contractor text,
  participants text,
  notes text,
  created_at timestamptz default now()
);
alter table exhibition_list disable row level security;
create index if not exists idx_exhibition_list_start_date on exhibition_list(start_date);

-- ============================================================
-- client-files 스토리지 버킷 anon 접근 허용 — 고객사 사업자등록증 업로드가
-- "new row violates row-level security policy" 오류로 실패하던 문제 수정.
-- project-files 등 기존 버킷과 동일하게 anon 역할에 대해 전체 허용한다.
-- ============================================================
drop policy if exists "client-files anon select" on storage.objects;
create policy "client-files anon select" on storage.objects
  for select using (bucket_id = 'client-files');

drop policy if exists "client-files anon insert" on storage.objects;
create policy "client-files anon insert" on storage.objects
  for insert with check (bucket_id = 'client-files');

drop policy if exists "client-files anon update" on storage.objects;
create policy "client-files anon update" on storage.objects
  for update using (bucket_id = 'client-files');

drop policy if exists "client-files anon delete" on storage.objects;
create policy "client-files anon delete" on storage.objects
  for delete using (bucket_id = 'client-files');

-- ============================================================
-- 견적단가 화면에서 기획사용/참가사용 품목을 짝지어 관리하기 위한 자기참조 컬럼.
-- 한쪽에 품목을 추가하면 반대쪽에도 동일 항목이 생성되고, 분류/품목명/상세내용/
-- 단위/실행단가는 서로 동기화되며 견적단가(판매가)만 각자 별도로 입력한다.
-- ============================================================
alter table item_master add column if not exists paired_item_id uuid references item_master(id) on delete set null;
