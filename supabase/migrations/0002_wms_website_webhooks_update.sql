-- ─────────────────────────────────────────────────────────────
-- clients / wms_projects 수정(UPDATE) 시에도 웹사이트로 반영되도록 확장.
-- 수신 측(웹사이트 /api/integrations/wms-*)은 이미 wms_client_id/wms_project_id
-- 기준 upsert/조회-후-업데이트 방식이라 INSERT든 UPDATE든 동일하게 처리되므로,
-- 여기서는 트리거가 update 이벤트에도 발동하도록만 바꾸면 된다.
-- ─────────────────────────────────────────────────────────────

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
    body := jsonb_build_object('type', TG_OP, 'table', 'clients', 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_website_client_created on public.clients;
drop trigger if exists trg_notify_website_client_upserted on public.clients;
create trigger trg_notify_website_client_upserted
  after insert or update on public.clients
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
    body := jsonb_build_object('type', TG_OP, 'table', 'wms_projects', 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_website_project_created on public.wms_projects;
drop trigger if exists trg_notify_website_project_upserted on public.wms_projects;
create trigger trg_notify_website_project_upserted
  after insert or update on public.wms_projects
  for each row execute function public.notify_website_project_created();
