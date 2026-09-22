-- 0002_domain.sql — Supabase Fase Penuh: 5 tabel domain + RLS + FK.
--
-- CARA JALANKAN (USER, di SQL Editor sebagai postgres/service role):
--   1. Pastikan 0001_profiles.sql sudah jalan (tabel profiles + is_admin() ada).
--   2. Paste SELURUH isi file ini → Run. Idempoten sebagian: tabel memakai
--      `create table if not exists`, policy memakai `drop policy if exists`
--      sebelum `create policy` agar re-run aman.
--   3. Lanjut ke langkah Task 5 (tool migrasi di app) — JANGAN langsung ke
--      0003/0004. Urutan penuh ada di supabase/README.md.
--
-- KONTRAK KOLOM (mirror src/types.ts, snake_case di Postgres):
--   School:    id / name / address / coordinatorName->coordinator_name
--              / phone / type->type (check SD/SMP/SMA)
--   Student:   id / schoolId->school_id / name / gender (L/P)
--              / birthDate->birth_date / class / nik (unique)
--              / parentName->parent_name / whatsapp / address (jsonb:
--              rt/rw/desa/kecamatan/kabupaten/provinsi)
--              / studentIdNumber->student_id_number (nullable).
--              `age` TIDAK dipersist (dihitung saat render via
--              calculateAgeYears/Details dari birth_date).
--   Screening: id / studentId->student_id / schoolId->school_id
--              / academicYear->academic_year / date / entryDate->entry_date
--              / studentClass->student_class / studentGender->student_gender
--              / height / weight / bmi / physicalActivity->physical_activity
--              / visionLeft->vision_left / visionRight->vision_right
--              / hearingLeft->hearing_left / hearingRight->hearing_right
--              / dentalCaries->dental_caries
--              / dentalMouthHealth->dental_mouth_health
--              / bloodPressure->blood_pressure / bloodSugar->blood_sugar
--              / tbcScreening->tbc_screening / hepatitisB->hepatitis_b
--              / hepatitisC->hepatitis_c
--              / mentalHealthStatus->mental_health_status
--              / reproductiveHealth->reproductive_health
--              / smokingStatus->smoking_status
--              / immunizationHistory->immunization_history
--              / anemiaStatus->anemia_status / hbLevel->hb_level
--              / hbInterpretation->hb_interpretation / notes
--              / createdBy->created_by
--              / needsReferral->needs_referral
--              / referralDestination->referral_destination
--              / referralReason->referral_reason
--              / referralStatus->referral_status
--   TTD:       id / studentId->student_id / schoolId->school_id
--              / academicYear->academic_year / date
--              / tabletsReceived->tablets_received
--              / tabletsConsumed->tablets_consumed
--              / isCompliant->is_compliant / notes
--              / createdBy->created_by
--   Report:    id / schoolId->school_id / schoolName->school_name
--              (denormalisasi, mirror tipe Report)
--              / academicYear->academic_year / month / year
--              / entryDate->entry_date / totalStudents->total_students
--              / status (submitted/approved) / createdBy->created_by
--   Pemetaan camelCase↔snake_case dikerjakan di lapisan query aplikasi
--   (konsisten dengan fase 1), bukan di SQL ini.
--
-- STRATEGI profiles.school_id (TEXT lokal '1','2' → uuid):
--   File ini SENGAJA tidak menyentuh tabel profiles. Kolom transisi
--   `school_uuid` dibuat di 0003, diisi tool Task 5, lalu 0004 drop kolom
--   TEXT lama + rename. Policy koordinator di bawah membandingkan lewat
--   cast `::text` di kedua sisi, sehingga tetap benar SEBELUM (uuid::text
--   vs text) maupun SESUDAH (uuid::text vs uuid::text) finalisasi.
--
-- FK: semuanya `on delete restrict` — penghapusan berlapis dengan guard
--   anti-orphan di aplikasi (DB menolak bila guard app lolos). NEVER cascade.

create extension if not exists "pgcrypto";

-- ── schools ──────────────────────────────────────────────────────────────
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  coordinator_name text not null,
  phone text not null,
  type text not null check (type in ('SD','SMP','SMA')),
  created_at timestamptz not null default now()
);

-- ── students ─────────────────────────────────────────────────────────────
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  gender text not null check (gender in ('L','P')),
  birth_date date not null,
  class text not null,
  nik text unique not null,
  parent_name text not null,
  whatsapp text not null,
  address jsonb not null,
  student_id_number text,
  created_at timestamptz not null default now()
);

-- ── screenings ───────────────────────────────────────────────────────────
create table if not exists public.screenings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year text not null,
  date date not null,
  entry_date date,
  student_class text,
  student_gender text check (student_gender in ('L','P')),
  height numeric,
  weight numeric,
  bmi numeric,
  physical_activity text,
  vision_left text,
  vision_right text,
  hearing_left text,
  hearing_right text,
  dental_caries text,
  dental_mouth_health text,
  blood_pressure text,
  blood_sugar text,
  tbc_screening text,
  hepatitis_b text,
  hepatitis_c text,
  mental_health_status text,
  reproductive_health text,
  smoking_status text,
  immunization_history text,
  anemia_status text,
  hb_level numeric,
  hb_interpretation text,
  notes text,
  created_by uuid,
  needs_referral boolean not null default false,
  referral_destination text,
  referral_reason text,
  referral_status text check (referral_status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now()
);

-- ── ttd_compliance ───────────────────────────────────────────────────────
create table if not exists public.ttd_compliance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year text not null,
  date date not null,
  tablets_received integer not null default 0,
  tablets_consumed integer not null default 0,
  is_compliant boolean not null default false,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ── reports ──────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  school_name text not null,
  academic_year text not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  entry_date date,
  total_students integer not null default 0,
  status text not null check (status in ('submitted','approved')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ══ RLS ═══════════════════════════════════════════════════════════════════
-- RATIONALE anti-user_metadata (berlaku untuk SEMUA policy set di file ini):
--   RLS TIDAK BOLEH membaca app_metadata/user_metadata (mis.
--   auth.jwt() -> 'user_metadata' ->> 'role'). Pengguna terautentikasi dapat
--   mengubah metadata-nya sendiri via supabase.auth.updateUser({ data: ... }),
--   sehingga policy berbasis metadata = lubang eskalasi privilege. Sebagai
--   gantinya: admin dicek via public.is_admin() (SECURITY DEFINER, baca tabel
--   profiles — pola fase 1), dan cakupan koordinator dibaca dari baris
--   `profiles where id = auth.uid()` milik pemanggil sendiri. Kata
--   `user_metadata`/`app_metadata` di file ini HANYA muncul di komentar ini,
--   tidak pernah di logika policy.
--
-- ATURAN UMUM: setiap policy tulis koordinator memakai WITH CHECK yang
--   IDENTIK dengan USING-nya (tanpa itu, baris bisa ditulis lalu tak terbaca
--   / lolos ke sekolah lain — write leak).

alter table public.schools enable row level security;
alter table public.students enable row level security;
alter table public.screenings enable row level security;
alter table public.ttd_compliance enable row level security;
alter table public.reports enable row level security;

-- ── schools: admin penuh; koordinator READ miliknya saja (tanpa tulis) ──
drop policy if exists schools_admin_all on public.schools;
create policy schools_admin_all on public.schools
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists schools_koordinator_read on public.schools;
create policy schools_koordinator_read on public.schools
  for select using (
    id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

-- ── students: admin penuh; koordinator full atas sekolahnya ──────────────
drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists students_koordinator_all on public.students;
create policy students_koordinator_all on public.students
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

-- ── screenings: admin penuh; koordinator full atas sekolahnya ────────────
drop policy if exists screenings_admin_all on public.screenings;
create policy screenings_admin_all on public.screenings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists screenings_koordinator_all on public.screenings;
create policy screenings_koordinator_all on public.screenings
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

-- ── ttd_compliance: admin penuh; koordinator full atas sekolahnya ────────
drop policy if exists ttd_compliance_admin_all on public.ttd_compliance;
create policy ttd_compliance_admin_all on public.ttd_compliance
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ttd_compliance_koordinator_all on public.ttd_compliance;
create policy ttd_compliance_koordinator_all on public.ttd_compliance
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );

-- ── reports: admin penuh; koordinator full atas sekolahnya ───────────────
drop policy if exists reports_admin_all on public.reports;
create policy reports_admin_all on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_koordinator_all on public.reports;
create policy reports_koordinator_all on public.reports
  for all using (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  ) with check (
    school_id::text = (select p.school_id::text from public.profiles p where p.id = auth.uid())
  );
