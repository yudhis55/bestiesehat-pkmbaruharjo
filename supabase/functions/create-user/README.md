# Edge Function `create-user` — pembuat akun + reset password + hapus akun tuntas (admin-only)

Fase-penuh menggantikan alur fase-1 (signUp → signOut → flush outbox di
`Users.tsx`) dengan pembuatan user server-side. Client (Task 4c) memanggil
function ini; RLS `profiles_admin_write` tetap menjadi penegak akhir di DB.
Task 11 menambah aksi `set-password` agar admin bisa mereset kata sandi
tanpa menulis password di client/localStorage.

Agen menulis file saja — **USER yang deploy via Supabase CLI** (agen tidak
punya akses CLI).

## Kontrak I/O (yang dikonsumsi Task 4c + Task 11)

### A. Buat akun

Request — `POST` JSON:

| Field      | Tipe              | Aturan                                              |
|------------|-------------------|-----------------------------------------------------|
| `username` | string            | wajib, non-empty; dinormalisasi trim + lowercase    |
| `password` | string            | wajib, min 6 karakter (tidak pernah di-log)         |
| `name`     | string            | wajib, non-empty                                    |
| `role`     | string            | wajib, `'admin'` \| `'koordinator'`                 |
| `school_id`| string \| null    | **wajib uuid iff** `role='koordinator'`; `null` untuk admin |
| `is_active`| boolean           | opsional, default `true`                            |

Email sintetis dibangun server-side:
`<username-lowercase>@bestie-sehat.local` — nilai domain disamakan dengan
`SYNTHETIC_DOMAIN` di `src/lib/supabase.ts` (lihat komentar sync di
`index.ts`). Klaim `role` dari body **tidak dipercaya**; gate satu-satunya
adalah baris `profiles` pemanggil (harus `role='admin'`, `is_active=true`),
dicek **sebelum** efek samping apa pun.

Response sukses — `201`:

```json
{ "id": "b3f0c9e2-1111-4222-8333-abcdef012345" }
```

Response gagal — `{ "error": "<pesan Bahasa Indonesia>" }`:

| Status | Arti                                     |
|--------|------------------------------------------|
| 400    | body bukan JSON / validasi gagal         |
| 401    | tanpa JWT / JWT tidak valid              |
| 403    | pemanggil bukan admin aktif              |
| 409    | username sudah dipakai                   |
| 500    | kegagalan server (tanpa bocor stack)     |

## Deploy (USER, butuh Supabase CLI + project ref)

Ganti placeholder `<...>` dengan nilai asli dari Dashboard
(Settings → API / Project Settings).

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY_DARI_DASHBOARD>
supabase functions deploy create-user
```

Catatan:

- `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sudah tersedia otomatis di env
  function; hanya `SERVICE_ROLE_KEY` yang perlu di-set manual.
- `SERVICE_ROLE_KEY` tidak pernah di-hardcode di repo — hanya dibaca dari
  env function (`Deno.env.get("SERVICE_ROLE_KEY")`).

## Uji dengan curl (butuh JWT admin)

Ambil `<ADMIN_JWT>` dengan login sebagai admin di app (DevTools →
`localStorage` → `sb-<ref>-auth-token` → `access_token`), lalu:

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/create-user" ^
  -H "apikey: <ANON_KEY>" ^
  -H "Authorization: Bearer <ADMIN_JWT>" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"koor_sdn02\",\"password\":\"rahasia123\",\"name\":\"Koordinator SDN 02\",\"role\":\"koordinator\",\"school_id\":\"<UUID_SEKOLAH>\",\"is_active\":true}"
```

(PowerShell: ganti `^` dengan backtick-line-continuation atau tulis satu
baris.)

Contoh sukses (`201`):

```json
{ "id": "b3f0c9e2-1111-4222-8333-abcdef012345" }
```

Contoh gagal:

```json
// 403 — token milik koordinator / non-admin:
{ "error": "Hanya admin yang dapat membuat akun." }

// 409 — username sudah dipakai:
{ "error": "Username sudah digunakan." }

// 400 — koordinator tanpa school_id:
{ "error": "Mohon pilih sekolah ampuan." }
```

### B. Reset kata sandi (`set-password`, Task 11)

Cek admin dilakukan **terlebih dahulu**, sama seperti jalur create (403 bila
pemanggil bukan admin aktif). Tidak ada secret/password yang di-log.

Request — `POST` JSON:

| Field      | Tipe   | Aturan                           |
|------------|--------|----------------------------------|
| `action`   | string | wajib, `'set-password'`          |
| `user_id`  | string | wajib, uuid auth-user target     |
| `password` | string | wajib, min 6 karakter (baru; tidak pernah di-log) |

Response sukses — `200`:

```json
{ "ok": true }
```

Response gagal — `{ "error": "<pesan Bahasa Indonesia>" }` (status 400 /
401 / 403 / 500 sama seperti tabel di atas; 409 hanya untuk jalur create):

| Status | Arti                                    |
|--------|-----------------------------------------|
| 400    | `user_id` bukan uuid / password < 6 karakter |
| 500    | `Gagal memperbarui kata sandi. Coba lagi.` |

Uji dengan curl (butuh JWT admin + `<USER_ID>` target):

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/create-user" ^
  -H "apikey: <ANON_KEY>" ^
  -H "Authorization: Bearer <ADMIN_JWT>" ^
  -H "Content-Type: application/json" ^
  -d "{\"action\":\"set-password\",\"user_id\":\"<USER_ID>\",\"password\":\"baru123\"}"
```

(PowerShell: ganti `^` dengan backtick-line-continuation atau tulis satu
baris.)

### C. Hapus akun tuntas (`delete-user`, Task 2)

Cek admin dilakukan **terlebih dahulu**, sama seperti jalur create dan
set-password (403 bila pemanggil bukan admin aktif). Tidak ada secret yang
di-log.

Urutan server: hapus baris `profiles` dulu — bila gagal, batalkan sebelum
menyentuh Auth; lalu `auth.admin.deleteUser(user_id)`. Urutan ini wajib
karena FK hanya `auth.users → profiles ON DELETE CASCADE`
(`0001_profiles.sql`): tidak ada cascade profiles → auth.

Edge yang didokumentasikan: bila hapus Auth gagal **setelah** baris profil
terhapus, function mengembalikan `500` (`Gagal menghapus akun. Coba lagi.`)
— login yatim tanpa profil tersisa; admin coba lagi / bersihkan via
Dashboard.

Request — `POST` JSON:

| Field     | Tipe   | Aturan                       |
|-----------|--------|------------------------------|
| `action`  | string | wajib, `'delete-user'`       |
| `user_id` | string | wajib, uuid auth-user target |

Response sukses — `200`:

```json
{ "ok": true }
```

Response gagal — `{ "error": "<pesan Bahasa Indonesia>" }` (status 400 /
401 / 403 / 500 sama seperti tabel di atas; 409 hanya untuk jalur create):

| Status | Arti                                              |
|--------|---------------------------------------------------|
| 400    | `user_id` bukan uuid                              |
| 403    | `Hanya admin yang dapat menghapus akun.`          |
| 500    | `Gagal menghapus akun. Coba lagi.`                |

Uji dengan curl (butuh JWT admin + `<USER_ID>` target):

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/create-user" ^
  -H "apikey: <ANON_KEY>" ^
  -H "Authorization: Bearer <ADMIN_JWT>" ^
  -H "Content-Type: application/json" ^
  -d "{\"action\":\"delete-user\",\"user_id\":\"<USER_ID>\"}"
```

(PowerShell: ganti `^` dengan backtick-line-continuation atau tulis satu
baris.)

Verifikasi tuntas: coba sign-in sebagai user yang dihapus — harus gagal.

## Redeploy (USER, setiap selesai ubah `index.ts`)

Agen hanya menulis file — **USER yang deploy ulang via Supabase CLI**:

```bash
supabase functions deploy create-user
```

Tanpa redeploy, function live masih versi lama dan aksi `delete-user`
belum tersedia (client mendapat error).
