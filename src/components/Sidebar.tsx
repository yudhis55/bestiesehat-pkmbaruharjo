import { useState } from 'react';
import { 
  LayoutDashboard, 
  School as SchoolIcon, 
  Users, 
  ClipboardCheck, 
  FileBarChart, 
  Menu, 
  X,
  LogOut,
  User,
  CalendarDays,
  Pill
} from 'lucide-react';
import { SidebarLogos } from '@/components/HeaderLogos';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  onLogout: () => void;
}

export function Sidebar({ activeTab, setActiveTab, academicYear, setAcademicYear, onLogout }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schools', label: 'Sekolah', icon: SchoolIcon },
    { id: 'students', label: 'Siswa', icon: Users },
    { id: 'screenings', label: 'Pemeriksaan', icon: ClipboardCheck },
    { id: 'ttd', label: 'Kepatuhan TTD', icon: Pill },
    { id: 'reports', label: 'Laporan', icon: FileBarChart },
  ];

  const academicYears = [
    '2023/2024',
    '2024/2025',
    '2025/2026',
    '2026/2027',
    '2027/2028',
  ];

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
            <SidebarLogos />
            <h1 className="text-xl font-bold text-primary flex items-center gap-2 mt-2">
              <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                <ClipboardCheck className="w-6 h-6 text-primary-foreground" />
              </div>
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

          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group text-left",
                  activeTab === item.id 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 mr-3 transition-transform duration-200",
                  activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                )} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Admin Puskesmas</p>
                <p className="text-xs text-muted-foreground truncate">admin@puskesmas.go.id</p>
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
