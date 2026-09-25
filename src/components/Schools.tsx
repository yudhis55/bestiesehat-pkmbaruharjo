import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
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
import { School, SchoolType, User } from '@/types';
import { toast } from 'sonner';
import { supabase, profileToUser, type ProfileRow } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface SchoolsProps {
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

// Satu-satunya titik pemetaan snake_case (schools) <-> camelCase (School),
// mirror Users.tsx (profileToUser).
// LINK ASIMETRIS: sekolah TIDAK PERNAH memilih koordinator di dialog.
// Sumber kebenaran tunggal = profiles.school_id (sisi akun, dikelola di
// Users.tsx). Kolom tabel koordinator diturunkan (derived) dari daftar
// profiles yang dimuat di sini; coordinator_name di DB hanya fallback
// legacy untuk nama tanpa akun.
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

function schoolToInsert(school: Omit<School, 'id'>) {
  return {
    name: school.name,
    address: school.address,
    coordinator_name: school.coordinatorName,
    phone: school.phone,
    type: school.type,
  };
}

export function Schools({ academicYear: currentAcademicYear }: SchoolsProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state (tanpa pilihan koordinator — lihat komentar link asimetris di atas)
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<SchoolType>('SD');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const loadSchools = async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, address, coordinator_name, phone, type')
      .order('name', { ascending: true });
    if (error || !data) {
      toast.error('Gagal memuat data sekolah. Periksa koneksi dan coba lagi.');
      setSchools([]);
      setLoadError('Gagal memuat data sekolah.');
    } else {
      setSchools((data as SchoolRow[]).map(schoolRowToSchool));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadSchools();
      if (cancelled) return;
      await fetchCoordinatorUsers();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const coordinators = users.filter((u) => u.role === 'koordinator' && u.isActive);

  const fetchCoordinatorUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, name, role, school_id, is_active')
      .order('name', { ascending: true });
    if (error || !data) {
      toast.error('Gagal memuat data koordinator. Periksa koneksi dan coba lagi.');
      setUsers([]);
      return [];
    }
    const mapped = (data as ProfileRow[]).map(profileToUser);
    setUsers(mapped);
    return mapped;
  };

  const resetForm = () => {
    setEditingId(null);
    void fetchCoordinatorUsers();
    setNewName('');
    setNewType('SD');
    setNewAddress('');
    setNewPhone('');
  };

  const handleEditSchool = async (school: School) => {
    await fetchCoordinatorUsers();
    setEditingId(school.id);
    setNewName(school.name);
    setNewType(school.type);
    setNewAddress(school.address);
    setNewPhone(school.phone === '-' ? '' : school.phone);
    setIsOpen(true);
  };

  const handleSaveSchool = async () => {
    if (isSaving) return;
    if (!newName.trim()) {
      toast.error("Mohon isi nama sekolah");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        // EDIT: coordinator_name TIDAK disentuh — biarkan nilai tersimpan apa adanya.
        const { data, error } = await supabase
          .from('schools')
          .update({ name: newName, type: newType, address: newAddress, phone: newPhone || '-' })
          .eq('id', editingId)
          .select('id, name, address, coordinator_name, phone, type')
          .single();
        if (error || !data) {
          toast.error('Gagal memperbarui sekolah. Periksa koneksi dan coba lagi.');
          return;
        }
        const updatedSchool = schoolRowToSchool(data as SchoolRow);
        setSchools((prev) => prev.map((s) => (s.id === editingId ? updatedSchool : s)));
        toast.success("Sekolah berhasil diperbarui");
      } else {
        // ADD: skema menyimpan string — koordinator diisi '-' (link asimetris:
        // akun koordinator menunjuk sekolah via schoolId di Users.tsx).
        const { data, error } = await supabase
          .from('schools')
          .insert(schoolToInsert({ name: newName, type: newType, coordinatorName: '-', address: newAddress, phone: newPhone || '-' }))
          .select('id, name, address, coordinator_name, phone, type')
          .single();
        if (error || !data) {
          toast.error('Gagal menambahkan sekolah. Periksa koneksi dan coba lagi.');
          return;
        }
        const created = schoolRowToSchool(data as SchoolRow);
        setSchools((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Sekolah berhasil ditambahkan", {
          description: `${newName} telah terdaftar di sistem.`
        });
      }

      // Reset form
      resetForm();
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchool = async (id: string, name: string) => {
    setIsDeleting(true);
    try {
    const school = schools.find((s) => s.id === id);
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, name, role, school_id, is_active');
    let coordinatorUsers: User[];
    if (profileError || !profileData) {
      toast.error('Gagal memeriksa akun koordinator. Penghapusan dibatalkan, coba lagi.');
      return;
    } else {
      coordinatorUsers = (profileData as ProfileRow[]).map(profileToUser);
      setUsers(coordinatorUsers);
    }
    const [{ count: studentCount }, { count: screeningCount }, { count: ttdCount }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', id),
      supabase.from('screenings').select('id', { count: 'exact', head: true }).eq('school_id', id),
      supabase.from('ttd_compliance').select('id', { count: 'exact', head: true }).eq('school_id', id),
    ]);
    const coordinatorCount = coordinatorUsers.filter(
      (u) => u.role === 'koordinator' && (u.schoolId === id || u.name === school?.coordinatorName)
    ).length;
    const blockers: string[] = [];
    if ((studentCount ?? 0) > 0) blockers.push(`${studentCount} siswa`);
    if ((screeningCount ?? 0) > 0) blockers.push(`${screeningCount} data pemeriksaan`);
    if ((ttdCount ?? 0) > 0) blockers.push(`${ttdCount} data TTD`);
    if (coordinatorCount > 0) blockers.push(`${coordinatorCount} akun koordinator`);
    if (blockers.length > 0) {
      toast.error(`Tidak dapat menghapus: sekolah masih memiliki ${blockers.join(', ')}`);
      return;
    }
    const { error: deleteError } = await supabase.from('schools').delete().eq('id', id);
    if (deleteError) {
      toast.error('Gagal menghapus sekolah. Data mungkin masih dipakai. Coba lagi.');
      return;
    }
    setSchools((prev) => prev.filter(s => s.id !== id));
    toast.success(`Sekolah ${name} berhasil dihapus`);
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
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Data Sekolah</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Kelola daftar sekolah binaan Puskesmas.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl" onClick={() => resetForm()}>
              <Plus className="w-5 h-5" /> Tambah Sekolah
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">{editingId ? 'Edit Sekolah' : 'Tambah Sekolah Baru'}</DialogTitle>
              <DialogDescription className="font-medium">{editingId ? 'Perbarui detail sekolah binaan.' : 'Masukkan detail sekolah binaan baru.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="font-bold text-slate-700">Nama Sekolah</Label>
                <Input 
                  id="name" 
                  placeholder="Contoh: SDN 01 Kota" 
                  className="rounded-xl border-slate-200"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type" className="font-bold text-slate-700">Tingkat</Label>
                <Select value={newType} onValueChange={(v: SchoolType) => setNewType(v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih tingkat" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="SD">SD</SelectItem>
                    <SelectItem value="SMP">SMP</SelectItem>
                    <SelectItem value="SMA">SMA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="font-bold text-slate-700">Nomor Telepon</Label>
                <Input 
                  id="phone" 
                  placeholder="0812..." 
                  className="rounded-xl border-slate-200"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address" className="font-bold text-slate-700">Alamat</Label>
                <Input 
                  id="address" 
                  placeholder="Alamat lengkap" 
                  className="rounded-xl border-slate-200"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleSaveSchool()} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">{isSaving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Simpan Sekolah'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari sekolah..." 
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
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama Sekolah</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Tingkat</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Koordinator</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Telepon</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow className="border-slate-100">
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground font-medium">Memuat data sekolah…</TableCell>
              </TableRow>
            )}
            {!isLoading && loadError && (
              <TableRow className="border-slate-100">
                <TableCell colSpan={5} className="text-center py-10">
                  <p className="text-muted-foreground font-medium mb-3">{loadError}</p>
                  <Button variant="outline" onClick={() => void loadSchools()}>Coba lagi</Button>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !loadError && filteredSchools.map((school) => (
              <TableRow key={school.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                <TableCell className="font-bold text-slate-700 py-4">{school.name}</TableCell>
                <TableCell className="py-4">
                  <Badge variant={school.type === 'SD' ? 'secondary' : school.type === 'SMP' ? 'outline' : 'default'} className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {school.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600 font-medium py-4">{coordinators.find((u) => u.schoolId === school.id)?.name ?? school.coordinatorName}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs py-4">{school.phone}</TableCell>
                <TableCell className="text-right py-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Edit" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEditSchool(school)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Hapus"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget({ id: school.id, name: school.name })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemName={deleteTarget?.name ?? ''}
        description={deleteTarget ? `Sekolah "${deleteTarget.name}" akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTarget) void handleDeleteSchool(deleteTarget.id, deleteTarget.name); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
