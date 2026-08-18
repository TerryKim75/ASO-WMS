-- ─────────────────────────────────────────────────────────────
-- ASO Website 연동: clients / wms_projects 신규 생성 시 웹사이트의
-- /api/integrations/wms-client, /api/integrations/wms-project 로
-- 비동기 HTTP POST를 보내 고객사·프로젝트를 자동 반영한다.
-- 기존 데이터/기능에는 영향 없음 — INSERT 시점에만 동작하는 신규 트리거.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_website_client_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://aso-system-website.vercel.app/api/integrations/wms-client',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wms-webhook-secret', '8a5b664e0842b8d9ceb7d151dc67ce1b7cc573a416f6a84325acdce1e854ab2d'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'clients', 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_website_client_created on public.clients;
create trigger trg_notify_website_client_created
  after insert on public.clients
  for each row execute function public.notify_website_client_created();

create or replace function public.notify_website_project_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://aso-system-website.vercel.app/api/integrations/wms-project',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-wms-webhook-secret', '8a5b664e0842b8d9ceb7d151dc67ce1b7cc573a416f6a84325acdce1e854ab2d'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'wms_projects', 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_website_project_created on public.wms_projects;
create trigger trg_notify_website_project_created
  after insert on public.wms_projects
  for each row execute function public.notify_website_project_created();
