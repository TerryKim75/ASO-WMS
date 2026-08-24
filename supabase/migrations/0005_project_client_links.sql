-- ─────────────────────────────────────────────────────────────
-- wms_projects.organizer / exhibitor는 지금까지 자유입력 텍스트라서, 고객관리(clients)의
-- 회사명과 글자가 한 글자라도 다르면(예: "아이엔크리에이티브" vs "아이엔크리에이티브 주식회사(I-N)")
-- 고객사 상세의 "관련 프로젝트"에 매칭되지 않는 문제가 있었다.
-- FK 컬럼을 추가해 이후 프로젝트 등록 시엔 텍스트가 아니라 고객사 id로 정확히 연결되게 하고,
-- 기존 프로젝트는 이름이 일치/포함되는 고객사를 찾아 최선으로 백필한다.
-- ─────────────────────────────────────────────────────────────

alter table public.wms_projects add column if not exists organizer_client_id uuid references public.clients(id) on delete set null;
alter table public.wms_projects add column if not exists exhibitor_client_id uuid references public.clients(id) on delete set null;

-- 백필: 정확히 일치하는 고객사를 우선하고, 없으면 고객사명이 organizer 텍스트를 포함하는
-- 경우(예: "아이엔크리에이티브 주식회사(I-N)"가 "아이엔크리에이티브"를 포함) 중 가장 이름이
-- 짧은(=가장 근접한) 고객사로 연결한다.
update public.wms_projects p
set organizer_client_id = (
  select c.id from public.clients c
  where c.name = p.organizer or c.name ilike '%' || p.organizer || '%'
  order by (c.name = p.organizer) desc, length(c.name) asc
  limit 1
)
where p.organizer_client_id is null
  and p.organizer is not null
  and p.organizer <> '';

update public.wms_projects p
set exhibitor_client_id = (
  select c.id from public.clients c
  where c.name = p.exhibitor or c.name ilike '%' || p.exhibitor || '%'
  order by (c.name = p.exhibitor) desc, length(c.name) asc
  limit 1
)
where p.exhibitor_client_id is null
  and p.exhibitor is not null
  and p.exhibitor <> '';
