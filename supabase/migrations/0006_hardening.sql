-- 0006_hardening.sql — Pra-production hardening: is_active di SEMUA policy + reports koordinator tanpa update/delete.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0005 sudah jalan (live project sudah menerapkannya).
--      File ini me-rewrite policy dari 0001 (profiles), 0002/0004 (domain,
--      bodi efektif pasca-0004), dan 0005 (academic_years).
--   2. Paste SELURUH isi file ini → Run. Idempoten: setiap CREATE didahului
--      `drop policy if exists` (TANPA cascade) sehingga re-run aman.
--   3. Verifikasi:
--        select policyname, cmd from pg_policies
--        where schemaname = 'public' order by tablename, policyname;
--      Harus ada: reports_koordinator_select + reports_koordinator_insert,
--      dan TIDAK ada lagi: reports_koordinator_all.
--   4. Uji kill JWT lama: login sebagai koordinator di satu sesi, lalu sebagai
--      admin set is_active=false untuk koordinator itu, lalu di sesi
--      koordinator jalankan `select * from public.schools;` dengan JWT lama —
--      harus 0 baris / ditolak (akses mati TANPA menunggu login ulang).
--
-- EFEK (intended kill): setiap policy kini AND-ed dengan pemeriksaan
--   pemanggil-aktif:
--     EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
--   sehingga akun yang dinonaktifkan (is_active=false) langsung kehilangan
--   SEMUA akses baca/tulis meski JWT-nya belum kedaluwarsa. JANGAN andalkan
--   user_metadata/app_metadata untuk ini (lihat RATIONALE di bawah).
--
-- RATIONALE anti-user_metadata (pola house, mirror 0001/0002/0005):
--   RLS TIDAK BOLEH membaca app_metadata/user_metadata (mis.
--   auth.jwt() -> 'user_metadata' ->> 'role' atau 'is_active'). Pengguna
--   terautentikasi dapat mengubah metadata-nya sendiri via
--   supabase.auth.updateUser({ data: ... }), sehingga policy berbasis metadata
--   = lubang eskalasi privilege (siapa pun bisa mengklaim role 'admin' atau
--   'active' kembali). Sebagai gantinya: peran dibaca via public.is_admin()
--   (SECURITY DEFINER, baca tabel profiles — pola fase 1, KONTRAK TIDAK
--   DIUBAH agar Task 2/3 tetap kompatibel), status aktif dibaca dari kolom
--   profiles.is_active milik pemanggil sendiri. Kata `user_metadata` /
--   `app_metadata` di file ini HANYA muncul di komentar ini, tidak pernah di
--   logika policy. TIDAK ada perubahan kolom profiles; TIDAK ada CASCADE.
--
-- CATATAN REKURSI (kenapa ada helper is_caller_active):
--   Policy tabel data (schools/students/...) memakai pemeriksaan inline
--   EXISTS(...) langsung — aman karena tabel yang dibaca (profiles) BERBEDA
--   dari tabel yang dilindungi. Tetapi policy di tabel profiles sendiri TIDAK
--   BOLEH memakai subquery inline ke public.profiles (tabel yang sama →
--   Postgres menolak dengan error "infinite recursion detected in policy").
--   Karena itu file ini mendefinisikan public.is_caller_active() sebagai
--   SECURITY DEFINER (men-bypass RLS seperti is_admin(), predikat SEMANTIK
--   IDENTIK dengan pemeriksaan inline) dan memakainya HANYA di kedua policy
--   profiles. Kontrak is_admin() TIDAK diubah.

-- ── 0. Helper pemanggil-aktif (SECURITY DEFINER, mirror gaya is_admin) ──
create or replace function public.is_caller_active() returns boolean
  language sql security definer set search_path = public stable as
  $$ select exists (select 1 from profiles where id = auth.uid() and is_active = true) $$;

-- ── 1. profiles: baca milik-sendiri/ admin + WAJIB pemanggil aktif ──
-- Bodi asal 0001: using (auth.uid() = id or is_admin())
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using ((auth.uid() = id or public.is_admin()) and public.is_caller_active());

-- Bodi asal 0001: for all using (is_admin()) with check (is_admin())
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin() and public.is_caller_active())
  with check (public.is_admin() and public.is_caller_active());

-- ── 2. schools: admin penuh + koordinator READ miliknya (bodi 0002/0004) ──
drop policy if exists schools_admin_all on public.schools;
create policy schools_admin_all on public.schools
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists schools_koordinator_read on public.schools;
create policy schools_koordinator_read on public.schools
  for select using (
    id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 3. students: admin penuh + koordinator full sekolahnya (bodi 0002/0004) ──
drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists students_koordinator_all on public.students;
create policy students_koordinator_all on public.students
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 4. screenings: admin penuh + koordinator full sekolahnya (bodi 0002/0004) ──
drop policy if exists screenings_admin_all on public.screenings;
create policy screenings_admin_all on public.screenings
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists screenings_koordinator_all on public.screenings;
create policy screenings_koordinator_all on public.screenings
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 5. ttd_compliance: admin penuh + koordinator full sekolahnya (bodi 0002/0004) ──
drop policy if exists ttd_compliance_admin_all on public.ttd_compliance;
create policy ttd_compliance_admin_all on public.ttd_compliance
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists ttd_compliance_koordinator_all on public.ttd_compliance;
create policy ttd_compliance_koordinator_all on public.ttd_compliance
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 6. reports: admin penuh (hardened) + koordinator DIPECAH select/insert ──
-- Admin: bodi asal 0002 using/with check (is_admin()), kini AND-ed aktif.
drop policy if exists reports_admin_all on public.reports;
create policy reports_admin_all on public.reports
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

-- Koordinator: reports_koordinator_all (FOR ALL, bodi 0002/0004) DIHAPUS —
-- koordinator TIDAK BOLEH update/delete laporan (approve = admin-only).
-- Diganti dua policy dengan predikat school-scope yang SAMA:
drop policy if exists reports_koordinator_all on public.reports;
drop policy if exists reports_koordinator_select on public.reports;
create policy reports_koordinator_select on public.reports
  for select using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

drop policy if exists reports_koordinator_insert on public.reports;
create policy reports_koordinator_insert on public.reports
  for insert with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 7. academic_years: kedua policy 0005 di-harden ──
-- Bodi asal 0005: for all using (is_admin()) with check (is_admin())
drop policy if exists academic_years_admin_all on public.academic_years;
create policy academic_years_admin_all on public.academic_years
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

-- Bodi asal 0005: for select using (true) — koordinator TETAP select-only,
-- kini wajib pemanggil aktif (anon / nonaktif tidak bisa membaca daftar).
drop policy if exists academic_years_koordinator_read on public.academic_years;
create policy academic_years_koordinator_read on public.academic_years
  for select using (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));
