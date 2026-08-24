-- ─────────────────────────────────────────────────────────────
-- 거래처(발주처)에도 고객사와 동일하게 사업자등록증 첨부를 지원한다.
-- ─────────────────────────────────────────────────────────────

alter table public.vendors add column if not exists business_reg_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-files', 'vendor-files', true, 20971520, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
