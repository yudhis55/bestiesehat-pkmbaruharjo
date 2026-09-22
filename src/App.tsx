/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
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

// Guard peran: koordinator (dan non-admin untuk /pengguna) dialihkan ke /pemeriksaan.
function RequireRole({ allow, children }: { allow: boolean; children: ReactNode }) {
  if (!allow) {
    return <Navigate to="/pemeriksaan" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getSession());
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const navigate = useNavigate();

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

  // Tahun ajaran aktif: '2024/2025' di atas hanya fallback instan,
  // lalu sinkron ke baris is_active=true di tabel academic_years.
  useEffect(() => {
    let cancelled = false;
    const loadActiveYear = async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('label')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (cancelled || error || !data) return;
      const label = (data as { label: unknown }).label;
      if (typeof label === 'string' && label.trim().length > 0) {
        setAcademicYear(label);
      }
    };
    void loadActiveYear();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!currentUser) {
    return (
      <>
        <Auth onLogin={(u) => { setCurrentUser(u); navigate(u.role === 'koordinator' ? '/pemeriksaan' : '/dashboard'); }} />
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
        setAcademicYear={setAcademicYear}
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
                    <AcademicYears academicYear={academicYear} onActiveYearChange={setAcademicYear} />
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
