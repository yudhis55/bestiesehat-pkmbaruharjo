-- 0010_ttd_slot_dates.sql — Kustomisasi tanggal slot mingguan TTD (persist layer).
--
-- KONSEP (user-approved): default Jumat per pekan SELALU dihitung client-side
-- (fridayDefaultsForMonth di TTDCompliance.tsx) dan TIDAK PERNAH disimpan.
-- Baris di tabel ini HANYA dibuat saat koordinator/admin mengkustomisasi
-- tanggal sebuah slot via SlotDatePicker; tanpa baris = fallback ke Jumat
-- default. Reset = DELETE baris tersebut (kembali ke Jumat default).
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0009 sudah jalan, BERURUTAN:
--        0001_profiles.sql → 0002_domain.sql → 0003_school_uuid.sql →
--        0004_school_uuid_finalize.sql → 0005_academic_years.sql →
--        0006_hardening.sql → 0007_screening_new_fields.sql →
--        0008_ttd_documentations.sql → 0009_ttd_documentations_school_level.sql
--        → 0010 (file ini).
--   2. Paste SELURUH isi file ini → Run. Idempoten: tabel memakai
--      `create table if not exists`, policy memakai `drop policy if exists`
--      sebelum `create policy` agar re-run aman.
--   3. Verifikasi:
--        select column_name, data_type from information_schema.columns
--        where table_schema = 'public' and table_name = 'ttd_slot_dates'
--        order by ordinal_position;
--      Harus: id(uuid), school_id(uuid), academic_year(text), month(integer),
--      week_index(integer), slot_date(date), created_by(uuid), created_at(timestamptz).
--        select policyname, cmd from pg_policies
--        where schemaname = 'public' and tablename = 'ttd_slot_dates'
--        order by policyname;
--      Harus ada: ttd_slot_dates_admin_all + ttd_slot_dates_koordinator_all.
--   4. Uji negatif RLS (sebagai koordinator sekolah A, via API dengan JWT-nya):
--        select * from public.ttd_slot_dates;
--      Hanya baris school_id = sekolah A yang kembali; baris sekolah B
--      TIDAK terbaca, dan upsert ke school_id sekolah B DITOLAK.
--
-- KONTRAK (mirror src/types.ts TTDSlotDate, snake_case di Postgres):
--   schoolId->school_id (uuid, FK schools — pola SAMA seperti ttd_compliance
--   di 0002_domain.sql:137-150), academicYear->academic_year,
--   month 1-12, week_index 1-4 (Pekan 1-4 = blok hari 1-7/8-14/15-21/22+),
--   slot_date (tanggal kustom YYYY-MM-DD — HARUS dalam bulan scope, ditegakkan
--   client via clamp [slotMin, slotMax]), createdBy->created_by (uuid auth,
--   nullable), created_at. UNIQUE(school_id, academic_year, month, week_index)
--   sehingga upsert per slot idempoten (satu baris per slot).
--
-- RATIONALE anti-user_metadata (mirror 0002/0006/0008): policy membaca peran
-- via public.is_admin() dan cakupan sekolah via baris profiles milik pemanggil
-- sendiri; TIDAK PERNAH membaca auth.jwt() metadata.
--
-- NOTE degradasi: kode mem-fallback ke default Jumat bila tabel belum ada
-- (error 42P01 → defaults, tanpa toast merah — mirror guard ttd_documentations).
-- Jadi migrasi ini BOLEH dijalankan kapan saja setelah 0009 tanpa merusak app
-- yang belum di-update, dan app baru tetap jalan bila 0010 belum dijalankan.
--
-- ── 1. Tabel kustomisasi ──────────────────────────────────────────────────
create table if not exists public.ttd_slot_dates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year text not null,
  month integer not null check (month between 1 and 12),
  week_index integer not null check (week_index between 1 and 4),
  slot_date date not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (school_id, academic_year, month, week_index)
);

alter table public.ttd_slot_dates enable row level security;

-- ── 2. RLS tabel: admin penuh; koordinator full atas sekolahnya ───────────
-- (mirror ttd_compliance hardened 0006: setiap policy AND-ed dengan
-- pemeriksaan pemanggil-aktif agar JWT lama akun nonaktif langsung mati;
-- WITH CHECK identik dengan USING agar baris tak bisa ditulis lalu lolos ke
-- sekolah lain — write leak).
drop policy if exists ttd_slot_dates_admin_all on public.ttd_slot_dates;
create policy ttd_slot_dates_admin_all on public.ttd_slot_dates
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists ttd_slot_dates_koordinator_all on public.ttd_slot_dates;
create policy ttd_slot_dates_koordinator_all on public.ttd_slot_dates
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );
