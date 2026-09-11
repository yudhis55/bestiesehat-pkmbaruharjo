import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, BookOpen, Pencil, GraduationCap, School, Backpack } from 'lucide-react';
import { AuthLogosBanner } from '@/components/HeaderLogos';

interface AuthProps {
  onLogin: () => void;
}

export function Auth({ onLogin }: AuthProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/20 p-4 relative overflow-hidden">
      {/* School Themed Decorations */}
      <div className="absolute top-10 left-10 text-primary/10 -rotate-12 animate-bounce-subtle">
        <BookOpen size={120} />
      </div>
      <div className="absolute bottom-10 right-10 text-secondary/10 rotate-12 animate-bounce-subtle" style={{ animationDelay: '1s' }}>
        <Backpack size={150} />
      </div>
      <div className="absolute top-1/4 right-20 text-primary/5 rotate-45 animate-pulse">
        <Pencil size={80} />
      </div>
      <div className="absolute bottom-1/4 left-20 text-secondary/5 -rotate-45 animate-pulse" style={{ animationDelay: '1.5s' }}>
        <GraduationCap size={100} />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/2 opacity-[0.03] pointer-events-none">
        <School size={600} />
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl shadow-primary/10 bg-white/90 backdrop-blur-md rounded-[2.5rem] overflow-hidden relative z-10">
        <div className="h-3 bg-linear-to-r from-primary via-secondary to-primary" />
        
        {/* Logos Section */}
        <div className="px-8 pt-8 pb-2">
          <AuthLogosBanner />
        </div>

        <CardHeader className="text-center pt-6 pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-5 bg-primary rounded-[2rem] shadow-2xl shadow-primary/40 animate-bounce-subtle">
              <ClipboardCheck className="w-14 h-14 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-primary">UKS Digital</CardTitle>
          <CardDescription className="text-lg font-bold text-slate-600 mt-2 leading-tight">
            Sistem Informasi Kesehatan Sekolah <br/>
            <span className="text-sm font-medium text-slate-400">Puskesmas Baruharjo - Kabupaten Trenggalek</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 px-10 pb-14">
          <div className="space-y-4">
            <Button className="w-full h-16 text-xl font-black rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all active:scale-95 bg-primary hover:bg-primary/90" onClick={onLogin}>
              Masuk dengan Google
            </Button>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="h-px w-8 bg-slate-200" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-black">
                Akses Khusus Petugas
              </p>
              <div className="h-px w-8 bg-slate-200" />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <School className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Platform terintegrasi untuk pemantauan kesehatan siswa, skrining berkala, dan kepatuhan TTD di seluruh sekolah binaan.
              </p>
            </div>
            <p className="text-center text-[10px] text-slate-400 font-medium">
              &copy; 2024 Dinas Kesehatan Kabupaten Trenggalek
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
