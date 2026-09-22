import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  Pill, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  Download, 
  FileSpreadsheet,
  Activity,
  School as SchoolIcon,
  Trash2,
  Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TTDCompliance, Student, School, User } from '../types';
import { supabase } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface TTDComplianceProps {
  academicYear: string;
  currentUser?: User;
}

type ComplianceRecord = TTDCompliance & { studentName: string, schoolName: string, studentClass: string };

interface TTDComplianceRow {
  id: string;
  student_id: string;
  school_id: string;
  academic_year: string;
  date: string;
  tablets_received: number;
  tablets_consumed: number;
  is_compliant: boolean;
  notes: string | null;
  created_by: string | null;
}

interface StudentRow {
  id: string;
  school_id: string;
  name: string;
  gender: 'L' | 'P';
  birth_date: string;
  class: string;
  nik: string;
  parent_name: string;
  whatsapp: string;
  address: Student['address'];
  student_id_number: string | null;
}

interface SchoolRow {
  id: string;
  name: string;
  address: string;
  coordinator_name: string;
  phone: string;
  type: School['type'];
}

// Satu-satunya titik pemetaan snake_case (ttd_compliance/students/schools) <->
// camelCase (TTDCompliance/Student/School), mirror Students.tsx & Schools.tsx.
// `age` tidak dipakai di sini, jadi diisi 0 (tak dipersist, mirror Dashboard).
function ttdRowToModel(row: TTDComplianceRow): TTDCompliance {
  return {
    id: row.id,
    studentId: row.student_id,
    schoolId: row.school_id,
    academicYear: row.academic_year,
    date: row.date,
    tabletsReceived: row.tablets_received,
    tabletsConsumed: row.tablets_consumed,
    isCompliant: row.is_compliant,
    notes: row.notes ?? '',
    createdBy: row.created_by ?? '',
  };
}

function ttdToInsert(t: {
  studentId: string;
  schoolId: string;
  academicYear: string;
  date: string;
  tabletsReceived: number;
  tabletsConsumed: number;
  isCompliant: boolean;
  notes: string;
  createdBy: string | null;
}) {
  return {
    student_id: t.studentId,
    school_id: t.schoolId,
    academic_year: t.academicYear,
    date: t.date,
    tablets_received: t.tabletsReceived,
    tablets_consumed: t.tabletsConsumed,
    is_compliant: t.isCompliant,
    notes: t.notes,
    created_by: t.createdBy,
  };
}

// Sel tanggal Excel bisa berupa serial number, string YYYY-MM-DD, atau Date.
// Selalu normalkan ke ISO YYYY-MM-DD agar round-trip export<->import stabil.
function excelCellToISODate(cell: unknown): string {
  if (cell === null || cell === undefined || cell === '') return '';
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const parsed = XLSX.SSF.parse_date_code(cell);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
    return '';
  }
  const raw = cell.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

// Angka impor XLSX wajib valid: sel kosong/null/undefined atau non-numerik
// mengembalikan null agar baris dilewati (tidak pernah `|| 0` menjadi hantu patuh).
function parseStrictNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined) return null;
  const raw = cell.toString().trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function studentRowToStudent(row: StudentRow): Student {  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    gender: row.gender,
    birthDate: row.birth_date ?? '',
    age: 0,
    class: row.class,
    nik: row.nik,
    parentName: row.parent_name,
    whatsapp: row.whatsapp,
    address: row.address ?? { rt: '', rw: '', desa: '', kecamatan: '', kabupaten: '', provinsi: '' },
    studentIdNumber: row.student_id_number ?? '',
  };
}

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

export function TTDComplianceMenu({ academicYear, currentUser }: TTDComplianceProps) {
  const [records, setRecords] = useState<TTDCompliance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'noncompliant'>('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    const [recordRes, studentRes, schoolRes] = await Promise.all([
      supabase.from('ttd_compliance').select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by'),
      supabase.from('students').select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number'),
      supabase.from('schools').select('id, name, address, coordinator_name, phone, type'),
    ]);
    if (recordRes.error || studentRes.error || schoolRes.error || !recordRes.data || !studentRes.data || !schoolRes.data) {
      toast.error('Gagal memuat data kepatuhan TTD. Periksa koneksi dan coba lagi.');
      setRecords([]);
      setStudents([]);
      setSchools([]);
      setLoadError('Gagal memuat data kepatuhan TTD.');
    } else {
      setRecords((recordRes.data as TTDComplianceRow[]).map(ttdRowToModel));
      setStudents((studentRes.data as StudentRow[]).map(studentRowToStudent));
      setSchools((schoolRes.data as SchoolRow[]).map(schoolRowToSchool));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadRecords();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isKoordinator = currentUser?.role === 'koordinator';
  const scopedSchoolId = isKoordinator ? currentUser?.schoolId : undefined;

  // Form state
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tabletsReceived, setTabletsReceived] = useState('4');
  const [tabletsConsumed, setTabletsConsumed] = useState('4');
  const [notes, setNotes] = useState('');

  const resolvedRecords = useMemo(() => {
    return records
      .map(r => {
        const student = students.find(st => st.id === r.studentId);
        const school = schools.find(sch => sch.id === (r.schoolId || student?.schoolId));
        return {
          ...r,
          studentName: student ? student.name : 'Unknown Student',
          schoolName: school ? school.name : 'Unknown School',
          studentClass: student ? student.class : '1',
        };
      })
      .filter((r) => {
        if (!scopedSchoolId) return true;
        if (r.schoolId) return r.schoolId === scopedSchoolId;
        const student = students.find((st) => st.id === r.studentId);
        return student?.schoolId === scopedSchoolId;
      });
  }, [records, students, schools, scopedSchoolId]);

  const filteredRecords = useMemo(() => {
    const filterSchool = schoolFilter === 'all' ? undefined : schools.find((s) => s.id === schoolFilter);
    return resolvedRecords.filter(record =>
      (!record.academicYear || record.academicYear === academicYear) &&
      (record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.schoolName.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (complianceFilter === 'all' ||
        (complianceFilter === 'compliant' ? record.isCompliant : !record.isCompliant)) &&
      (!filterSchool || record.schoolName === filterSchool.name) &&
      (monthFilter === 'all' || String(new Date(record.date).getMonth() + 1) === monthFilter)
    );
  }, [resolvedRecords, searchTerm, complianceFilter, schoolFilter, monthFilter, schools, academicYear]);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, ComplianceRecord[]> = {};
    filteredRecords.forEach(record => {
      if (!groups[record.schoolName]) {
        groups[record.schoolName] = [];
      }
      groups[record.schoolName].push(record);
    });
    return groups;
  }, [filteredRecords]);

  const resetForm = () => {
    setEditingId(null);
    setStudentId('');
    setStudentQuery('');
    setSchoolId('');
    setDate(new Date().toISOString().split('T')[0]);
    setTabletsReceived('4');
    setTabletsConsumed('4');
    setNotes('');
  };

  const handleEditRecord = (record: ComplianceRecord) => {
    const student = students.find((st) => st.id === record.studentId);
    setEditingId(record.id);
    setStudentId(record.studentId || '');
    setStudentQuery('');
    setSchoolId(record.schoolId || student?.schoolId || '');
    setDate(record.date ? record.date.slice(0, 10) : new Date().toISOString().split('T')[0]);
    setTabletsReceived(String(record.tabletsReceived ?? '4'));
    setTabletsConsumed(String(record.tabletsConsumed ?? '4'));
    setNotes(record.notes || '');
    setIsOpen(true);
  };

  const handleSaveRecord = async () => {
    if (isSaving) return;
    const effectiveSchoolId = scopedSchoolId ?? schoolId;
    if (!studentId || !effectiveSchoolId) {
      toast.error("Mohon pilih siswa dan sekolah");
      return;
    }

    const received = Number(tabletsReceived);
    const consumed = Number(tabletsConsumed);

    setIsSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('ttd_compliance')
          .update({
            student_id: studentId,
            school_id: effectiveSchoolId,
            date,
            tablets_received: received,
            tablets_consumed: consumed,
            is_compliant: consumed >= received,
            notes,
          })
          .eq('id', editingId)
          .select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by')
          .single();
        if (error || !data) {
          toast.error('Gagal memperbarui catatan kepatuhan. Periksa koneksi dan coba lagi.');
          return;
        }
        const updatedRecord = ttdRowToModel(data as TTDComplianceRow);
        setRecords((prev) => prev.map((r) => (r.id === editingId ? updatedRecord : r)));
        toast.success("Catatan kepatuhan berhasil diperbarui");
      } else {
        const { data: dupHit, error: dupError } = await supabase
          .from('ttd_compliance')
          .select('id')
          .eq('student_id', studentId)
          .eq('date', date)
          .limit(1);
        if (dupError) {
          toast.error('Gagal memeriksa duplikat catatan. Periksa koneksi dan coba lagi.');
          return;
        }
        if (dupHit && dupHit.length > 0) {
          toast.info('Catatan kepatuhan siswa ini pada tanggal tersebut sudah tercatat.');
          return;
        }
        const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
        const { data, error } = await supabase
          .from('ttd_compliance')
          .insert(ttdToInsert({
            studentId,
            schoolId: effectiveSchoolId,
            academicYear,
            date,
            tabletsReceived: received,
            tabletsConsumed: consumed,
            isCompliant: consumed >= received,
            notes,
            createdBy,
          }))
          .select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by')
          .single();
        if (error || !data) {
          toast.error('Gagal menyimpan catatan kepatuhan. Periksa koneksi dan coba lagi.');
          return;
        }
        const newRecord = ttdRowToModel(data as TTDComplianceRow);
        setRecords((prev) => [newRecord, ...prev]);
        toast.success("Catatan kepatuhan berhasil disimpan");
      }
      resetForm();
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    setIsDeleting(true);
    try {
    const { error } = await supabase.from('ttd_compliance').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus catatan kepatuhan. Coba lagi.');
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast.success("Catatan kepatuhan berhasil dihapus");
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const deleteTargetLabel = (() => {
    if (!deleteTargetId) return '';
    const found = resolvedRecords.find((r) => r.id === deleteTargetId);
    if (!found) return deleteTargetId;
    const dateStr = found.date ? new Date(found.date).toLocaleDateString('id-ID') : '';
    return `${found.studentName}${dateStr ? ` — ${dateStr}` : ''}`;
  })();

  const downloadTemplate = () => {
    const template = [
      {
        'NIK Siswa': '3201014501100004',
        'Nama Siswa': 'Dewi Sartika',
        'Tanggal (YYYY-MM-DD)': '2024-03-01',
        'Tablet Diterima': 4,
        'Tablet Diminum': 4,
        'Catatan': 'Rutin diminum setiap Jumat'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_TTD");
    XLSX.writeFile(wb, "Template_Kepatuhan_TTD.xlsx");
  };

  const handleExport = () => {
    // 'NIK Siswa' disertakan agar export->import round-trip (impor
    // mencocokkan siswa via NIK/nama persis seperti kunci template).
    const dataToExport = filteredRecords.map((record) => ({
      'NIK Siswa': students.find((st) => st.id === record.studentId)?.nik ?? '',
      'Nama Siswa': record.studentName,
      'Sekolah': record.schoolName,
      'Kelas': record.studentClass,
      'Tanggal (YYYY-MM-DD)': record.date ? record.date.slice(0, 10) : '',
      'Tablet Diterima': record.tabletsReceived,
      'Tablet Diminum': record.tabletsConsumed,
      'Status': record.isCompliant ? 'Patuh' : 'Tidak Patuh',
      'Catatan': record.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kepatuhan TTD");
    XLSX.writeFile(wb, `ttd-compliance-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Berhasil mengekspor ${dataToExport.length} data`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const parsed: Omit<TTDCompliance, 'id'>[] = [];
        const skippedRows: string[] = [];
        data.forEach((row, index) => {
          const nik = row['NIK Siswa']?.toString();
          const name = row['Nama Siswa']?.toString();
          const student = students.find(s => (nik && s.nik === nik) || (name && s.name.toLowerCase() === name.toLowerCase()));

          if (!student) {
            skippedRows.push(`Baris ${index + 1}: Siswa tidak ditemukan (${name || nik || 'tanpa identitas'})`);
            return;
          }
          {
            const received = parseStrictNumber(row['Tablet Diterima']);
            const consumed = parseStrictNumber(row['Tablet Diminum']);
            if (received === null || consumed === null) {
              skippedRows.push(`Baris ${index + 1}: Tablet Diterima/Diminum kosong atau tidak valid`);
              return;
            }
            parsed.push({
              studentId: student.id,
              schoolId: student.schoolId,
              academicYear,
              date: excelCellToISODate(row['Tanggal (YYYY-MM-DD)']) || new Date().toISOString().split('T')[0],
              tabletsReceived: received,
              tabletsConsumed: consumed,
              isCompliant: consumed >= received,
              notes: row['Catatan'] || '',
              createdBy: '',
            });
          }
        });

        if (parsed.length > 0) {
          // Paksa scope koordinator server-side: baris sekolah lain dilewati.
          const scopedRecords = scopedSchoolId
            ? parsed.filter((r) => r.schoolId === scopedSchoolId)
            : parsed;
          const scopeSkipped = parsed.length - scopedRecords.length;
          if (skippedRows.length > 0 || scopeSkipped > 0) {
            const parts = [...skippedRows];
            if (scopeSkipped > 0) parts.push(`${scopeSkipped} baris di luar sekolah Anda`);
            toast.error(`${parts.length} baris dilewati: ${parts.join('; ')}`);
          }
          if (scopedRecords.length === 0) {
            toast.error("Tidak ada data valid untuk sekolah Anda");
            return;
          }
          void (async () => {
            setIsImporting(true);
            try {
              const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
              const { data: inserted, error } = await supabase
                .from('ttd_compliance')
                .insert(scopedRecords.map((r) => ttdToInsert({ ...r, notes: r.notes ?? '', createdBy })))
                .select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by');
              if (error || !inserted) {
                toast.error('Gagal mengimpor data kepatuhan TTD. Periksa koneksi dan coba lagi.');
                return;
              }
              const created = (inserted as TTDComplianceRow[]).map(ttdRowToModel);
              setRecords((prev) => [...created, ...prev]);
              const skippedTotal = skippedRows.length + scopeSkipped;
              toast.success(`Berhasil mengimpor ${created.length} data kepatuhan TTD`, {
                description: skippedTotal > 0 ? `${skippedTotal} baris dilewati. TA ${academicYear}.` : `Data telah ditambahkan untuk TA ${academicYear}.`
              });
              setIsImportOpen(false);
            } finally {
              setIsImporting(false);
            }
          })();
        } else {
          toast.error("Tidak ada data valid yang ditemukan");
        }
      } catch (err) {
        toast.error("Gagal memproses file");
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Kepatuhan TTD</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              Remaja Putri
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Pencatatan konsumsi Tablet Tambah Darah mingguan.</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all">
                <Upload className="w-4 h-4" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Import Data Kepatuhan TTD</DialogTitle>
                <DialogDescription>Unggah file Excel berisi data konsumsi tablet tambah darah siswa.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="p-4 bg-primary/10 rounded-full">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">Klik untuk pilih file</p>
                    <p className="text-xs text-slate-500">Format .xlsx atau .csv</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleImportFile}
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Petunjuk:</h4>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                    <li>Gunakan template yang telah disediakan</li>
                    <li>Pastikan NIK atau Nama Siswa sesuai dengan data di sistem</li>
                    <li>Format tanggal adalah YYYY-MM-DD</li>
                  </ul>
                  <Button variant="link" className="p-0 h-auto text-xs mt-3 font-bold" onClick={downloadTemplate}>
                    <Download className="w-3 h-3 mr-1" /> Download Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>

          <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setStudentQuery(''); setIsOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => resetForm()}>
                <Plus className="w-4 h-4" /> Catat Kepatuhan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">{editingId ? 'Edit Konsumsi TTD' : 'Catat Konsumsi TTD'}</DialogTitle>
                <DialogDescription className="font-medium">Masukkan data konsumsi tablet tambah darah siswa.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Siswa (Remaja Putri)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama/NIK/kelas…"
                      className="pl-10 rounded-xl border-slate-200"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                    />
                  </div>
                  <Select value={studentId} onValueChange={(id) => {
                    setStudentId(id);
                    const s = students.find(st => st.id === id);
                    if (s) setSchoolId(s.schoolId);
                  }}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue placeholder="Pilih siswa">{students.find((s) => s.id === studentId)?.name ?? (studentId ? 'Siswa tidak tersedia' : undefined)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {students.filter(s => s.gender === 'P' && (!scopedSchoolId || s.schoolId === scopedSchoolId) && (studentQuery.trim() === '' || s.name.toLowerCase().includes(studentQuery.trim().toLowerCase()) || (s.nik ?? '').includes(studentQuery.trim()) || (s.class ?? '').toLowerCase().includes(studentQuery.trim().toLowerCase()))).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} (Kelas {s.class})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Tanggal Pemberian</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Tablet Diterima</Label>
                    <Input type="number" value={tabletsReceived} onChange={(e) => setTabletsReceived(e.target.value)} className="rounded-xl border-slate-200" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Tablet Diminum</Label>
                    <Input type="number" value={tabletsConsumed} onChange={(e) => setTabletsConsumed(e.target.value)} className="rounded-xl border-slate-200" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Catatan</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl border-slate-200" placeholder="Keterangan tambahan..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void handleSaveRecord()} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">{isSaving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Simpan Catatan'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama siswa atau sekolah..."
            className="pl-10 h-11 rounded-xl border-slate-200 bg-white/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!isKoordinator && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
              <SelectValue placeholder="Semua Sekolah">{schoolFilter === 'all' ? undefined : (schools.find((s) => s.id === schoolFilter)?.name ?? 'Sekolah tidak tersedia')}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Sekolah</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
            <SelectValue placeholder="Semua Bulan">{monthFilter === 'all' ? undefined : (['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(monthFilter) - 1] ?? 'Bulan tidak tersedia')}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Bulan</SelectItem>
            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((label, i) => (
              <SelectItem key={String(i + 1)} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={complianceFilter} onValueChange={(v) => setComplianceFilter(v as 'all' | 'compliant' | 'noncompliant')}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
            <SelectValue placeholder="Semua Status">{complianceFilter === 'all' ? undefined : (complianceFilter === 'compliant' ? 'Patuh' : 'Tidak Patuh')}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="compliant">Patuh</SelectItem>
            <SelectItem value="noncompliant">Tidak Patuh</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-muted-foreground font-medium">Memuat data kepatuhan TTD…</p>
        </div>
      )}
      {!isLoading && loadError && (
        <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-muted-foreground font-medium mb-3">{loadError}</p>
          <Button variant="outline" onClick={() => void loadRecords()}>Coba lagi</Button>
        </div>
      )}
      {!isLoading && !loadError && (
      <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Tgl Laporan</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama Siswa</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4 text-center">Diterima</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4 text-center">Diminum</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Status</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(groupedRecords).length > 0 ? (
              (Object.entries(groupedRecords) as [string, ComplianceRecord[]][]).map(([schoolName, schoolRecords]) => (
                <React.Fragment key={schoolName}>
                  <TableRow className="bg-slate-100/50 hover:bg-slate-100/50">
                    <TableCell colSpan={6} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <SchoolIcon className="w-4 h-4 text-primary" />
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{schoolName}</span>
                        <Badge variant="outline" className="ml-2 rounded-full bg-white text-[10px] font-bold">
                          {schoolRecords.length} Catatan
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                  {schoolRecords.map((record) => (
                    <TableRow key={record.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                      <TableCell className="text-sm py-4">
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                          <CalendarIcon className="w-4 h-4 text-primary/60" />
                          {new Date(record.date).toLocaleDateString('id-ID')}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-bold text-slate-700">{record.studentName}</div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase">Kelas {record.studentClass}</div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="outline" className="rounded-lg font-mono">{record.tabletsReceived}</Badge>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="secondary" className="rounded-lg font-mono">{record.tabletsConsumed}</Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        {record.isCompliant ? (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 gap-1 rounded-lg px-2 py-1">
                            <CheckCircle2 className="w-3 h-3" /> Patuh
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 gap-1 rounded-lg px-2 py-1">
                            <XCircle className="w-3 h-3" /> Tidak Patuh
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleEditRecord(record)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Hapus"
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTargetId(record.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Tidak ada data ditemukan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}
      <ConfirmDeleteDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        itemName={deleteTargetLabel}
        description={deleteTargetLabel ? `Catatan kepatuhan "${deleteTargetLabel}" akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTargetId) void handleDeleteRecord(deleteTargetId); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
