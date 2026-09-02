-- ─────────────────────────────────────────────────────────────
-- purchase-order-files 버킷은 이미 존재하고 공개 읽기는 되지만, 업로드(insert)를
-- 허용하는 정책이 빠져있어 발주서 파일 첨부가 "new row violates row-level
-- security policy" 오류로 항상 조용히 실패하고 있었다(화면엔 그냥 원상태로
-- 돌아간 것처럼 보임). client-files/project-files와 동일하게 열어준다.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "anon insert purchase-order-files" on storage.objects;
create policy "anon insert purchase-order-files" on storage.objects for insert
  with check (bucket_id = 'purchase-order-files');

drop policy if exists "anon update purchase-order-files" on storage.objects;
create policy "anon update purchase-order-files" on storage.objects for update
  using (bucket_id = 'purchase-order-files');
