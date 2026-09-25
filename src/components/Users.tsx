import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { School, SchoolType, User } from '@/types';
import { toast } from 'sonner';
import {
  getSession,
} from '@/lib/storage';
import { supabase, profileToUser, type ProfileRow } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface UsersProps {
  academicYear: string;
}

interface SchoolRow {
  id: string;
  name: string;
  address: string;
  coordinator_name: string;
  phone: string;
  type: SchoolType;
}

// Mirror Schools.tsx (schoolRowToSchool): satu-satunya titik pemetaan
// snake_case (schools) -> camelCase (School).
function schoolRowToSchool(row: SchoolRow): School {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    coordinatorName: row.coordinator_name,
    phone: row.phone,
    type: row.type,
  };
}

// Membaca pesan spesifik dari body respons Edge Function (create-user /
// set-password). FunctionsHttpError.context adalah Response, jadi bodinya
// harus dibaca async. Kembalikan null bila tidak ada pesan yang berguna.
async function readEdgeMessage(err: unknown): Promise<string | null> {
  if (!(err instanceof FunctionsHttpError)) return null;
  const ctx = (err as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object') return null;
  const pickFromObject = (obj: Record<string, unknown>): string | null => {
    const candidates = [obj['error'], obj['message'], obj['msg'], obj['error_description']];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
  };
  try {
    const res = ctx as Response;
    if (typeof res.text === 'function') {
      let raw = '';
      try {
        raw = await res.clone().text();
      } catch {
        raw = await res.text();
      }
      raw = (raw ?? '').trim();
      if (!raw) return null;
      if (raw.startsWith('<')) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return pickFromObject(parsed as Record<string, unknown>);
        }
        if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
      } catch {
        // Bukan JSON — pakai teks mentah bila wajar.
      }
      return raw.length <= 300 ? raw : null;
    }
    return pickFromObject(ctx as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function Users({ academicYear: _academicYear }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<'koordinator' | 'admin'>('koordinator');
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newIsActive, setNewIsActive] = useState('aktif');

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, role, school_id, is_active')
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error('Gagal memuat data pengguna. Periksa koneksi dan coba lagi.');
        setUsers([]);
      } else {
        setUsers((data as ProfileRow[]).map(profileToUser));
      }
      setIsLoading(false);
    };
    const loadSchools = async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, address, coordinator_name, phone, type')
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error || !data) {
        toast.error('Gagal memuat daftar sekolah. Nama sekolah ditampilkan sebagai ID.');
        setSchools([]);
      } else {
        setSchools((data as SchoolRow[]).map(schoolRowToSchool));
      }
    };
    void loadProfiles();
    void loadSchools();
    return () => {
      cancelled = true;
    };
  }, []);

  const schoolNameOf = (schoolId?: string) => {
    if (!schoolId) return '-';
    return schools.find((s) => s.id === schoolId)?.name ?? schoolId;
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setShowNewPassword(false);
    setNewRole('koordinator');
    setNewSchoolId('');
    setNewIsActive('aktif');
    setSelectedUser(null);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setNewName(user.name);
    setNewUsername(user.username);
    setNewPassword('');
    setShowNewPassword(false);
    setNewRole(user.role);
    setNewSchoolId(user.schoolId ?? '');
    setNewIsActive(user.isActive ? 'aktif' : 'nonaktif');
    setIsOpen(true);
  };

  const handleSaveUser = async () => {
    if (isSaving) return;
    if (!newName.trim() || !newUsername.trim()) {
      toast.error("Mohon isi nama dan username");
      return;
    }
    const trimmedUsername = newUsername.trim();
    if (/\s/.test(trimmedUsername)) {
      toast.error("Username tidak boleh mengandung spasi. Gunakan huruf, angka, titik atau underscore.");
      return;
    }
    if (trimmedUsername.length < 3) {
      toast.error("Username minimal 3 karakter.");
      return;
    }
    const duplicate = users.find(
      (u) => u.username.toLowerCase() === trimmedUsername.toLowerCase() && u.id !== selectedUser?.id
    );
    if (duplicate) {
      toast.error("Username sudah digunakan");
      return;
    }
    if (newRole === 'koordinator' && !newSchoolId) {
      toast.error("Mohon pilih sekolah ampuan");
      return;
    }

    if (selectedUser) {
      const session = getSession();
      if (session && session.id === selectedUser.id && newIsActive !== 'aktif') {
        toast.error("Tidak dapat menonaktifkan: ini adalah akun yang sedang login");
        return;
      }
      const wantPasswordReset = newPassword !== '';
      if (wantPasswordReset && newPassword.length < 6) {
        toast.error("Kata sandi minimal 6 karakter.");
        return;
      }
      setIsSaving(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            username: newUsername.trim(),
            name: newName.trim(),
            role: newRole,
            school_id: newRole === 'koordinator' ? newSchoolId : null,
            is_active: newIsActive === 'aktif',
          })
          .eq('id', selectedUser.id)
          .select('id, username, name, role, school_id, is_active')
          .single();
        if (error || !data) {
          toast.error('Gagal memperbarui akun. Periksa koneksi dan coba lagi.');
          return;
        }
        const updatedUser = profileToUser(data as ProfileRow);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        if (wantPasswordReset) {
          // Reset kata sandi via Edge Function admin-only, SETELAH profil
          // berhasil diperbarui. Password tidak pernah disimpan lokal.
          const { error: pwError } = await supabase.functions.invoke('create-user', {
            body: {
              action: 'set-password',
              user_id: selectedUser.id,
              password: newPassword,
            },
          });
          if (pwError) {
            const status = pwError instanceof FunctionsHttpError ? pwError.context.status : 0;
            const detail = await readEdgeMessage(pwError);
            if (detail) {
              toast.error(`Profil diperbarui, tetapi kata sandi gagal diubah. ${detail}`);
            } else if (status === 401) {
              toast.error('Sesi tidak valid. Profil diperbarui, tetapi kata sandi gagal diubah. Silakan login ulang.');
            } else if (status === 403) {
              toast.error('Hanya admin yang dapat mereset kata sandi. Profil tetap diperbarui.');
            } else {
              toast.error('Profil diperbarui, tetapi kata sandi gagal diubah. Coba lagi.');
            }
            resetForm();
            setIsOpen(false);
            return;
          }
          toast.success("Akun dan kata sandi berhasil diperbarui", {
            description: `${updatedUser.name} telah diperbarui.`
          });
        } else {
          toast.success("Akun berhasil diperbarui", {
            description: `${updatedUser.name} telah diperbarui.`
          });
        }
        resetForm();
        setIsOpen(false);
      } finally {
        setIsSaving(false);
      }
    } else {
      if (!newPassword) {
        toast.error("Mohon isi kata sandi");
        return;
      }
      if (newPassword.length < 6) {
        toast.error("Kata sandi minimal 6 karakter.");
        return;
      }
      setIsSaving(true);
      try {
        // FASE PENUH: pembuatan akun dilakukan server-side oleh Edge Function
        // `create-user` (admin-only; memverifikasi JWT pemanggil + baris
        // profiles admin sebelum efek samping apa pun). invoke menyertakan JWT
        // pemanggil otomatis. Tidak ada signUp/signOut lagi — admin tetap login.
        const { error } = await supabase.functions.invoke('create-user', {
          body: {
            username: newUsername.trim(),
            password: newPassword,
            name: newName.trim(),
            role: newRole,
            school_id: newRole === 'koordinator' ? newSchoolId : null,
            is_active: newIsActive === 'aktif',
          },
        });
        if (error) {
          const status = error instanceof FunctionsHttpError ? error.context.status : 0;
          const detail = await readEdgeMessage(error);
          if (detail) {
            toast.error(`Gagal membuat akun. ${detail}`);
          } else if (status === 400) {
            toast.error('Data akun tidak valid. Periksa kembali isian Anda.');
          } else if (status === 401) {
            toast.error('Sesi tidak valid. Silakan login ulang.');
          } else if (status === 403) {
            toast.error('Hanya admin yang dapat membuat akun.');
          } else if (status === 409) {
            toast.error('Username sudah digunakan.');
          } else {
            toast.error('Gagal membuat akun. Coba lagi.');
          }
          return;
        }
        // Sukses (201): server sudah membuat auth user + baris profiles. Muat
        // ulang daftar dari `profiles` (sumber kebenaran) tanpa signOut.
        const { data: rows, error: reloadError } = await supabase
          .from('profiles')
          .select('id, username, name, role, school_id, is_active')
          .order('name', { ascending: true });
        if (reloadError) {
          toast.error('Akun dibuat, tetapi gagal memuat ulang daftar. Muat ulang halaman.');
        } else {
          setUsers((rows as ProfileRow[]).map(profileToUser));
        }
        toast.success('Akun berhasil dibuat', {
          description: `${newName.trim()} telah ditambahkan.`
        });
        resetForm();
        setIsOpen(false);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    setIsDeleting(true);
    try {
    const session = getSession();
    if (session && session.id === id) {
      toast.error("Tidak dapat menghapus: ini adalah akun yang sedang login");
      return;
    }
    const target = users.find((u) => u.id === id);
    const targetName = target?.name ?? name;
    const assignedSchool = schools.find((s) => s.coordinatorName === targetName);
    if (assignedSchool) {
      toast.error(`Tidak dapat menghapus: masih menjadi koordinator ${assignedSchool.name}, tugaskan ulang koordinator terlebih dahulu`);
      return;
    }
    // FASE PENUH: hapus tuntas via Edge Function `create-user` admin-only
    // (action 'delete-user'): server menghapus baris profiles lalu auth user,
    // sehingga login ikut terhapus. invoke menyertakan JWT pemanggil otomatis.
    const { error } = await supabase.functions.invoke('create-user', {
      body: { action: 'delete-user', user_id: id },
    });
    if (error) {
      const status = error instanceof FunctionsHttpError ? error.context.status : 0;
      if (status === 401) {
        toast.error('Sesi tidak valid. Silakan login ulang.');
      } else if (status === 403) {
        toast.error('Hanya admin yang dapat menghapus akun.');
      } else {
        toast.error('Gagal menghapus akun. Periksa koneksi dan coba lagi.');
      }
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast.success(`Akun ${name} berhasil dihapus. Login-nya ikut terhapus.`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Data Pengguna</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {_academicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Kelola akun koordinator sekolah binaan Puskesmas.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
              <Plus className="w-5 h-5" /> Tambah Koordinator
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">
                {selectedUser ? 'Ubah Koordinator' : 'Tambah Koordinator Baru'}
              </DialogTitle>
              <DialogDescription className="font-medium">Masukkan detail akun koordinator sekolah.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nama" className="font-bold text-slate-700">Nama</Label>
                <Input
                  id="nama"
                  placeholder="Nama lengkap koordinator"
                  className="rounded-xl border-slate-200"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username" className="font-bold text-slate-700">Username</Label>
                <Input
                  id="username"
                  placeholder="Contoh: koor_sdn01"
                  className="rounded-xl border-slate-200"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="font-bold text-slate-700">Kata Sandi</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder={selectedUser ? "Kosongkan jika tidak diubah" : "Kata sandi akun"}
                    className="rounded-xl border-slate-200 pr-12"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {selectedUser && (
                  <p className="text-xs text-muted-foreground font-medium">
                    Kosongkan jika tidak diubah; isi untuk mereset kata sandi akun ini (min 6 karakter).
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role" className="font-bold text-slate-700">Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as 'koordinator' | 'admin')}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="koordinator">Koordinator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sekolah" className="font-bold text-slate-700">Sekolah Ampuan (wajib untuk Koordinator)</Label>
                <Select value={newSchoolId} onValueChange={setNewSchoolId}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih sekolah">{schools.find((s) => s.id === newSchoolId)?.name ?? (newSchoolId ? 'Sekolah tidak tersedia' : undefined)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status" className="font-bold text-slate-700">Status</Label>
                <Select value={newIsActive} onValueChange={setNewIsActive}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveUser} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                {isSaving ? 'Menyimpan...' : selectedUser ? 'Simpan Perubahan' : 'Simpan Koordinator'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau username..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Username</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Role</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Sekolah Ampuan</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Status</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-slate-100">
                <TableCell colSpan={6} className="text-center text-slate-500 font-medium py-8">
                  Memuat data pengguna...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow className="border-slate-100">
                <TableCell colSpan={6} className="text-center text-slate-500 font-medium py-8">
                  Belum ada pengguna. Tambahkan koordinator baru.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                <TableCell className="font-bold text-slate-700 py-4">{user.name}</TableCell>
                <TableCell className="text-slate-600 font-medium py-4">{user.username}</TableCell>
                <TableCell className="py-4">
                  <Badge
                    variant={user.role === 'admin' ? 'default' : 'secondary'}
                    className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                  >
                    {user.role === 'admin' ? 'Admin' : 'Koordinator'}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600 font-medium py-4">{schoolNameOf(user.schoolId)}</TableCell>
                <TableCell className="py-4">
                  <Badge
                    variant={user.isActive ? 'default' : 'secondary'}
                    className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                  >
                    {user.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right py-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                      onClick={() => openEdit(user)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Hapus"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget({ id: user.id, name: user.name })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemName={deleteTarget?.name ?? ''}
        description={deleteTarget ? `Akun "${deleteTarget.name}" akan dihapus dari daftar dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTarget) void handleDeleteUser(deleteTarget.id, deleteTarget.name); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
