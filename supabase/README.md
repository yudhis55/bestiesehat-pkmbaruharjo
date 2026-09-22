# Supabase — Fase 1 (Auth + profiles + RLS)

Fase ini hanya memindahkan lapisan **akun** ke Supabase. Data domain
(sekolah/siswa/skrining/TTD) tetap di localStorage. Login tetap pakai
**username** — aplikasi memetakannya ke email sintetis
`<username>@bestie-sehat.local` (lihat `SYNTHETIC_DOMAIN` di
`src/lib/supabase.ts`).

## 0. Prasyarat (sekali saja, di Dashboard)

1. Buka project Supabase → **Authentication → Sign In / Providers → Email**:
   pastikan provider **Email aktif** dan **Confirm email OFF** (nonaktifkan
   "Confirm email"). Jika konfirmasi email menyala, akun yang dibuat admin
   tidak bisa login sebelum verifikasi — tidak ada server email untuk domain
   sintetis `.local`.
2. Pastikan bisa membuka **SQL Editor** (untuk langkah 2 di bawah).

## 1. Urutan jalankan

1. **SQL Editor → New query → paste seluruh isi
   `supabase/migrations/0001_profiles.sql` → Run.** Ini membuat tabel
   `public.profiles`, fungsi `public.is_admin()`, dan 2 policy RLS
   (`profiles_read`, `profiles_admin_write`).
2. Buat **user auth admin pertama** (langkah 2 di bawah).
3. **INSERT baris profiles admin** (langkah 3 di bawah) — masih di SQL Editor,
   sebagai postgres sehingga bypass RLS.
4. Verifikasi: `select username, name, role, is_active from public.profiles;`
   harus menampilkan 1 baris admin.

## 2. Buat user auth pertama via Dashboard

1. Buka **Authentication → Users → Add user → Create new user**.
2. Isi:
   - **Email**: `admin@bestie-sehat.local`
   - **Password**: pilih password kuat, simpan di password manager
     (ini menggantikan `admin123` dari mock localStorage).
   - **Auto Confirm user**: **ON** (centang).
   - **User Metadata**: kosongkan.
3. Klik **Create user**, lalu salin **UID** user tersebut (kolom ID di daftar
   Users, format UUID). UID inilah yang dipakai di langkah 3.

## 3. INSERT baris profiles admin

Di **SQL Editor**, jalankan (ganti placeholder dengan UID asli):

```sql
insert into public.profiles (id, username, name, role, school_id, is_active)
values (
  'PASTE-UID-ADMIN-DI-SINI',  -- <-- ganti dengan UID dari langkah 2
  'admin',
  'Admin Puskesmas',
  'admin',
  null,
  true
);
```

Lalu login di aplikasi dengan username `admin` + password yang dipilih di
langkah 2.

## 4. Koordinator (2 akun seed)

Setelah Task 4 selesai, cara utama: login sebagai admin → menu
**Kelola Pengguna** → tambah user di aplikasi:

| username    | nama             | role        | school_id |
|-------------|------------------|-------------|-----------|
| koor_sdn01  | Koordinator SDN 01 | koordinator | 1         |
| koor_smpn01 | Koordinator SMPN 01 | koordinator | 2         |

(Email sintetis `koor_sdn01@bestie-sehat.local` /
`koor_smpn01@bestie-sehat.local` dibuat otomatis oleh aplikasi.)

**Fallback** (jika aplikasi belum mendukung tambah user): ulangi langkah
2–3 via Dashboard untuk tiap koordinator — Add user dengan email sintetis di
atas + Auto Confirm ON, lalu INSERT profiles dengan `role = 'koordinator'`
dan `school_id` sesuai tabel.

## Catatan

- `school_id` bertipe **TEXT** (id localStorage `'1'`, `'2'`, …). FK ke tabel
  `schools` baru datang di fase penuh — jangan menambahkannya di sini.
- Jangan menaruh `role` di user_metadata — RLS membaca tabel `profiles` via
  `is_admin()`, bukan metadata (lihat komentar di file SQL).

---

# Supabase — Fase Penuh (Domain + RLS + Migrasi ID)

Bagian di atas (Fase 1) tetap berlaku apa adanya. Bagian ini mengatur
pemindahan data domain (sekolah/siswa/skrining/TTD/laporan) ke Postgres.

## Urutan jalankan (WAJIB berurutan)

> Local `school_id` adalah TEXT (`'1'`, `'2'`, …) sedangkan Postgres memakai
> `uuid`. Karena itu kolom profiles tidak di-`ALTER TYPE` langsung (nilainya
> bukan uuid) — melainkan kolom baru → backfill → drop+rename.

1. **SQL Editor → New query → paste seluruh isi
   `supabase/migrations/0002_domain.sql` → Run.** Membuat 5 tabel
   (`schools`, `students`, `screenings`, `ttd_compliance`, `reports`) + RLS
   + FK `on delete restrict`. Tabel `profiles` TIDAK disentuh file ini.
2. **(Task 5 — di aplikasi)** Tool migrasi admin: memasukkan baris `schools`
   (uuid baru) + seluruh data domain dengan FK yang sudah dipetakan ulang.
3. **SQL Editor → New query → paste seluruh isi
   `supabase/migrations/0003_school_uuid.sql` → Run.** Menambah kolom
   transisi `profiles.school_uuid uuid refs schools(id)` (aditif; kolom TEXT
   lama masih ada).
4. **(Task 5 — di aplikasi)** Backfill: isi `profiles.school_uuid` tiap
   koordinator dari peta id lokal TEXT → uuid schools. Verifikasi:
   `select username, school_id, school_uuid from public.profiles;`
   (koordinator wajib terisi semua).
5. **SQL Editor → New query → paste seluruh isi
    `supabase/migrations/0004_school_uuid_finalize.sql` → Run.** File ini
    punya guard: GAGAL bila masih ada koordinator dengan `school_uuid` NULL.
    Bila sukses: drop kolom TEXT lama + rename `school_uuid` → `school_id`
    (kini bertipe uuid). Verifikasi:
    `select username, role, school_id from public.profiles;`
6. **SQL Editor → New query → paste seluruh isi
    `supabase/migrations/0005_academic_years.sql` → Run.** Membuat tabel
    `public.academic_years` + seed 5 label (aktif hanya `2024/2025`).
7. **SQL Editor → New query → paste seluruh isi
    `supabase/migrations/0006_hardening.sql` → Run.** Hardening
    pra-production: semua policy AND-ed dengan cek pemanggil aktif
    (`is_active`), dan `reports_koordinator_all` dipecah menjadi
    `reports_koordinator_select` + `reports_koordinator_insert` (koordinator
    tanpa update/delete; approve = admin-only). Idempoten (re-run aman).
