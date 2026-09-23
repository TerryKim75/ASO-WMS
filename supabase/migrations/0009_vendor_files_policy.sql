-- ─────────────────────────────────────────────────────────────
-- vendor-files 버킷은 0006에서 생성만 되고 업로드(insert/update)를 허용하는
-- 정책이 빠져있어 사업자등록증 첨부가 "new row violates row-level security
-- policy" 오류로 항상 실패하고 있었다(0007의 purchase-order-files와 동일한
-- 원인). client-files/project-files/purchase-order-files와 동일하게 열어준다.
-- 통장사본 첨부를 위한 컬럼도 함께 추가한다.
-- ─────────────────────────────────────────────────────────────

alter table public.vendors add column if not exists bank_account_url text;

drop policy if exists "anon insert vendor-files" on storage.objects;
create policy "anon insert vendor-files" on storage.objects for insert
  with check (bucket_id = 'vendor-files');

drop policy if exists "anon update vendor-files" on storage.objects;
create policy "anon update vendor-files" on storage.objects for update
  using (bucket_id = 'vendor-files');
