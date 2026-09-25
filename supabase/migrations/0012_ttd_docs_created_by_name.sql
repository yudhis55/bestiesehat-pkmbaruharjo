-- 0012_ttd_docs_created_by_name.sql — Snapshot nama pengunggah foto TTD.
--
-- GEJALA (bug): koordinator melihat pengunggah sebagai "Pengguna" pada galeri
-- foto TTD. RLS `profiles` hanya mengizinkan koordinator membaca barisnya
-- sendiri, sehingga lookup nama via `profiles` (TTDCompliance.tsx loadDocs)
-- mengembalikan subset — id pengunggah lain tidak terpetakan.
--
-- FIX (file ini, SATU-SATUNYA perubahan DDL): snapshot nama saat upload ke
-- kolom baru `ttd_documentations.created_by_name` (text, NULLABLE). Tanpa
-- perubahan RLS; baris lama (NULL) tetap memakai perilaku lama (map
-- uploaderNames -> currentUser -> 'Pengguna'). Code menulis
-- `created_by_name: currentUser.name` saat insert dan menampilkannya dengan
-- prioritas snapshot -> map -> 'Pengguna'.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0011 sudah jalan, BERURUTAN:
--        0001_profiles.sql → 0002_domain.sql → 0003_school_uuid.sql →
--        0004_school_uuid_finalize.sql → 0005_academic_years.sql →
--        0006_hardening.sql → 0007_screening_new_fields.sql →
--        0008_ttd_documentations.sql → 0009_ttd_documentations_school_level.sql
--        → 0010_ttd_slot_dates.sql → 0011_ttd_docs_school_prefix.sql → 0012
--        (file ini).
--      URUTAN RUN SQL: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 →
--      0008 → 0009 → 0010 → 0011 → 0012. Idempoten: `ADD COLUMN IF NOT
--      EXISTS` agar re-run aman.
--   2. Paste SELURUH isi file ini → Run.
--   3. Verifikasi:
--        select column_name, data_type from information_schema.columns
--        where table_schema = 'public' and table_name = 'ttd_documentations'
--        and column_name = 'created_by_name';
--      Harus 1 baris: created_by_name | text.
--
-- GRACEFUL DEGRADE: bila migrasi ini BELUM dijalankan, insert code otomatis
-- retry TANPA kolom baru (42703/created_by_name) — lihat handleUploadDoc di
-- TTDCompliance.tsx. Jadi urutan deploy aman dua arah.

alter table public.ttd_documentations
  add column if not exists created_by_name text;

comment on column public.ttd_documentations.created_by_name is
  'Snapshot nama pengunggah (currentUser.name saat upload); dibaca koordinator tanpa join profiles (RLS). Nullable: baris pra-0012 = NULL -> fallback lama.';
