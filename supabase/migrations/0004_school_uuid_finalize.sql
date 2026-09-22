-- 0004_school_uuid_finalize.sql — Fase Penuh langkah 3/3: finalisasi uuid.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. HANYA setelah backfill Task 5 terbukti: setiap baris profiles dengan
--      role koordinator HARUS punya school_uuid terisi. Cek dulu:
--        select username, role, school_id, school_uuid from public.profiles;
--      Jika ada koordinator dengan school_uuid NULL → BERHENTI, jangan
--      jalankan file ini; perbaiki backfill dulu (kolom lama masih ada).
--   2. Paste SELURUH isi file ini → Run. TIDAK bisa di-re-run apa adanya
--      (drop + rename sekali-jalan, by design).
--   3. Verifikasi akhir:
--        select username, role, school_id from public.profiles;
--      school_id kini bertipe uuid dan mereferensikan schools(id).
--
-- EFEK: drop kolom TEXT lama (id localStorage) → rename school_uuid menjadi
--   school_id. Policy domain memakai cast `::text` di kedua sisi sehingga
--   tetap benar sebelum maupun sesudah rename ini. Policy tabel
--   profiles sendiri (profiles_read / profiles_admin_write) tidak menyentuh
--   school_id sehingga tidak perlu diubah.
--
-- CATATAN DEPENDENSI: 5 policy koordinator di bawah membaca
--   profiles.school_id, sehingga Postgres menolak drop kolom (error 2BP01).
--   File ini me-drop ke-5 policy itu dulu, lalu membuatnya kembali IDENTIK
--   setelah rename (bodi memakai `::text` di kedua sisi → valid untuk
--   TEXT maupun uuid). JANGAN pakai CASCADE (akan menghapus policy tanpa
--   membuatnya kembali).

-- Guard: gagalkan eksekusi bila masih ada koordinator tanpa school_uuid.
do $$
begin
  if exists (
    select 1 from public.profiles
    where role = 'koordinator' and school_uuid is null
  ) then
    raise exception 'FINALIZE DIBATALKAN: masih ada koordinator dengan school_uuid NULL. Lengkapi backfill Task 5 dulu.';
  end if;
end $$;

-- 1. Lepas policy yang bergantung pada profiles.school_id.
drop policy if exists schools_koordinator_read on public.schools;
drop policy if exists students_koordinator_all on public.students;
drop policy if exists screenings_koordinator_all on public.screenings;
drop policy if exists ttd_compliance_koordinator_all on public.ttd_compliance;
drop policy if exists reports_koordinator_all on public.reports;

-- 2. Drop kolom TEXT lama → rename school_uuid menjadi school_id.
alter table public.profiles drop column school_id;
alter table public.profiles rename column school_uuid to school_id;

-- 3. Buat kembali ke-5 policy, bodi IDENTIK dengan 0002_domain.sql
--    (cast ::text valid untuk uuid maupun TEXT).
create policy schools_koordinator_read on public.schools
  for select using (
    id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

create policy students_koordinator_all on public.students
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

create policy screenings_koordinator_all on public.screenings
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

create policy ttd_compliance_koordinator_all on public.ttd_compliance
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

create policy reports_koordinator_all on public.reports
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );
