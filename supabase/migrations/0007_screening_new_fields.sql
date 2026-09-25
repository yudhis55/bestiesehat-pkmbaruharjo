-- 0007_screening_new_fields.sql — Tambah 5 kolom opsional skrining (revisi pemeriksaan/TTD).
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0006 sudah jalan.
--   2. Paste SELURUH isi file ini → Run. Idempoten: setiap ADD COLUMN memakai
--      `if not exists` sehingga re-run aman.
--   3. Verifikasi:
--        select column_name, data_type, is_nullable from information_schema.columns
--        where table_schema = 'public' and table_name = 'screenings'
--        and column_name in ('menstruasi','systolic_bp','diastolic_bp','bp_category','caries_count');
--      Harus 5 baris, semua is_nullable = 'YES'.
--
-- KONTRAK (mirror src/types.ts Screening, snake_case di Postgres):
--   menstruasi -> menstruasi (text, 'Sudah'/'Belum', check opsional)
--   systolicBP -> systolic_bp (integer)
--   diastolicBP -> diastolic_bp (integer)
--   bpCategory -> bp_category (text)
--   cariesCount -> caries_count (integer)
-- SEMUA NULLABLE (tanpa NOT NULL/DEFAULT) agar baris legacy tetap valid.
-- TIDAK menyentuh kolom lama, RLS, atau tabel lain.

alter table public.screenings
  add column if not exists menstruasi text check (menstruasi in ('Sudah', 'Belum'));

alter table public.screenings
  add column if not exists systolic_bp integer;

alter table public.screenings
  add column if not exists diastolic_bp integer;

alter table public.screenings
  add column if not exists bp_category text;

alter table public.screenings
  add column if not exists caries_count integer;
