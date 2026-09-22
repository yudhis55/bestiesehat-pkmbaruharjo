import { createClient } from '@supabase/supabase-js';
import type { User, UserRole } from '@/types';

export const SYNTHETIC_DOMAIN = 'bestie-sehat.local';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Add it to your .env file (see .env.example).'
  );
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY. Add it to your .env file (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function emailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${SYNTHETIC_DOMAIN}`;
}

export function usernameForEmail(email: string): string {
  const suffix = `@${SYNTHETIC_DOMAIN}`;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(suffix)) {
    return normalized.slice(0, -suffix.length);
  }
  return normalized;
}

export interface ProfileRow {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  school_id: string | null;
  is_active: boolean;
}

// Satu-satunya titik pemetaan snake_case (profiles) -> camelCase (User lama).
// Password tidak pernah disimpan di sini (dipegang Supabase Auth); diisi '' agar
// bentuk sesi lama tetap valid secara tipe.
export function profileToUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    username: profile.username,
    password: '',
    name: profile.name,
    role: profile.role,
    schoolId: profile.school_id ?? undefined,
    isActive: profile.is_active,
  };
}
