-- ─────────────────────────────────────────────────────────────
-- UPDATE 웹훅을 "웹사이트가 실제로 사용하는 필드가 바뀌었을 때만" 발동하도록 좁힌다.
-- (예: construction_staff, design_file_url 같은 PMS 내부 전용 필드 변경으로는 발동 안 함)
--
-- Postgres 트리거 WHEN절에서는 OLD를 INSERT와 함께 쓸 수 없으므로(INSERT엔 OLD가 없음),
-- INSERT용과 UPDATE용 트리거를 분리한다 — INSERT는 항상 발동, UPDATE는 WHEN조건으로 제한.
-- ─────────────────────────────────────────────────────────────

drop trigger if exists trg_notify_website_client_upserted on public.clients;

create trigger trg_notify_website_client_inserted
  after insert on public.clients
  for each row execute function public.notify_website_client_created();

create trigger trg_notify_website_client_updated
  after update on public.clients
  for each row
  when (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.contact_name IS DISTINCT FROM NEW.contact_name OR
    OLD.manager IS DISTINCT FROM NEW.manager OR
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.address IS DISTINCT FROM NEW.address OR
    OLD.notes IS DISTINCT FROM NEW.notes
  )
  execute function public.notify_website_client_created();

drop trigger if exists trg_notify_website_project_upserted on public.wms_projects;

create trigger trg_notify_website_project_inserted
  after insert on public.wms_projects
  for each row execute function public.notify_website_project_created();

create trigger trg_notify_website_project_updated
  after update on public.wms_projects
  for each row
  when (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.client IS DISTINCT FROM NEW.client OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.construction_date IS DISTINCT FROM NEW.construction_date OR
    OLD.end_date IS DISTINCT FROM NEW.end_date OR
    OLD.demolition_date IS DISTINCT FROM NEW.demolition_date OR
    OLD.exhibition IS DISTINCT FROM NEW.exhibition OR
    OLD.organizer IS DISTINCT FROM NEW.organizer OR
    OLD.exhibitor IS DISTINCT FROM NEW.exhibitor OR
    OLD.manager IS DISTINCT FROM NEW.manager
  )
  execute function public.notify_website_project_created();
