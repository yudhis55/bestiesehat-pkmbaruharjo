-- 0009_ttd_documentations_school_level.sql — Foto TTD pindah ke SCHOOL LEVEL.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0008 sudah jalan, BERURUTAN:
--        0001_profiles.sql → 0002_domain.sql → 0003_school_uuid.sql →
--        0004_school_uuid_finalize.sql → 0005_academic_years.sql →
--        0006_hardening.sql → 0007_screening_new_fields.sql →
--        0008_ttd_documentations.sql → 0009 (file ini).
--   2. Paste SELURUH isi file ini → Run. Idempoten: `drop not null` aman
--      di-run ulang, policy memakai `drop policy if exists` sebelum
--      `create policy` agar re-run aman.
--   3. Verifikasi:
--        select column_name, is_nullable from information_schema.columns
--        where table_schema = 'public' and table_name = 'ttd_documentations'
--        and column_name = 'student_id';
--      Harus 1 baris, is_nullable = YES (kolom TIDAK di-drop — RLS/policy
--      lama yang masih menyebut student_id tetap valid).
--        select policyname from pg_policies
--        where schemaname = 'storage' and tablename = 'objects'
--        and policyname like 'ttd_docs_%' order by policyname;
--      Harus ada: ttd_docs_delete, ttd_docs_insert, ttd_docs_select, ttd_docs_update.
--
-- KONTRAK (mirror src/types.ts TTDDocumentation, snake_case di Postgres):
--   student_id NULLABLE (legacy, code berhenti menulis/membacanya),
--   school_id (uuid, FK schools), academic_year, photo_path (path object di
--   bucket privat `ttd-docs`, format BARU `{schoolId}/{epochMs}.webp`),
--   taken_at, created_by, created_at. Bucket TETAP PRIVATE — JANGAN ubah ke true.
--   Baris lama ber-path `{studentId}/...` tetap terbaca (select tidak
--   memeriksa path), upload BARU memakai segmen pertama = schools.id.
--
-- ── 1. student_id → nullable (DO NOT drop kolom) ──────────────────────────
alter table public.ttd_documentations alter column student_id drop not null;

-- ── 2. RLS storage.objects: segmen pertama path = schools.id ──────────────
-- Koordinator: segmen pertama path harus = school_id miliknya sendiri.
-- Admin: lewat public.is_admin(). Pola guard pemanggil-aktif mirror 0006/0008.
drop policy if exists ttd_docs_insert on storage.objects;
create policy ttd_docs_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.schools sch
        where sch.id::text = split_part(name, '/', 1)
        and sch.id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

drop policy if exists ttd_docs_select on storage.objects;
create policy ttd_docs_select on storage.objects
  for select to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.schools sch
        where sch.id::text = split_part(name, '/', 1)
        and sch.id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

drop policy if exists ttd_docs_update on storage.objects;
create policy ttd_docs_update on storage.objects
  for update to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.schools sch
        where sch.id::text = split_part(name, '/', 1)
        and sch.id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  ) with check (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.schools sch
        where sch.id::text = split_part(name, '/', 1)
        and sch.id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

drop policy if exists ttd_docs_delete on storage.objects;
create policy ttd_docs_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.schools sch
        where sch.id::text = split_part(name, '/', 1)
        and sch.id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );
