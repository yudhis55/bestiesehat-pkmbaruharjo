// supabase/functions/create-user/index.ts — Edge Function admin-only pembuat akun.
//
// KONTRAK I/O (dipakai Task 4c menggantikan alur outbox fase-1 signUp→signOut→flush,
// ditambah aksi set-password Task 11):
//   Request  (POST, JSON) salah satu dari:
//   A. create: { username, password, name, role, school_id, is_active }
//     - username:  string non-empty (dinormalisasi trim+lowercase di sini)
//     - password:  string, min 6 karakter
//     - name:      string non-empty
//     - role:      'admin' | 'koordinator'
//     - school_id: string uuid (wajib iff role='koordinator', null untuk admin)
//     - is_active: boolean (default true bila dihilangkan)
//   B. set-password: { action: 'set-password', user_id, password }
//     - user_id:   string uuid auth-user target
//     - password:  string, min 6 karakter (baru; tidak pernah di-log)
//   C. delete-user: { action: 'delete-user', user_id }
//     - user_id:   string uuid auth-user target
//     - Urutan: hapus baris profiles dulu (abort bila gagal), lalu
//       auth.admin.deleteUser. FK hanya auth.users→profiles ON DELETE
//       CASCADE (0001_profiles.sql), jadi hapus-auth-dulu TIDAK dipakai:
//       kontrak Task 2 menetapkan profile-dulu agar kegagalan profiles
//       tidak meninggalkan auth yatim yang masih bisa login.
//     - Edge: bila auth delete gagal SETELAH profile terhapus, kembalikan
//       500 ("Gagal menghapus akun...") — login yatim tanpa profil tersisa
//       dan admin harus coba lagi / bersihkan via Dashboard.
//   Success create (201): { id: "<auth-user-uuid>" }
//   Success set-password (200): { ok: true }
//   Success delete-user (200): { ok: true }
//   Errors: { error: "<pesan generik Bahasa Indonesia>" }
//     - 400 validasi / body bukan JSON
//     - 401 tanpa/abrasi JWT tidak valid
//     - 403 pemanggil bukan admin aktif
//     - 409 username sudah dipakai (create saja)
//     - 500 kegagalan server (tanpa bocor stack)
//
// URUTAN WAJIB: parse JSON → verifikasi JWT → cek admin (service_role)
//   → cabang aksi (create: auth.admin.createUser → insert profiles;
//     set-password: auth.admin.updateUserById;
//     delete-user: delete profiles → auth.admin.deleteUser).
// Cek admin SELALU sebelum efek samping apa pun, di KEDUA jalur. Klaim role dari body client
// TIDAK PERNAH dipercaya — satu-satunya gate adalah baris profiles pemanggil.
//
// Validasi disengaja mirror Users.tsx (client+server harus sepakat):
//   Users.tsx: nama+username wajib isi, koordinator wajib pilih sekolah,
//   username unik. Di sini ditambah batas password min 6 (aturan Auth).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// KEEP IN SYNC dengan SYNTHETIC_DOMAIN di src/lib/supabase.ts
// (email sintetis = <username-lowercase>@<domain-ini>; JANGAN bikin skema kedua).
const SYNTHETIC_DOMAIN = "bestie-sehat.local";

// Header CORS default template Supabase. Origin dibiarkan '*' mengikuti
// template resmi karena function dipanggil dari browser app; bila nantinya
// butuh pengetatan, ganti dengan allowlist asal APP_URL.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "koordinator";

interface CreateUserBody {
  username?: unknown;
  password?: unknown;
  name?: unknown;
  role?: unknown;
  school_id?: unknown;
  is_active?: unknown;
}

interface SetPasswordBody {
  action?: unknown;
  user_id?: unknown;
  password?: unknown;
}

interface DeleteUserBody {
  action?: unknown;
  user_id?: unknown;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Pesan generik aman (Indonesia), tanpa stack/error internal.
const ERR = {
  badJson: "Body harus JSON valid.",
  username: "Username wajib diisi.",
  password: "Kata sandi minimal 6 karakter.",
  name: "Nama wajib diisi.",
  role: "Peran tidak valid.",
  schoolRequired: "Mohon pilih sekolah ampuan.",
  unauthorized: "Sesi tidak valid. Silakan login ulang.",
  forbidden: "Hanya admin yang dapat membuat akun.",
  forbiddenDelete: "Hanya admin yang dapat menghapus akun.",
  duplicate: "Username sudah digunakan.",
  createFailed: "Gagal membuat akun. Coba lagi.",
  profileFailed: "Gagal menyimpan profil akun.",
  userId: "ID pengguna tidak valid.",
  updateFailed: "Gagal memperbarui kata sandi. Coba lagi.",
  deleteFailed: "Gagal menghapus akun. Coba lagi.",
  config: "Konfigurasi server belum lengkap.",
} as const;

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: ERR.badJson }, 400);
  }

  // ── 1. Parse JSON (tanpa validasi spesifik-aksi dulu) ────────────────────
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: ERR.badJson }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  // SERVICE_ROLE_KEY HANYA dibaca dari env function (diset via
  // `supabase secrets set`); tidak pernah di-hardcode.
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: ERR.config }, 500);
  }

  // ── 2. Verifikasi JWT pemanggil ────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (jwt === "") {
    return jsonResponse({ error: ERR.unauthorized }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: callerData, error: callerError } = await userClient.auth
    .getUser(jwt);
  if (callerError || !callerData.user) {
    return jsonResponse({ error: ERR.unauthorized }, 401);
  }

  // ── 3. Cek admin via service_role SEBELUM efek samping ─────────────────────
  // TIDAK PERNAH percaya klaim role dari body — gate satu-satunya adalah
  // baris profiles pemanggil di database.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", callerData.user.id)
    .single();
  if (
    profileError || !callerProfile || callerProfile.role !== "admin" ||
    callerProfile.is_active !== true
  ) {
    // Pesan 403 sadar-aksi: pemanggil delete-user yang bukan admin aktif
    // mendapat pesan hapus (bukan pesan buat) — tanpa membocorkan apa pun.
    const isDeleteCall = (raw as DeleteUserBody).action === "delete-user";
    return jsonResponse(
      { error: isDeleteCall ? ERR.forbiddenDelete : ERR.forbidden },
      403,
    );
  }

  // ── 4. Cabang set-password (admin sudah terverifikasi di atas) ─────────────
  // request: { action: 'set-password', user_id, password }
  if ((raw as SetPasswordBody).action === "set-password") {
    const body = raw as SetPasswordBody;
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (userId === "" || !isValidUuid(userId)) {
      return jsonResponse({ error: ERR.userId }, 400);
    }
    if (typeof body.password !== "string" || body.password.length < 6) {
      return jsonResponse({ error: ERR.password }, 400);
    }
    const { error: updateError } = await adminClient.auth.admin
      .updateUserById(userId, { password: body.password });
    if (updateError) {
      return jsonResponse({ error: ERR.updateFailed }, 500);
    }
    return jsonResponse({ ok: true }, 200);
  }

  // ── 4b. Cabang delete-user (admin sudah terverifikasi di atas) ─────────────
  // request: { action: 'delete-user', user_id }
  // Urutan WAJIB profile-dulu-lalu-auth: FK profiles→auth TIDAK ada cascade
  // (hanya auth.users→profiles ON DELETE CASCADE di 0001_profiles.sql), jadi
  // hapus baris profiles dulu; bila gagal, batalkan SEBELUM menyentuh Auth
  // agar tidak ada login yatim yang masih bisa sign-in. Bila auth delete
  // gagal SETELAH profile terhapus, kembalikan 500 — login yatim tanpa
  // profil tersisa, admin perlu coba lagi / bersihkan via Dashboard.
  if ((raw as DeleteUserBody).action === "delete-user") {
    const body = raw as DeleteUserBody;
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (userId === "" || !isValidUuid(userId)) {
      return jsonResponse({ error: ERR.userId }, 400);
    }
    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileDeleteError) {
      return jsonResponse({ error: ERR.deleteFailed }, 500);
    }
    const { error: authDeleteError } = await adminClient.auth.admin
      .deleteUser(userId);
    if (authDeleteError) {
      return jsonResponse({ error: ERR.deleteFailed }, 500);
    }
    return jsonResponse({ ok: true }, 200);
  }

  // ── 5. Jalur create: validasi input (mirror Users.tsx) ─────────────────────
  const createBody = raw as CreateUserBody;
  const username = typeof createBody.username === "string"
    ? createBody.username.trim().toLowerCase()
    : "";
  if (username === "") {
    return jsonResponse({ error: ERR.username }, 400);
  }

  if (typeof createBody.password !== "string" || createBody.password.length < 6) {
    return jsonResponse({ error: ERR.password }, 400);
  }
  const password: string = createBody.password;

  const name = typeof createBody.name === "string" ? createBody.name.trim() : "";
  if (name === "") {
    return jsonResponse({ error: ERR.name }, 400);
  }

  if (createBody.role !== "admin" && createBody.role !== "koordinator") {
    return jsonResponse({ error: ERR.role }, 400);
  }
  const role: Role = createBody.role;

  // school_id wajib iff koordinator (mirror Users.tsx); admin selalu null.
  let schoolId: string | null = null;
  if (role === "koordinator") {
    if (
      typeof createBody.school_id !== "string" ||
      createBody.school_id.trim() === ""
    ) {
      return jsonResponse({ error: ERR.schoolRequired }, 400);
    }
    schoolId = createBody.school_id.trim();
    if (!isValidUuid(schoolId)) {
      return jsonResponse({ error: ERR.schoolRequired }, 400);
    }
  }

  const isActive = typeof createBody.is_active === "boolean"
    ? createBody.is_active
    : true;

  // ── 6. Buat auth user ─────────────────────────────────────────────────────
  const email = `${username}@${SYNTHETIC_DOMAIN}`;
  const { data: created, error: createError } = await adminClient.auth.admin
    .createUser({ email, password, email_confirm: true });
  if (createError || !created.user) {
    const msg = (createError?.message ?? "").toLowerCase();
    if (
      msg.includes("already") || msg.includes("exists") ||
      msg.includes("duplicate")
    ) {
      return jsonResponse({ error: ERR.duplicate }, 409);
    }
    return jsonResponse({ error: ERR.createFailed }, 500);
  }
  const newId = created.user.id;

  // Username unik di profiles juga dijaga constraint unique — lindungi dari
  // balapan: bila insert gagal, hapus auth user yatim (best-effort).
  const { error: insertError } = await adminClient.from("profiles").insert({
    id: newId,
    username,
    name,
    role,
    school_id: schoolId,
    is_active: isActive,
  });
  if (insertError) {
    await adminClient.auth.admin.deleteUser(newId);
    const msg = (insertError.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonResponse({ error: ERR.duplicate }, 409);
    }
    return jsonResponse({ error: ERR.profileFailed }, 500);
  }

  // ── 7. Kembalikan id ──────────────────────────────────────────────────────
  return jsonResponse({ id: newId }, 201);
});
