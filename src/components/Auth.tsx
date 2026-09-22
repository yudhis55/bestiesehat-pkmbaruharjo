import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Pencil, GraduationCap, School, Backpack } from 'lucide-react';
import { AuthLogosBanner } from '@/components/HeaderLogos';
import logoBestieSehat from '@/assets/images/logo-bestiesehat.png';
import { toast } from 'sonner';
import type { User } from '@/types';
import { saveSession } from '@/lib/storage';
import { supabase, emailForUsername, profileToUser, type ProfileRow } from '@/lib/supabase';

interface AuthProps {
  onLogin: (user: User) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (trimmedUsername === '' || password === '') {
      toast.error('Masukkan username dan password');
      return;
    }
    setIsLoading(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForUsername(trimmedUsername),
        password,
      });
      if (signInError || !signInData.user) {
        toast.error('Username atau password salah');
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, name, role, school_id, is_active')
        .eq('id', signInData.user.id)
        .single();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        toast.error('Profil pengguna tidak ditemukan. Hubungi admin Puskesmas.');
        return;
      }
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        toast.error('Akun Anda nonaktif. Hubungi admin Puskesmas.');
        return;
      }
      const user = profileToUser(profile as ProfileRow);
      saveSession(user);
      toast.success(`Selamat datang, ${user.name}`);
      onLogin(user);
    } finally {
      setIsLoading(false);
    }
  };
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
            <img src={logoBestieSehat} alt="Logo Bestie Sehat" className="w-28 h-28 object-contain drop-shadow-xl animate-bounce-subtle" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-primary">UKS Digital</CardTitle>
          <CardDescription className="text-lg font-bold text-slate-600 mt-2 leading-tight">
            Sistem Informasi Kesehatan Sekolah <br/>
            <span className="text-sm font-medium text-slate-400">Puskesmas Baruharjo - Kabupaten Trenggalek</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 px-10 pb-14">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="h-12 rounded-xl"
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-14 text-lg font-black rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all active:scale-95 bg-primary hover:bg-primary/90">
              {isLoading ? 'Memeriksa...' : 'Masuk'}
            </Button>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="h-px w-8 bg-slate-200" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-black">
                Akses Khusus Petugas
              </p>
              <div className="h-px w-8 bg-slate-200" />
            </div>
          </form>
          
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
