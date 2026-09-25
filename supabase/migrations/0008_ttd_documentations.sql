-- 0008_ttd_documentations.sql — Dokumentasi foto TTD non-harian (revisi pemeriksaan/TTD).
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001–0007 sudah jalan.
--   2. Paste SELURUH isi file ini → Run. Idempoten: tabel memakai
--      `create table if not exists`, bucket memakai `on conflict do nothing`,
--      policy memakai `drop policy if exists` sebelum `create policy`
--      agar re-run aman.
--   3. Verifikasi:
--        select id, name, public from storage.buckets where id = 'ttd-docs';
--      Harus 1 baris, public = false (bucket PRIVATE — JANGAN ubah ke true).
--        select column_name, data_type from information_schema.columns
--        where table_schema = 'public' and table_name = 'ttd_documentations'
--        order by ordinal_position;
--      Harus: id(uuid), student_id(uuid), school_id(uuid), academic_year(text),
--      photo_path(text), taken_at(timestamptz), created_by(uuid), created_at(timestamptz).
--        select policyname, cmd from pg_policies
--        where schemaname = 'public' and tablename = 'ttd_documentations'
--        order by policyname;
--      Harus ada: ttd_documentations_admin_all + ttd_documentations_koordinator_all.
--        select policyname from pg_policies
--        where schemaname = 'storage' and tablename = 'objects'
--        and policyname like 'ttd_docs_%' order by policyname;
--      Harus ada: ttd_docs_delete, ttd_docs_insert, ttd_docs_select, ttd_docs_update.
--   4. Uji negatif RLS (sebagai koordinator sekolah A, via API dengan JWT-nya):
--        select * from public.ttd_documentations;
--      Hanya baris school_id = sekolah A yang kembali; baris sekolah B
--      TIDAK terbaca (tanpa baris foto sekolah B, app tidak bisa membuat
--      signed URL-nya — galeri koordinator A tidak akan menampilkan foto B).
--      Coba baca langsung object storage milik sekolah B via
--      supabase.storage.from('ttd-docs').createSignedUrl('<studentId-B>/....webp', 3600)
--      atau download — harus DITOLAK (policy ttd_docs_select memeriksa
--      schools.siswa pemilik path segmen pertama).
--
-- KONTRAK (mirror src/types.ts TTDDocumentation, snake_case di Postgres):
--   studentId->student_id (uuid, FK students), schoolId->school_id (uuid, FK
--   schools — pola SAMA seperti ttd_compliance di 0002_domain.sql:137-150),
--   academicYear->academic_year, photo_path (path object di bucket `ttd-docs`,
--   format `{studentId}/{epochMs}.webp`), taken_at (waktu foto diambil,
--   default now), createdBy->created_by (uuid auth, nullable), created_at.
-- Foto OPSIONAL dan NON-HARIAN — TIDAK ada FK/check ke ttd_compliance dan
-- TIDAK ada validasi silang (kompresi/upload murni di client).
--
-- STORAGE: bucket PRIVATE `ttd-docs` dibuat via SQL insert di bawah (pola
-- standar Supabase; setara pembuatan via Dashboard: Storage -> New bucket ->
-- Name `ttd-docs`, Private ON). TIDAK ADA base64 di DB — hanya photo_path.
-- RATIONALE anti-user_metadata (mirror 0002/0006): policy membaca peran via
-- public.is_admin() dan cakupan sekolah via baris profiles milik pemanggil
-- sendiri; TIDAK PERNAH membaca auth.jwt() metadata.

-- ── 0. Bucket privat (idempoten) ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ttd-docs', 'ttd-docs', false)
on conflict (id) do nothing;

-- ── 1. Tabel dokumentasi ──────────────────────────────────────────────────
create table if not exists public.ttd_documentations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year text not null,
  photo_path text not null,
  taken_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.ttd_documentations enable row level security;

-- ── 2. RLS tabel: admin penuh; koordinator full atas sekolahnya ───────────
-- (mirror ttd_compliance hardened 0006: setiap policy AND-ed dengan
-- pemeriksaan pemanggil-aktif agar JWT lama akun nonaktif langsung mati).
drop policy if exists ttd_documentations_admin_all on public.ttd_documentations;
create policy ttd_documentations_admin_all on public.ttd_documentations
  for all using (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  with check (public.is_admin() and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

drop policy if exists ttd_documentations_koordinator_all on public.ttd_documentations;
create policy ttd_documentations_koordinator_all on public.ttd_documentations
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
  );

-- ── 3. RLS storage.objects untuk bucket `ttd-docs` (bucket tetap PRIVATE) ──
-- Path object SELALU `{studentId}/{epochMs}.webp` (ditulis app setelah
-- kompresi WebP client-side; TIDAK PERNAH file mentah). Cakupan sekolah
-- ditegakkan lewat segmen pertama path = students.id → students.school_id
-- milik koordinator pemanggil. Admin lewat public.is_admin().
drop policy if exists ttd_docs_insert on storage.objects;
create policy ttd_docs_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ttd-docs'
    and EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true)
    and (
      public.is_admin()
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
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
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
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
      or EXISTS (
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
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
        select 1 from public.students s
        where s.id::text = split_part(name, '/', 1)
        and s.school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
      )
    )
  );
