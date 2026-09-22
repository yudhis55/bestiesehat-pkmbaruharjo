-- 0003_school_uuid.sql — Fase Penuh langkah 2/3: kolom transisi profiles.school_uuid.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0002_domain.sql sudah jalan (tabel schools ada) DAN tool
--      migrasi Task 5 sudah selesai memasukkan baris schools (uuid baru).
--   2. Paste SELURUH isi file ini → Run. Aman di-re-run (`add column
--      if not exists`).
--   3. JANGAN lanjut ke 0004 dulu — tool backfill Task 5 mengisi kolom ini
--      dari peta id lokal TEXT → uuid schools. Verifikasi:
--      `select username, school_id, school_uuid from public.profiles;`
--      (setiap koordinator harus punya school_uuid terisi).
--
-- MENGAPA KOLOM BARU, BUKAN ALTER TYPE LANGSUNG:
--   profiles.school_id fase-1 bertipe TEXT berisi id localStorage ('1','2',…).
--   Nilai itu BUKAN uuid, jadi `alter column ... type uuid` akan gagal
--   (invalid input syntax). Kolom `school_uuid` menampung hasil pemetaan
--   ulang; kolom TEXT lama di-drop di 0004 setelah backfill terbukti.
--
-- File ini ADITIF: tidak mengubah/menghapus kolom atau policy yang ada.

alter table public.profiles
  add column if not exists school_uuid uuid references public.schools(id) on delete restrict;
