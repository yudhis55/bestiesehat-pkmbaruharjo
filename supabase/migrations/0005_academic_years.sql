-- 0005_academic_years.sql — Master tahun ajaran + flag aktif (exactly-one-active di app).
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   Paste SELURUH isi file ini → Run. Idempoten: tabel memakai
--   `create table if not exists`, policy memakai `drop policy if exists`
--   sebelum `create policy`, seed memakai `on conflict do nothing` +
--   update kondisional agar re-run aman.
--
-- RATIONALE anti-user_metadata (pola house, mirror 0002_domain.sql):
--   RLS TIDAK BOLEH membaca app_metadata/user_metadata (mis.
--   auth.jwt() -> 'user_metadata' ->> 'role'). Pengguna terautentikasi dapat
--   mengubah metadata-nya sendiri via supabase.auth.updateUser({ data: ... }),
--   sehingga policy berbasis metadata = lubang eskalasi privilege. Sebagai
--   gantinya: admin dicek via public.is_admin() (SECURITY DEFINER, baca tabel
--   profiles — pola fase 1), dan koordinator hanya diberi SELECT agar daftar
--   filter global tahun ajaran tetap terbaca. Kata `user_metadata` /
--   `app_metadata` di file ini HANYA muncul di komentar ini, tidak pernah di
--   logika policy.

create extension if not exists "pgcrypto";

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.academic_years enable row level security;

-- Admin penuh (baca + tulis).
drop policy if exists academic_years_admin_all on public.academic_years;
create policy academic_years_admin_all on public.academic_years
  for all using (public.is_admin()) with check (public.is_admin());

-- Koordinator: SELECT-only (butuh daftar untuk filter global tahun ajaran).
drop policy if exists academic_years_koordinator_read on public.academic_years;
create policy academic_years_koordinator_read on public.academic_years
  for select using (true);

-- Seed idempoten: 5 label, aktif HANYA '2024/2025'.
insert into public.academic_years (label, is_active) values
  ('2023/2024', false),
  ('2024/2025', true),
  ('2025/2026', false),
  ('2026/2027', false),
  ('2027/2028', false)
on conflict (label) do nothing;

-- Tegakkan tepat-satu-aktif pada seed tanpa menimpa pilihan admin:
-- hanya set '2024/2025' aktif bila belum ada baris aktif sama sekali.
update public.academic_years set is_active = true where label = '2024/2025'
  and not exists (select 1 from public.academic_years where is_active = true);
