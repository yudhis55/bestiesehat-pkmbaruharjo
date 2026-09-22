import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Check } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface AcademicYearsProps {
  academicYear: string;
  onActiveYearChange?: (label: string) => void;
}

interface AcademicYearRow {
  id: string;
  label: string;
  is_active: boolean;
}

interface AcademicYear {
  id: string;
  label: string;
  isActive: boolean;
}

function rowToYear(row: AcademicYearRow): AcademicYear {
  return { id: row.id, label: row.label, isActive: row.is_active };
}

export function AcademicYears({ academicYear: currentAcademicYear, onActiveYearChange }: AcademicYearsProps) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const loadYears = async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, label, is_active')
      .order('label', { ascending: true });
    if (error || !data) {
      toast.error('Gagal memuat data tahun ajaran. Periksa koneksi dan coba lagi.');
      setYears([]);
      setLoadError('Gagal memuat data tahun ajaran.');
    } else {
      setYears((data as AcademicYearRow[]).map(rowToYear));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadYears();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setNewLabel('');
  };

  const handleEdit = (year: AcademicYear) => {
    setEditingId(year.id);
    setNewLabel(year.label);
    setIsOpen(true);
  };

  const handleSave = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error('Mohon isi tahun ajaran');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('academic_years')
          .update({ label })
          .eq('id', editingId)
          .select('id, label, is_active')
          .single();
        if (error || !data) {
          toast.error('Gagal memperbarui tahun ajaran. Label mungkin sudah dipakai.');
          return;
        }
        const updated = rowToYear(data as AcademicYearRow);
        setYears((prev) =>
          prev.map((y) => (y.id === editingId ? updated : y)).sort((a, b) => a.label.localeCompare(b.label)),
        );
        toast.success('Tahun ajaran berhasil diperbarui');
      } else {
        const { data, error } = await supabase
          .from('academic_years')
          .insert({ label, is_active: false })
          .select('id, label, is_active')
          .single();
        if (error || !data) {
          toast.error('Gagal menambahkan tahun ajaran. Label mungkin sudah dipakai.');
          return;
        }
        const created = rowToYear(data as AcademicYearRow);
        setYears((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
        toast.success('Tahun ajaran berhasil ditambahkan', {
          description: `${label} telah terdaftar di sistem.`,
        });
      }
      resetForm();
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Exactly-one-active via order-swap + rollback (client-side; no RPC exists —
  // 0006_hardening.sql only adds is_active RLS + reports split, no activation RPC).
  // Strategy: activate-target-FIRST, then deactivate-old. The old row stays active
  // throughout, so a mid-flight failure can never leave ZERO active:
  //   - step 1 (activate target) fails → old still the single active; toast, return.
  //   - step 2 (deactivate old) fails → two active briefly; roll back by
  //     deactivating the target again so old remains the single active; toast.
  //   - rollback itself fails → state ambiguous (likely two active); reload + toast.
  // Chosen over deactivate-first (old code) which left zero active on step-2
  // failure, and over RPC which would need a new migration + deploy.
  const handleSetActive = async (year: AcademicYear) => {
    if (year.isActive || activatingId !== null) return;
    setActivatingId(year.id);
    try {
      const current = years.find((y) => y.isActive && y.id !== year.id);
      const { error: onError } = await supabase
        .from('academic_years')
        .update({ is_active: true })
        .eq('id', year.id);
      if (onError) {
        toast.error('Gagal mengaktifkan tahun ajaran. Coba lagi.');
        return;
      }
      if (current) {
        const { error: offError } = await supabase
          .from('academic_years')
          .update({ is_active: false })
          .eq('id', current.id);
        if (offError) {
          // Roll back: deactivate the target again; old was never touched.
          const { error: rollbackError } = await supabase
            .from('academic_years')
            .update({ is_active: false })
            .eq('id', year.id);
          if (rollbackError) {
            toast.error('Aktivasi gagal dan pemulihan gagal. Muat ulang daftar.');
          } else {
            toast.error('Gagal menonaktifkan tahun ajaran lama. Perubahan dibatalkan.');
          }
          await loadYears();
          return;
        }
      }
      await loadYears();
      // Propagate to App global filter without reload (App passes setAcademicYear).
      onActiveYearChange?.(year.label);
      toast.success(`Tahun ajaran ${year.label} dijadikan aktif`);
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (year: AcademicYear) => {
    setIsDeleting(true);
    try {
    if (year.isActive) {
      toast.error('Tidak dapat menghapus: tahun ajaran sedang aktif. Jadikan tahun lain aktif terlebih dahulu.');
      return;
    }
    const [{ count: screeningCount }, { count: ttdCount }, { count: reportCount }] = await Promise.all([
      supabase.from('screenings').select('id', { count: 'exact', head: true }).eq('academic_year', year.label),
      supabase.from('ttd_compliance').select('id', { count: 'exact', head: true }).eq('academic_year', year.label),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('academic_year', year.label),
    ]);
    const blockers: string[] = [];
    if ((screeningCount ?? 0) > 0) blockers.push(`${screeningCount} data pemeriksaan`);
    if ((ttdCount ?? 0) > 0) blockers.push(`${ttdCount} data TTD`);
    if ((reportCount ?? 0) > 0) blockers.push(`${reportCount} data laporan`);
    if (blockers.length > 0) {
      toast.error(`Tidak dapat menghapus: tahun ajaran masih memiliki ${blockers.join(', ')}`);
      return;
    }
    const { error: deleteError } = await supabase.from('academic_years').delete().eq('id', year.id);
    if (deleteError) {
      toast.error('Gagal menghapus tahun ajaran. Data mungkin masih dipakai. Coba lagi.');
      return;
    }
    setYears((prev) => prev.filter((y) => y.id !== year.id));
    toast.success(`Tahun ajaran ${year.label} berhasil dihapus`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Tahun Ajaran</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Kelola daftar tahun ajaran dan tentukan tahun aktif.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl" onClick={() => resetForm()}>
              <Plus className="w-5 h-5" /> Tambah Tahun
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">{editingId ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}</DialogTitle>
              <DialogDescription className="font-medium">
                {editingId ? 'Perbarui label tahun ajaran.' : 'Masukkan label tahun ajaran baru.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="label" className="font-bold text-slate-700">Tahun Ajaran</Label>
                <Input
                  id="label"
                  placeholder="Contoh: 2024/2025"
                  className="rounded-xl border-slate-200"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleSave()} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                {isSaving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Simpan Tahun Ajaran'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-muted-foreground font-medium" aria-busy="true">
          Memuat data tahun ajaran…
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-3">
          <p className="text-muted-foreground font-medium">{loadError}</p>
          <Button variant="outline" onClick={() => void loadYears()}>Coba Lagi</Button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun Ajaran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="font-semibold">{year.label}</TableCell>
                  <TableCell>
                    {year.isActive ? <Badge>Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!year.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activatingId !== null}
                          onClick={() => void handleSetActive(year)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {activatingId === year.id ? 'Mengaktifkan…' : 'Jadikan Aktif'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleEdit(year)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(year)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {years.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Belum ada data tahun ajaran.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemName={deleteTarget?.label ?? ''}
        description={deleteTarget ? `Tahun ajaran "${deleteTarget.label}" akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
