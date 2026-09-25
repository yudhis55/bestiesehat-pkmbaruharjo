/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { Sidebar } from '@/components/Sidebar';
import { Auth } from '@/components/Auth';
import { Toaster } from '@/components/ui/sonner';
import { HeaderLogosBanner } from '@/components/HeaderLogos';
import { Book, Pencil, GraduationCap, Backpack, Ruler } from 'lucide-react';
import type { User } from '@/types';
import { getSession, saveSession, clearSession } from '@/lib/storage';
import { supabase, profileToUser, type ProfileRow } from '@/lib/supabase';

const Dashboard = lazy(() => import('@/components/Dashboard').then((m) => ({ default: m.Dashboard })));
const Schools = lazy(() => import('@/components/Schools').then((m) => ({ default: m.Schools })));
const Students = lazy(() => import('@/components/Students').then((m) => ({ default: m.Students })));
const Screenings = lazy(() => import('@/components/Screenings').then((m) => ({ default: m.Screenings })));
const TTDComplianceMenu = lazy(() => import('@/components/TTDCompliance').then((m) => ({ default: m.TTDComplianceMenu })));
// TEMP: Reports import removed with hidden /laporan route — restore lazy Reports import to re-enable.
const Users = lazy(() => import('@/components/Users').then((m) => ({ default: m.Users })));
const AcademicYears = lazy(() => import('@/components/AcademicYears').then((m) => ({ default: m.AcademicYears })));

function TabFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 w-1/3 rounded-md bg-slate-200" />
      <div className="h-40 rounded-lg bg-slate-200" />
      <div className="h-24 rounded-lg bg-slate-200" />
    </div>
  );
}

// Tahun ajaran: fallback instan, dioverride cache lokal lalu sync DB.
// Profil segar tanpa cache ditahan year gate (TabFallback) sampai sync selesai.
const ACTIVE_YEAR_KEY = 'uks_active_year';
const FALLBACK_YEAR = '2024/2025';

function isValidYearLabel(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}\/\d{4}$/.test(value.trim());
}

function readCachedActiveYear(): string {
  try {
    const cached = localStorage.getItem(ACTIVE_YEAR_KEY);
    if (isValidYearLabel(cached)) return (cached as string).trim();
  } catch {
    // localStorage tidak tersedia — pakai fallback.
  }
  return FALLBACK_YEAR;
}

function persistActiveYear(label: string) {
  try {
    localStorage.setItem(ACTIVE_YEAR_KEY, label);
  } catch {
    // abaikan kegagalan persist (mis. mode privat) — state tetap jalan.
  }
}

// Cache hit = fast path (gate langsung lolos); cache kosong = gate menahan first paint.
function hasCachedActiveYear(): boolean {
  try {
    return isValidYearLabel(localStorage.getItem(ACTIVE_YEAR_KEY));
  } catch {
    return false;
  }
}

// Guard peran: koordinator (dan non-admin untuk /pengguna) dialihkan ke /pemeriksaan.
function RequireRole({ allow, children }: { allow: boolean; children: ReactNode }) {
  if (!allow) {
    return <Navigate to="/pemeriksaan" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getSession());
  const [academicYear, setAcademicYear] = useState(() => readCachedActiveYear());
  const [yearReady, setYearReady] = useState(() => hasCachedActiveYear());
  const navigate = useNavigate();

  // Setter yang sekaligus persist ke cache lokal agar login berikutnya langsung benar.
  const handleAcademicYearChange = (label: string) => {
    setAcademicYear(label);
    if (isValidYearLabel(label)) persistActiveYear(label.trim());
  };

  // Verifikasi cache sesi lokal terhadap sesi Supabase saat aplikasi dimuat.
  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      const authUserId = data.session?.user.id;
      if (!authUserId) {
        clearSession();
        if (!cancelled) {
          setCurrentUser(null);
        }
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, name, role, school_id, is_active')
        .eq('id', authUserId)
        .single();
      if (cancelled) {
        return;
      }
      if (profileError || !profile || profile.is_active === false) {
        await supabase.auth.signOut();
        clearSession();
        setCurrentUser(null);
        return;
      }
      const user = profileToUser(profile as ProfileRow);
      saveSession(user);
      setCurrentUser(user);
    };
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ref cermin academicYear untuk listener auth (hindari stale closure tanpa re-subscribe).
  const academicYearRef = useRef(academicYear);
  useEffect(() => {
    academicYearRef.current = academicYear;
  }, [academicYear]);

  // Tahun ajaran aktif: state diawali cache lokal (uks_active_year),
  // lalu sinkron ke baris is_active=true di tabel academic_years + persist cache.
  // Sync HANYA berjalan saat sesi terautentikasi (currentUser non-null): query
  // sebelum sesi Supabase tegak kena RLS (0 baris → 406) dan membuat fallback lengket.
  // Tanpa cache, gate (yearReady) menahan first paint sampai sync selesai —
  // children tidak pernah query dengan tahun fallback yang basi.
  // Timeout 3 dtk melepas gate agar DB hiccup tidak menggantung aplikasi.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setYearReady(true);
    }, 3000);
    const loadActiveYear = async () => {
      try {
        const { data, error } = await supabase
          .from('academic_years')
          .select('label')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (cancelled || error || !data) return;
        const label = (data as { label: unknown }).label;
        if (isValidYearLabel(label)) {
          const trimmed = label.trim();
          setAcademicYear(trimmed);
          persistActiveYear(trimmed);
        }
      } catch {
        // Gagal jaringan — gate dilepas oleh finally/timeout, state tetap fallback.
      } finally {
        if (!cancelled) {
          window.clearTimeout(timer);
          setYearReady(true);
        }
      }
    };
    void loadActiveYear();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentUser]);

  // Retry event-driven untuk race login-segar: sync pertama bisa lolos sebelum
  // sesi Supabase tegak (RLS → fallback lengket). Saat SIGNED_IN/TOKEN_REFRESHED
  // tiba dan tahun masih fallback/invalid, sync ulang sekali. Tanpa polling.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') return;
      const current = academicYearRef.current;
      if (isValidYearLabel(current) && current.trim() !== FALLBACK_YEAR) return;
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('academic_years')
            .select('label')
            .eq('is_active', true)
            .limit(1)
            .single();
          if (error || !data) return;
          const label = (data as { label: unknown }).label;
          if (isValidYearLabel(label)) {
            const trimmed = label.trim();
            setAcademicYear(trimmed);
            persistActiveYear(trimmed);
          }
        } catch {
          // Gagal jaringan — gate dilepas oleh finally, state tetap fallback.
        } finally {
          setYearReady(true);
        }
      })();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Year gate: hanya untuk sesi login; layar Auth tidak ditahan sync tahun.
  if (currentUser && !yearReady) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
        <TabFallback />
        <Toaster />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Auth onLogin={(u) => { setCurrentUser(u); navigate('/dashboard'); }} />
        <Toaster />
      </>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearSession();
    setCurrentUser(null);
  };

  const isKoordinator = currentUser.role === 'koordinator';
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50/50 relative overflow-hidden">
      {/* Global School Decorations */}
      <div className="fixed top-20 right-10 text-primary/5 -rotate-12 pointer-events-none">
        <Book size={200} />
      </div>
      <div className="fixed bottom-20 left-72 text-secondary/5 rotate-12 pointer-events-none">
        <Backpack size={180} />
      </div>
      <div className="fixed top-1/2 right-40 text-primary/3 rotate-45 pointer-events-none">
        <Pencil size={100} />
      </div>
      <div className="fixed top-40 left-80 text-secondary/3 -rotate-45 pointer-events-none">
        <Ruler size={120} />
      </div>

      <Sidebar
        academicYear={academicYear}
        setAcademicYear={handleAcademicYearChange}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      <main className="md:pl-64 transition-all duration-300 relative z-10">
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
          <HeaderLogosBanner />
          <Suspense fallback={<TabFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard academicYear={academicYear} currentUser={currentUser} />} />
              <Route
                path="/sekolah"
                element={
                  <RequireRole allow={!isKoordinator}>
                    <Schools academicYear={academicYear} />
                  </RequireRole>
                }
              />
              <Route
                path="/siswa"
                element={
                  <RequireRole allow={!isKoordinator}>
                    <Students academicYear={academicYear} />
                  </RequireRole>
                }
              />
              <Route path="/pemeriksaan" element={<Screenings academicYear={academicYear} currentUser={currentUser} />} />
              <Route path="/ttd" element={<TTDComplianceMenu academicYear={academicYear} currentUser={currentUser} />} />
              {/* TEMP: Reports route hidden — restore RequireRole + Reports element at /laporan to re-enable. */}
              <Route path="/laporan" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/pengguna"
                element={
                  <RequireRole allow={isAdmin}>
                    <Users academicYear={academicYear} />
                  </RequireRole>
                }
              />
              <Route
                path="/tahun-ajaran"
                element={
                  <RequireRole allow={isAdmin}>
                    <AcademicYears academicYear={academicYear} onActiveYearChange={handleAcademicYearChange} />
                  </RequireRole>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
