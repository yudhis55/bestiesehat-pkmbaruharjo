-- 0011_ttd_docs_school_prefix.sql — FIX: koordinator tidak bisa VIEW foto TTD.
--
-- GEJALA (bug): koordinator bisa upload foto + baris tabel ttd_documentations
-- terbaca, tetapi galeri foto gagal ("Gagal memuat foto." via createSignedUrl
-- di TTDCompliance.tsx:662). Admin tidak terdampak.
--
-- DIAGNOSA — policy yang gagal: `ttd_docs_select` pada `storage.objects`
-- dalam bentuk SKEMA-SISWA (0008_ttd_documentations.sql:108-121):
--     ... or EXISTS (
--       select 1 from public.students s
--       where s.id::text = split_part(name, '/', 1)            -- segmen-1 = studentId
--       and s.school_id::text = (select p.school_id ... where p.id = auth.uid())
--     )
-- Sejak 0009 path upload berubah menjadi SKEMA-SEKOLAH
-- `{schoolId}/{epochMs}.webp` (TTDCompliance.tsx:836 — terverifikasi read-only,
-- tanpa edit source). Segmen pertama path kini UUID sekolah, TIDAK PERNAH UUID
-- siswa, sehingga lookup `students.id = segmen-1` SELALU kosong → USING = false
-- → createSignedUrl DITOLAK untuk koordinator. Admin lolos via
-- `public.is_admin()` (short-circuit), sehingga hanya koordinator yang gagal.
-- Uploads tetap jalan karena `ttd_docs_insert` sudah skema-sekolah; baris tabel
-- tetap terbaca karena `ttd_documentations_koordinator_all` (0008:78-86)
-- memeriksa kolom `school_id`, bukan path — tabel TIDAK perlu diubah.
--
-- FIX (file ini, SATU-SATUNYA perubahan): keempat policy storage
-- (insert/select/update/delete) ditulis ulang dengan SATU predikat seragam —
-- koordinator lolos bila segmen pertama path = school_id miliknya sendiri
-- (perbandingan LANGSUNG ke baris profiles pemanggil, tanpa join ke tabel
-- lookup). Predikat seragam insert==select==update==delete menjamin
-- upload⇔view tidak bisa drift asimetris lagi. Cabang legacy skema-siswa
-- dipertahankan (OR) agar foto lama `{studentId}/...` pra-0009 tetap bisa
-- dibaca koordinator sekolah pemiliknya. Bucket TETAP PRIVATE.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0010 sudah jalan, BERURUTAN:
--        0001_profiles.sql → 0002_domain.sql → 0003_school_uuid.sql →
--        0004_school_uuid_finalize.sql → 0005_academic_years.sql →
--        0006_hardening.sql → 0007_screening_new_fields.sql →
--        0008_ttd_documentations.sql → 0009_ttd_documentations_school_level.sql
--        → 0010_ttd_slot_dates.sql → 0011 (file ini).
--      URUTAN RUN SQL: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 →
--      0008 → 0009 → 0010 → 0011. Idempoten: `drop policy if exists` sebelum
--      `create policy` agar re-run aman. JANGAN re-run 0008/0009 setelah ini
--      (nama policy sama — akan mengembalikan predikat lama yang rusak).
--   2. Paste SELURUH isi file ini → Run.
--   3. Verifikasi:
--        select policyname from pg_policies
--        where schemaname = 'storage' and tablename = 'objects'
--        and policyname like 'ttd_docs_%' order by policyname;
--      Harus ada: ttd_docs_delete, ttd_docs_insert, ttd_docs_select,
--      ttd_docs_update (masing-masing tepat 1 baris).
--        select id, name, public from storage.buckets where id = 'ttd-docs';
--      Harus 1 baris, public = false (bucket PRIVATE — JANGAN ubah ke true).
--   4. Uji negatif RLS (sebagai koordinator sekolah A, via API dengan JWT-nya):
--        supabase.storage.from('ttd-docs').createSignedUrl('<schoolA>/....webp', 3600)
--      HARUS sukses (signedUrl kembali); untuk path '<schoolB>/....webp'
--      HARUS gagal (error RLS). Baris tabel sekolah B tetap tak terbaca
--      (policy tabel tak diubah) sehingga galeri A tak bisa menampilkan foto B.
--
-- RATIONALE anti-user_metadata (mirror 0002/0006/0008/0009): peran via
-- public.is_admin(), pemanggil-aktif via EXISTS profiles (JWT lama akun
-- nonaktif langsung mati), cakupan sekolah via school_id pada baris profiles
-- milik pemanggil sendiri; TIDAK PERNAH membaca auth.jwt() metadata. TIDAK
-- ADA join ke public.schools/students pada jalur utama (prefix langsung) —
-- akses storage tidak lagi bergantung pada visibilitas RLS tabel lookup.
--

-- ── ttd_docs_insert (WITH CHECK seragam) ─────────────────────────────────
drop policy if exists ttd_docs_insert on storage.objects;
create policy ttd_docs_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      -- Jalur utama skema-sekolah: segmen-1 path = school_id pemanggil.
      or split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      -- Kompat legacy skema-siswa pra-0009: segmen-1 = siswa milik sekolah pemanggil.
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

-- ── ttd_docs_select (USING seragam — INI policy yang diperbaiki) ──────────
drop policy if exists ttd_docs_select on storage.objects;
create policy ttd_docs_select on storage.objects
  for select to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      -- Jalur utama skema-sekolah: segmen-1 path = school_id pemanggil.
      or split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      -- Kompat legacy skema-siswa pra-0009: segmen-1 = siswa milik sekolah pemanggil.
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

-- ── ttd_docs_update (USING + WITH CHECK seragam) ──────────────────────────
drop policy if exists ttd_docs_update on storage.objects;
create policy ttd_docs_update on storage.objects
  for update to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  ) with check (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );

-- ── ttd_docs_delete (USING seragam) ───────────────────────────────────────
drop policy if exists ttd_docs_delete on storage.objects;
create policy ttd_docs_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );
