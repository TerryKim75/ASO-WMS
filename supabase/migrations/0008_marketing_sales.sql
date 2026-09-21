-- Marketing research is versioned in public/marketing/research.json.
-- CRM state uses durable company keys, not spreadsheet row numbers.
-- Access follows this WMS's existing anon/authenticated shared workspace model.
begin;
create table if not exists public.marketing_leads (
  company_key text primary key check (company_key ~ '^[a-f0-9]{32}$'),
  company_name text not null check (length(company_name) between 1 and 300),
  source_company_id text not null,
  dataset_version text not null,
  stage text not null default '미접촉' check (stage in ('미접촉','접촉 예정','연락 완료','상담 중','견적 제안','수주','보류','수신거부')),
  owner text not null default '' check (length(owner) <= 200),
  priority text not null default '보통' check (priority in ('높음','보통','낮음')),
  next_contact_date date,
  notes text not null default '' check (length(notes) <= 10000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.marketing_activities (
  id uuid primary key default gen_random_uuid(),
  company_key text not null references public.marketing_leads(company_key),
  body text not null check (length(body) between 1 and 5500),
  actor text not null default '', kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists marketing_followup_idx on public.marketing_leads(next_contact_date);
create index if not exists marketing_activity_company_idx on public.marketing_activities(company_key, created_at desc);
alter table public.marketing_leads enable row level security;
alter table public.marketing_activities enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='marketing_leads' and policyname='marketing_workspace_read') then
    create policy marketing_workspace_read on public.marketing_leads for select to anon, authenticated using (true);
    create policy marketing_workspace_insert on public.marketing_leads for insert to anon, authenticated with check (true);
    create policy marketing_workspace_update on public.marketing_leads for update to anon, authenticated using (true) with check (true);
    create policy marketing_activity_read on public.marketing_activities for select to anon, authenticated using (true);
    create policy marketing_activity_insert on public.marketing_activities for insert to anon, authenticated with check (true);
  end if;
end $$;
grant select, insert, update on public.marketing_leads to anon, authenticated;
grant select, insert on public.marketing_activities to anon, authenticated;

create or replace function public.marketing_save_lead(
  p_company_key text, p_company_name text, p_source_company_id text, p_dataset_version text,
  p_stage text, p_owner text, p_priority text, p_next_contact_date date,
  p_notes text, p_expected_revision integer, p_activity text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare old_row public.marketing_leads; saved public.marketing_leads; activity_body text;
begin
  if p_expected_revision < 0 or p_expected_revision is null or p_company_key is null then
    raise exception 'Invalid marketing revision or key';
  end if;
  if length(coalesce(p_activity,'')) > 5000 then raise exception 'Activity is too long'; end if;
  perform pg_advisory_xact_lock(hashtextextended('marketing-lead:' || p_company_key, 0));
  select * into old_row from public.marketing_leads where company_key=p_company_key;
  if coalesce(old_row.revision,0) <> p_expected_revision then raise exception 'MARKETING_CONFLICT'; end if;
  insert into public.marketing_leads(company_key,company_name,source_company_id,dataset_version,stage,owner,priority,next_contact_date,notes,revision,updated_at)
  values(p_company_key,p_company_name,p_source_company_id,p_dataset_version,p_stage,coalesce(p_owner,''),p_priority,p_next_contact_date,coalesce(p_notes,''),p_expected_revision+1,now())
  on conflict (company_key) do update set company_name=excluded.company_name,source_company_id=excluded.source_company_id,
    dataset_version=excluded.dataset_version,stage=excluded.stage,owner=excluded.owner,priority=excluded.priority,
    next_contact_date=excluded.next_contact_date,notes=excluded.notes,revision=excluded.revision,updated_at=excluded.updated_at
  returning * into saved;
  activity_body := coalesce(old_row.stage,'신규') || ' → ' || saved.stage;
  if nullif(btrim(p_activity),'') is not null then activity_body := activity_body || E'\n' || btrim(p_activity); end if;
  insert into public.marketing_activities(company_key,body,actor,kind)
  values(p_company_key,activity_body,coalesce(p_owner,''),case when p_expected_revision=0 then '영업 등록' else '영업 기록' end);
  return to_jsonb(saved);
end $$;
revoke all on function public.marketing_save_lead(text,text,text,text,text,text,text,date,text,integer,text) from public;
grant execute on function public.marketing_save_lead(text,text,text,text,text,text,text,date,text,integer,text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
