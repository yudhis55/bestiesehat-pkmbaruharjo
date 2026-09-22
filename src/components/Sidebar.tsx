import { useEffect, useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  School as SchoolIcon, 
  Users as UsersIcon, 
  ClipboardCheck,
  Menu, 
  X,
  LogOut,
  User as UserIcon,
  CalendarDays,
  Pill
} from 'lucide-react';
import { NavLink } from 'react-router';
import { SidebarLogos } from '@/components/HeaderLogos';
import logoBestieSehat from '@/assets/images/logo-bestiesehat.png';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SidebarProps {
  academicYear: string;
  setAcademicYear: (year: string) => void;
  onLogout: () => void;
  currentUser: User;
}

export function Sidebar({ academicYear, setAcademicYear, onLogout, currentUser }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([
    '2023/2024',
    '2024/2025',
    '2025/2026',
    '2026/2027',
    '2027/2028',
  ]);

  useEffect(() => {
    let cancelled = false;
    const loadSchoolNames = async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name')
        .order('name', { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        setSchools(data as { id: string; name: string }[]);
      }
    };
    const loadYearOptions = async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('label')
        .order('label', { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        const labels = (data as { label: unknown }[])
          .map((row) => row.label)
          .filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
        if (labels.length > 0) {
          setYearOptions(labels);
        }
      }
    };
    void loadSchoolNames();
    void loadYearOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const menuItems = useMemo(() => {
    const allItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { id: 'schools', label: 'Sekolah', icon: SchoolIcon, to: '/sekolah' },
      { id: 'students', label: 'Siswa', icon: UsersIcon, to: '/siswa' },
      { id: 'screenings', label: 'Pemeriksaan', icon: ClipboardCheck, to: '/pemeriksaan' },
      { id: 'ttd', label: 'Kepatuhan TTD', icon: Pill, to: '/ttd' },
      // TEMP: Reports menu hidden — restore `{ id: 'reports', label: 'Laporan', icon: FileBarChart, to: '/laporan' }` + FileBarChart import to re-enable.
    ];
    if (currentUser.role === 'koordinator') {
      return allItems.filter((item) => item.id === 'dashboard' || item.id === 'screenings' || item.id === 'ttd');
    }
    return [...allItems, { id: 'tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarDays, to: '/tahun-ajaran' }, { id: 'users', label: 'Kelola Pengguna', icon: UserIcon, to: '/pengguna' }];
  }, [currentUser.role]);

  const schoolName = useMemo(() => {
    if (!currentUser.schoolId) return null;
    return schools.find((s) => s.id === currentUser.schoolId)?.name ?? null;
  }, [currentUser.schoolId, schools]);

  const academicYears = yearOptions;

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transition-transform duration-300 ease-in-out md:translate-x-0",
        !isOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b bg-linear-to-br from-primary/5 to-transparent">
            {/* TEMP: disembunyikan — banner 3 logo sudah ada di tiap halaman (HeaderLogosBanner). Hapus komentar untuk mengembalikan. <SidebarLogos /> */}
            <h1 className="text-xl font-bold text-primary flex items-center gap-2 mt-2">
              <img src={logoBestieSehat} alt="Logo Bestie Sehat" className="h-10 w-10 object-contain drop-shadow-md" />
              <span>UKS Digital</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1 opacity-70">Puskesmas Baruharjo - Trenggalek</p>
          </div>

          <div className="px-6 py-4 border-b bg-slate-50/50">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 block">Tahun Ajaran</label>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Pilih Tahun" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200">
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year} className="rounded-lg">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                onClick={handleNavClick}
                className={({ isActive }) => cn(
                  "flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group text-left",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn(
                      "w-5 h-5 mr-3 transition-transform duration-200",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground truncate">@{currentUser.username}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {currentUser.role === 'admin' ? 'Admin' : 'Koordinator'}
                  </span>
                </div>
                {schoolName && (
                  <p className="text-xs text-muted-foreground truncate mt-1">{schoolName}</p>
                )}
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={onLogout}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Keluar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
