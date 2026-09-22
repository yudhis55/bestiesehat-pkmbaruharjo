-- 0001_profiles.sql — Supabase Fase 1: tabel profiles + RLS (data domain tetap localStorage).
--
-- BOOTSTRAP CHICKEN-EGG (baca dulu sebelum Run):
--   RLS di bawah hanya mengizinkan admin menulis ke tabel ini, tetapi saat
--   project masih baru BELUM ADA baris admin sama sekali — jadi tidak ada
--   jalan bagi akun pertama untuk mendaftarkan dirinya sendiri lewat API.
--   Urutan yang benar:
--     1. Buat user auth pertama (admin) via Dashboard: Authentication -> Add user
--        (lihat supabase/README.md untuk email sintetis + password).
--     2. Jalankan file SQL ini di SQL Editor (sebagai postgres/service role,
--        sehingga BYPASS RLS — inilah satu-satunya cara memasukkan baris
--        admin pertama).
--     3. INSERT baris profiles admin dengan id = UID user auth dari langkah 1
--        (contoh INSERT ada di supabase/README.md).
--   Setelah baris admin pertama ada, semua tulis berikutnya lewat API
--   tunduk pada policy profiles_admin_write (admin saja).
--
-- RATIONALE is_admin() vs user_metadata:
--   RLS TIDAK BOLEH membaca app_metadata/user_metadata (mis.
--   auth.jwt() -> 'user_metadata' ->> 'role'). Pengguna terautentikasi dapat
--   mengubah metadata-nya sendiri via supabase.auth.updateUser({ data: ... }),
--   sehingga policy berbasis metadata = lubang eskalasi privilege (siapa pun
--   bisa mengklaim role 'admin'). Sebagai gantinya, peran dibaca dari tabel
--   profiles lewat fungsi SECURITY DEFINER ini: hanya pemilik tabel (postgres)
--   yang dievaluasi, bukan hak akses pemanggil, sehingga user biasa tidak bisa
--   memalsukan hasilnya.
--
-- Mirror dari src/types.ts User: username / name / role ('admin'|'koordinator')
--   / schoolId opsional / isActive. Kolom memakai snake_case Postgres
--   (school_id, is_active, created_at); pemetaan ke camelCase dilakukan di
--   lapisan query aplikasi (Task 3), bukan di sini.
--
-- Seed localStorage yang direplikasi (src/lib/storage.ts USERS_KEY):
--   admin       -> admin@bestie-sehat.local       (Admin Puskesmas, role admin)
--   koor_sdn01  -> koor_sdn01@bestie-sehat.local  (Koordinator SDN 01, school_id '1')
--   koor_smpn01 -> koor_smpn01@bestie-sehat.local (Koordinator SMPN 01, school_id '2')
--   Email sintetis mengikuti SYNTHETIC_DOMAIN='bestie-sehat.local' dari
--   src/lib/supabase.ts — jangan menciptakan skema mapping kedua.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  role text not null check (role in ('admin','koordinator')),
  school_id text, -- id sekolah localStorage ('1','2',...); FK ke tabel schools menyusul fase penuh
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
  language sql security definer set search_path = public stable as
  $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- baca: milik sendiri ATAU admin
create policy profiles_read on profiles for select using (auth.uid() = id or is_admin());

-- tulis: admin saja (insert/update/delete)
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());
