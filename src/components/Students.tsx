import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Download, Upload, FileSpreadsheet, AlertCircle, Trash2, Edit, Calendar, Clock } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { School, Student, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { calculateAgeDetails, calculateAgeYears } from '@/lib/ageUtils';

interface StudentsProps {
  academicYear: string;
  currentUser?: User;
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

interface SchoolRefRow {
  id: string;
  name: string;
  type: School['type'];
}

// Satu-satunya titik pemetaan snake_case (students/schools) <-> camelCase
// (Student/School), mirror Users.tsx. `age` tidak dipersist (dihitung saat
// render via calculateAgeYears dari birth_date). Koordinator RLS otomatis
// membatasi baca; dropdown hanya UX, bukan keamanan.
function studentRowToStudent(row: StudentRow): Student {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    gender: row.gender,
    birthDate: row.birth_date ?? '',
    age: calculateAgeYears(row.birth_date ?? ''),
    class: row.class,
    nik: row.nik,
    parentName: row.parent_name,
    whatsapp: row.whatsapp,
    address: row.address ?? { rt: '', rw: '', desa: '', kecamatan: '', kabupaten: '', provinsi: '' },
    studentIdNumber: row.student_id_number ?? '',
  };
}

function studentToInsert(s: Omit<Student, 'id' | 'age'>) {
  return {
    school_id: s.schoolId,
    name: s.name,
    gender: s.gender,
    birth_date: s.birthDate,
    class: s.class,
    nik: s.nik,
    parent_name: s.parentName,
    whatsapp: s.whatsapp,
    address: s.address,
    student_id_number: s.studentIdNumber || null,
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

export function Students({ academicYear: currentAcademicYear, currentUser }: StudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  const schoolNames = useMemo(() => {
    return schools.reduce((acc, s) => {
      acc[s.id] = s.name;
      return acc;
    }, {} as Record<string, string>);
  }, [schools]);

  // Koordinator dibatasi ke sekolahnya sendiri; dropdown/filter hanya UX,
  // penegakan scope dilakukan server-side di handler impor (baris sekolah
  // lain dilewati dan dihitung sebagai skipped).
  const isKoordinator = currentUser?.role === 'koordinator';
  const scopedSchoolId = isKoordinator ? currentUser?.schoolId : undefined;

  // Pagination: filter dulu (search/sekolah/scope), baru slice halaman.
  // Reset ke halaman 1 setiap input filter/scope berubah.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, schoolFilter, scopedSchoolId, currentAcademicYear]);

  const loadStudents = async () => {
    setIsLoading(true);
    setLoadError(null);
    const [schoolRes, studentRes] = await Promise.all([
      supabase.from('schools').select('id, name, type').order('name', { ascending: true }),
      supabase.from('students').select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number').order('name', { ascending: true }),
    ]);
    if (schoolRes.error || studentRes.error || !schoolRes.data || !studentRes.data) {
      toast.error('Gagal memuat data siswa. Periksa koneksi dan coba lagi.');
      setStudents([]);
      setSchools([]);
      setLoadError('Gagal memuat data siswa.');
    } else {
      setSchools((schoolRes.data as SchoolRefRow[]).map((r) => ({ id: r.id, name: r.name, address: '', coordinatorName: '', phone: '-', type: r.type })));
      setStudents((studentRes.data as StudentRow[]).map(studentRowToStudent));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadStudents();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form state
  const [newName, setNewName] = useState('');
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newNISN, setNewNISN] = useState('');
  const [newNIK, setNewNIK] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newRT, setNewRT] = useState('');
  const [newRW, setNewRW] = useState('');
  const [newDesa, setNewDesa] = useState('');
  const [newKecamatan, setNewKecamatan] = useState('');
  const [newKabupaten, setNewKabupaten] = useState('');
  const [newProvinsi, setNewProvinsi] = useState('');

  // Real-time calculated age detail from input birth date
  const ageDetail = calculateAgeDetails(newBirthDate);

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.nik?.includes(searchTerm) ||
                          student.studentIdNumber?.includes(searchTerm);
    const matchesSchool = schoolFilter === 'all' || student.schoolId === schoolFilter;
    return matchesSearch && matchesSchool;
  });

  const totalCount = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, totalCount);
  const pagedStudents = filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const groupedStudents = pagedStudents.reduce((acc, student) => {
    const schoolId = student.schoolId;
    if (!acc[schoolId]) {
      acc[schoolId] = [];
    }
    acc[schoolId].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  const handleSaveStudent = async () => {
    if (isSaving) return;
    if (!newName || !newSchoolId || !newClass) {
      toast.error("Mohon isi nama, sekolah, dan kelas");
      return;
    }
    if (newNIK && !/^\d{16}$/.test(newNIK)) {
      toast.error("NIK harus terdiri dari 16 digit angka");
      return;
    }

    setIsSaving(true);
    try {
      // NIK dicek ke database (bukan hanya memori) agar duplikat antar sesi ketahuan.
    if (newNIK) {
      const { data: nikHit, error: nikError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: false })
        .eq('nik', newNIK)
        .limit(1);
      if (nikError) {
        toast.error('Gagal memeriksa NIK. Periksa koneksi dan coba lagi.');
        return;
      }
      if (nikHit && nikHit.length > 0) {
        toast.error("NIK sudah terdaftar untuk siswa lain");
        return;
      }
    }

    const payload = {
      schoolId: newSchoolId,
      name: newName,
      gender: newGender,
      birthDate: newBirthDate,
      class: newClass,
      nik: newNIK,
      parentName: newParentName,
      whatsapp: newWhatsapp,
      address: {
        rt: newRT,
        rw: newRW,
        desa: newDesa,
        kecamatan: newKecamatan,
        kabupaten: newKabupaten,
        provinsi: newProvinsi,
      },
      studentIdNumber: newNISN,
    };

      const { data, error } = await supabase
        .from('students')
        .insert(studentToInsert(payload))
        .select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number')
        .single();
      if (error || !data) {
        toast.error('Gagal menambahkan siswa. Periksa koneksi dan coba lagi.');
        return;
      }
      const created = studentRowToStudent(data as StudentRow);
      setStudents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Siswa berhasil ditambahkan", {
        description: `${newName} (${ageDetail.formatted}) telah terdaftar.`
      });

      // Reset form
      resetForm();
      setIsAddOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (student: Student) => {
    resetForm();
    setEditingStudent(student);
    setNewName(student.name);
    setNewSchoolId(student.schoolId);
    setNewGender(student.gender);
    setNewBirthDate(student.birthDate || '');
    setNewClass(student.class);
    setNewNISN(student.studentIdNumber || '');
    setNewNIK(student.nik || '');
    setNewParentName(student.parentName || '');
    setNewWhatsapp(student.whatsapp || '');
    setNewRT(student.address?.rt || '');
    setNewRW(student.address?.rw || '');
    setNewDesa(student.address?.desa || '');
    setNewKecamatan(student.address?.kecamatan || '');
    setNewKabupaten(student.address?.kabupaten || '');
    setNewProvinsi(student.address?.provinsi || '');
    setIsEditOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    if (!newName || !newSchoolId || !newClass) {
      toast.error("Mohon isi nama, sekolah, dan kelas");
      return;
    }
    if (newNIK && !/^\d{16}$/.test(newNIK)) {
      toast.error("NIK harus terdiri dari 16 digit angka");
      return;
    }

    if (newNIK) {
      const { data: nikHit, error: nikError } = await supabase
        .from('students')
        .select('id')
        .eq('nik', newNIK)
        .neq('id', editingStudent.id)
        .limit(1);
      if (nikError) {
        toast.error('Gagal memeriksa NIK. Periksa koneksi dan coba lagi.');
        return;
      }
      if (nikHit && nikHit.length > 0) {
        toast.error("NIK sudah terdaftar untuk siswa lain");
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .update(studentToInsert({
          schoolId: newSchoolId,
          name: newName,
          gender: newGender,
          birthDate: newBirthDate,
          class: newClass,
          nik: newNIK,
          parentName: newParentName,
          whatsapp: newWhatsapp,
          address: {
            rt: newRT,
            rw: newRW,
            desa: newDesa,
            kecamatan: newKecamatan,
            kabupaten: newKabupaten,
            provinsi: newProvinsi,
          },
          studentIdNumber: newNISN,
        }))
        .eq('id', editingStudent.id)
        .select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number')
        .single();
      if (error || !data) {
        toast.error('Gagal memperbarui siswa. Periksa koneksi dan coba lagi.');
        return;
      }
      const updatedStudent = studentRowToStudent(data as StudentRow);
      setStudents((prev) => prev.map(s => s.id === editingStudent.id ? updatedStudent : s));
      toast.success("Data siswa berhasil diperbarui", {
        description: `Umur siswa diperbarui otomatis: ${ageDetail.formatted}`
      });

      resetForm();
      setEditingStudent(null);
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewSchoolId('');
    setNewGender('L');
    setNewBirthDate('');
    setNewClass('');
    setNewNISN('');
    setNewNIK('');
    setNewParentName('');
    setNewWhatsapp('');
    setNewRT('');
    setNewRW('');
    setNewDesa('');
    setNewKecamatan('');
    setNewKabupaten('');
    setNewProvinsi('');
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    setIsDeleting(true);
    try {
    const [{ count: screeningCount }, { count: ttdCount }] = await Promise.all([
      supabase.from('screenings').select('id', { count: 'exact', head: true }).eq('student_id', id),
      supabase.from('ttd_compliance').select('id', { count: 'exact', head: true }).eq('student_id', id),
    ]);
    const blockers: string[] = [];
    if ((screeningCount ?? 0) > 0) blockers.push(`${screeningCount} data pemeriksaan`);
    if ((ttdCount ?? 0) > 0) blockers.push(`${ttdCount} data TTD`);
    if (blockers.length > 0) {
      toast.error(`Tidak dapat menghapus: siswa masih memiliki ${blockers.join(' dan ')}`);
      return;
    }
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus siswa. Data mungkin masih dipakai. Coba lagi.');
      return;
    }
    setStudents((prev) => prev.filter(s => s.id !== id));
    toast.success(`Siswa ${name} berhasil dihapus`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const resolveImportSchoolId = (cell: unknown): string | null => {
    const raw = cell?.toString().trim() ?? '';
    if (!raw) return null;
    // 1) cocok langsung uuid/id sekolah (hasil export ber-id)
    const byId = schools.find((s) => s.id === raw);
    if (byId) return byId.id;
    // 2) cocok persis nama sekolah (tak peduli kapital)
    const byName = schools.find((s) => s.name.toLowerCase() === raw.toLowerCase());
    if (byName) return byName.id;
    // Tidak dikenal -> null, baris dilewati dengan pesan (tanpa tebakan substring).
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

        if (data.length === 0) {
          toast.error("File kosong atau format tidak sesuai");
          return;
        }
        if (schools.length === 0) {
          toast.error("Belum ada data sekolah. Tambahkan sekolah dulu sebelum impor.");
          return;
        }

        const skippedRows: string[] = [];
        let errorCount = 0;
        const parsed: {
          schoolId: string;
          name: string;
          gender: 'L' | 'P';
          birthDate: string;
          class: string;
          nik: string;
          parentName: string;
          whatsapp: string;
          address: { rt: string; rw: string; desa: string; kecamatan: string; kabupaten: string; provinsi: string };
          studentIdNumber: string;
        }[] = [];
        data.forEach((row, index) => {
          const rawSchool = row['Nama Sekolah']?.toString().trim() ?? '';
          const schoolId = resolveImportSchoolId(row['Nama Sekolah']);
          if (!schoolId) {
            skippedRows.push(rawSchool
              ? `Baris ${index + 1}: sekolah '${rawSchool}' tidak dikenal — buat dulu di menu Sekolah atau perbaiki typo`
              : `Baris ${index + 1}: sekolah kosong — buat dulu di menu Sekolah atau perbaiki typo`);
            errorCount++;
            return;
          }
          const rawNik = row['NIK']?.toString().trim() ?? '';
          if (rawNik && !/^\d{16}$/.test(rawNik)) {
            skippedRows.push(`Baris ${index + 1}: NIK '${rawNik}' tidak valid — harus 16 digit angka`);
            errorCount++;
            return;
          }
          parsed.push({
            schoolId,
            name: row['Nama Siswa']?.toString() || 'Unknown',
            gender: (row['Jenis Kelamin (L/P)']?.toString() || 'L') as 'L' | 'P',
            birthDate: excelCellToISODate(row['Tanggal Lahir (YYYY-MM-DD)']),
            class: row['Kelas']?.toString() || '',
            nik: rawNik,
            parentName: row['Nama Orang Tua']?.toString() || '',
            whatsapp: row['Nomor WA']?.toString() || '',
            address: {
              rt: row['RT']?.toString() || '',
              rw: row['RW']?.toString() || '',
              desa: row['Desa']?.toString() || '',
              kecamatan: row['Kecamatan']?.toString() || '',
              kabupaten: row['Kabupaten']?.toString() || '',
              provinsi: row['Provinsi']?.toString() || '',
            },
            studentIdNumber: row['NISN (Opsional)']?.toString() || '',
          });
        });

        void (async () => {
          setIsImporting(true);
          try {
            // Paksa scope koordinator server-side: baris sekolah lain dilewati.
            const inScope = scopedSchoolId
              ? parsed.filter((r) => r.schoolId === scopedSchoolId)
              : parsed;
            const outOfScope = parsed.length - inScope.length;
            // Duplikat NIK dalam file dibuang (pakai kemunculan pertama).
            const seen = new Set<string>();
            const candidates = inScope.filter((r) => {
              if (!r.nik) return true;
              if (seen.has(r.nik)) return false;
              seen.add(r.nik);
              return true;
            });
            const dupInFile = inScope.length - candidates.length;
            if (candidates.length === 0) {
              const emptyReasons = [
                outOfScope > 0 ? `${outOfScope} baris di luar sekolah Anda` : '',
                errorCount > 0 ? `${errorCount} baris tidak valid (sekolah/NIK)` : '',
              ].filter(Boolean).join(', ');
              toast.error('Tidak ada data valid untuk diimpor.', {
                description: emptyReasons
                  ? `${emptyReasons}. ${skippedRows.slice(0, 3).join(' ')}`
                  : undefined,
              });
              return;
            }
            // Idempotent: baris ber-NIK di-upsert (NIK UNIQUE → UPDATE bila
            // sudah ada, INSERT bila baru); baris tanpa NIK selalu INSERT.
            const withNik = candidates.filter((r) => r.nik !== '');
            const withoutNik = candidates.filter((r) => r.nik === '');
            let okCount = 0;
            if (withNik.length > 0) {
              const { error: upsertError } = await supabase
                .from('students')
                .upsert(withNik.map((r) => studentToInsert(r)), { onConflict: 'nik' });
              if (upsertError) {
                toast.error('Gagal mengimpor data siswa. Periksa koneksi dan coba lagi.');
                return;
              }
              okCount += withNik.length;
            }
            if (withoutNik.length > 0) {
              const { error: insertError } = await supabase
                .from('students')
                .insert(withoutNik.map((r) => studentToInsert(r)));
              if (insertError) {
                toast.error('Gagal mengimpor data siswa tanpa NIK. Periksa koneksi dan coba lagi.');
                return;
              }
              okCount += withoutNik.length;
            }
            const skipped = outOfScope + dupInFile + errorCount;
            await loadStudents();
            toast.success(`${okCount} data siswa berhasil diimpor.`, {
              description: skipped > 0
                ? `${skipped} baris dilewati (di luar scope/duplikat/sekolah tidak dikenal/NIK tidak valid)${errorCount > 0 ? `: ${skippedRows.slice(0, 3).join(' ')}` : ''}. TA ${currentAcademicYear}.`
                : `Data telah ditambahkan/diperbarui untuk TA ${currentAcademicYear}.`
            });
            setIsImportOpen(false);
          } finally {
            setIsImporting(false);
          }
        })();
      } catch {
        toast.error("Gagal membaca file", {
          description: "Pastikan format file Excel (.xlsx atau .csv) sudah benar."
        });
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  const handleExport = () => {
    // Kolom persis mirror template_import_siswa agar export<->import round-trip.
    const dataToExport = filteredStudents.map((s) => ({
      'Nama Sekolah': schoolNames[s.schoolId] ?? '',
      'Nama Siswa': s.name,
      'Tanggal Lahir (YYYY-MM-DD)': s.birthDate ? s.birthDate.slice(0, 10) : '',
      'Jenis Kelamin (L/P)': s.gender,
      'Kelas': s.class,
      'NIK': s.nik,
      'Nama Orang Tua': s.parentName,
      'Nomor WA': s.whatsapp,
      'RT': s.address?.rt ?? '',
      'RW': s.address?.rw ?? '',
      'Desa': s.address?.desa ?? '',
      'Kecamatan': s.address?.kecamatan ?? '',
      'Kabupaten': s.address?.kabupaten ?? '',
      'Provinsi': s.address?.provinsi ?? '',
      'NISN (Opsional)': s.studentIdNumber ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, `data-siswa-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Berhasil mengekspor ${dataToExport.length} data siswa`);
  };

  const downloadTemplate = () => {    const template = [
      { 
        "Nama Sekolah": "SDN 01 Kota",
        "Nama Siswa": "Andi Pratama", 
        "Tanggal Lahir (YYYY-MM-DD)": "2015-05-12", 
        "Jenis Kelamin (L/P)": "L", 
        "Kelas": "3A", 
        "NIK": "3201011205150001",
        "Nama Orang Tua": "Budi Pratama",
        "Nomor WA": "081234567890",
        "RT": "01",
        "RW": "02",
        "Desa": "Sukamaju",
        "Kecamatan": "Ciawi",
        "Kabupaten": "Bogor",
        "Provinsi": "Jawa Barat",
        "NISN (Opsional)": "12345678"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Import");
    XLSX.writeFile(wb, "template_import_siswa.xlsx");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Data Siswa</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Daftar siswa dari seluruh sekolah binaan.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all">
                <Upload className="w-4 h-4" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">Import Data Siswa</DialogTitle>
                <DialogDescription className="font-medium">
                  Unggah file Excel (.xlsx) atau CSV untuk memasukkan data siswa secara massal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">Klik untuk pilih file atau seret ke sini</p>
                  <p className="text-xs text-muted-foreground mt-1">Mendukung .xlsx, .xls, .csv</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md text-blue-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>Gunakan template yang disediakan untuk memastikan format data sesuai dengan sistem.</p>
                </div>
                <Button variant="link" className="h-auto p-0 justify-start" onClick={downloadTemplate}>
                  Unduh Template Excel
                </Button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Batal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => { resetForm(); setEditingStudent(null); }}>
                <Plus className="w-4 h-4" /> Tambah Siswa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">Tambah Siswa Baru</DialogTitle>
                <DialogDescription className="font-medium">Masukkan data diri siswa baru secara lengkap.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="s_school" className="font-bold text-slate-700">Nama Sekolah</Label>
                    <Select value={newSchoolId} onValueChange={setNewSchoolId}>
                      <SelectTrigger id="s_school" className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih sekolah">{schools.find((s) => s.id === newSchoolId)?.name ?? (newSchoolId ? 'Sekolah tidak tersedia' : undefined)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {schools.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s_name" className="font-bold text-slate-700">Nama Siswa</Label>
                    <Input 
                      id="s_name" 
                      placeholder="Nama lengkap siswa" 
                      className="rounded-xl border-slate-200"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="s_birth" className="font-bold text-slate-700">Tanggal Lahir</Label>
                    <Input 
                      id="s_birth" 
                      type="date" 
                      className="rounded-xl border-slate-200"
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 col-span-2">
                    <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Usia Siswa (Otomatis Dihitung)</span>
                    </Label>
                    <div className="h-10 flex items-center px-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-sm shadow-xs gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{ageDetail.formatted}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Jenis Kelamin</Label>
                    <Select value={newGender} onValueChange={(v: 'L' | 'P') => setNewGender(v)}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih JK" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s_class" className="font-bold text-slate-700">Kelas</Label>
                    <Input 
                      id="s_class" 
                      placeholder="Contoh: 3A" 
                      className="rounded-xl border-slate-200"
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s_nik" className="font-bold text-slate-700">NIK</Label>
                    <Input 
                      id="s_nik" 
                      placeholder="Nomor NIK (16 digit)" 
                      inputMode="numeric"
                      maxLength={16}
                      className="rounded-xl border-slate-200"
                      value={newNIK}
                      onChange={(e) => setNewNIK(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s_nisn" className="font-bold text-slate-700">NISN (Opsional)</Label>
                    <Input
                      id="s_nisn"
                      placeholder="Nomor NISN"
                      className="rounded-xl border-slate-200"
                      value={newNISN}
                      onChange={(e) => setNewNISN(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="s_parent" className="font-bold text-slate-700">Nama Orang Tua</Label>
                    <Input 
                      id="s_parent" 
                      placeholder="Nama orang tua/wali" 
                      className="rounded-xl border-slate-200"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s_wa" className="font-bold text-slate-700">Nomor WA</Label>
                    <Input 
                      id="s_wa" 
                      placeholder="08xxxxxxxxxx" 
                      className="rounded-xl border-slate-200"
                      value={newWhatsapp}
                      onChange={(e) => setNewWhatsapp(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold text-slate-800 border-b pb-1 block">Alamat Lengkap</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="addr_rt">RT</Label>
                      <Input id="addr_rt" placeholder="00" value={newRT} onChange={(e) => setNewRT(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="addr_rw">RW</Label>
                      <Input id="addr_rw" placeholder="00" value={newRW} onChange={(e) => setNewRW(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="addr_desa">Desa/Kelurahan</Label>
                      <Input id="addr_desa" placeholder="Nama desa" value={newDesa} onChange={(e) => setNewDesa(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="addr_kec">Kecamatan</Label>
                      <Input id="addr_kec" placeholder="Nama kecamatan" value={newKecamatan} onChange={(e) => setNewKecamatan(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="addr_kab">Kabupaten/Kota</Label>
                      <Input id="addr_kab" placeholder="Nama kabupaten" value={newKabupaten} onChange={(e) => setNewKabupaten(e.target.value)} className="rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="addr_prov">Provinsi</Label>
                      <Input id="addr_prov" placeholder="Nama provinsi" value={newProvinsi} onChange={(e) => setNewProvinsi(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void handleSaveStudent()} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">{isSaving ? 'Menyimpan…' : 'Simpan Siswa'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama siswa..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter Sekolah">{schoolFilter === 'all' ? undefined : (schools.find((s) => s.id === schoolFilter)?.name ?? 'Sekolah tidak tersedia')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sekolah</SelectItem>
              {schools.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-muted-foreground font-medium">Memuat data siswa…</p>
        </div>
      )}
      {!isLoading && loadError && (
        <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-muted-foreground font-medium mb-3">{loadError}</p>
          <Button variant="outline" onClick={() => void loadStudents()}>Coba lagi</Button>
        </div>
      )}
      {!isLoading && !loadError && (
      <div className="space-y-8">
        {(Object.entries(groupedStudents) as [string, Student[]][]).length > 0 ? (
          (Object.entries(groupedStudents) as [string, Student[]][]).map(([schoolId, schoolStudents]) => (
            <div key={schoolId} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="text-lg font-bold text-slate-800">
                  {schoolNames[schoolId] || 'Sekolah Lain'}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    ({schoolStudents.length} Siswa)
                  </span>
                </h3>
              </div>
              <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama Siswa</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">NIK</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">JK</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Usia</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Kelas</TableHead>
                      <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolStudents.map((student) => (
                      <TableRow key={student.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                        <TableCell className="font-bold text-slate-700 py-4">{student.name}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs py-4">{student.nik}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                            {student.gender}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-bold text-sm">
                              {student.birthDate ? calculateAgeDetails(student.birthDate).shortFormatted : `${student.age} Thn`}
                            </span>
                            {student.birthDate && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(student.birthDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 font-medium py-4">{student.class}</TableCell>
                        <TableCell className="text-right py-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Lihat detail"
                              className="rounded-lg font-bold text-primary hover:bg-primary/10"
                              onClick={() => handleViewDetail(student)}
                            >
                              Detail
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleOpenEdit(student)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Hapus"
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget({ id: student.id, name: student.name })}
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
          ))
        ) : (
          <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-muted-foreground font-medium">Tidak ada data siswa yang ditemukan.</p>
          </div>
        )}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
            <p className="text-sm font-medium text-muted-foreground">{pageStart}-{pageEnd} dari {totalCount}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Sebelumnya</Button>
              <span className="text-sm font-bold text-slate-700">{safePage}/{totalPages}</span>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Berikutnya</Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Detail Siswa</DialogTitle>
            <DialogDescription className="font-medium">Informasi lengkap data diri siswa.</DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="grid gap-6 py-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium">NIK: {selectedStudent.nik}</p>
                  <p className="text-xs text-muted-foreground font-medium">NISN: {selectedStudent.studentIdNumber || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Sekolah</p>
                  <p className="text-sm font-bold text-slate-700">
                    {schoolNames[selectedStudent.schoolId] || 'Sekolah Lain'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Kelas</p>
                  <p className="text-sm font-bold text-slate-700">{selectedStudent.class}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Usia (Otomatis)</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {selectedStudent.birthDate ? calculateAgeDetails(selectedStudent.birthDate).formatted : `${selectedStudent.age} Tahun`}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Jenis Kelamin</p>
                  <p className="text-sm font-bold text-slate-700">{selectedStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Tanggal Lahir</p>
                  <p className="text-sm font-bold text-slate-700">
                    {selectedStudent.birthDate ? new Date(selectedStudent.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nama Orang Tua</p>
                  <p className="text-sm font-bold text-slate-700">{selectedStudent.parentName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nomor WA</p>
                  <p className="text-sm font-bold text-slate-700">{selectedStudent.whatsapp}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Alamat Lengkap</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <p className="font-bold text-slate-700">RT {selectedStudent.address.rt} / RW {selectedStudent.address.rw}</p>
                  <p className="text-slate-600">Desa {selectedStudent.address.desa}, Kec. {selectedStudent.address.kecamatan}</p>
                  <p className="text-slate-600">{selectedStudent.address.kabupaten}, {selectedStudent.address.provinsi}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="w-full h-12 rounded-xl font-bold">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { resetForm(); setEditingStudent(null); } setIsEditOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Edit Data Siswa</DialogTitle>
            <DialogDescription className="font-medium">Perbarui data diri siswa. Umur akan terhitung otomatis saat tanggal lahir diubah.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="e_school" className="font-bold text-slate-700">Nama Sekolah</Label>
                <Select value={newSchoolId} onValueChange={setNewSchoolId}>
<SelectTrigger id="e_school" className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih sekolah">{schools.find((s) => s.id === newSchoolId)?.name ?? (newSchoolId ? 'Sekolah tidak tersedia' : undefined)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e_name" className="font-bold text-slate-700">Nama Siswa</Label>
                <Input 
                  id="e_name" 
                  placeholder="Nama lengkap siswa" 
                  className="rounded-xl border-slate-200"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="e_birth" className="font-bold text-slate-700">Tanggal Lahir</Label>
                <Input 
                  id="e_birth" 
                  type="date" 
                  className="rounded-xl border-slate-200"
                  value={newBirthDate}
                  onChange={(e) => setNewBirthDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Usia Siswa (Otomatis Dihitung)</span>
                </Label>
                <div className="h-10 flex items-center px-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-sm shadow-xs gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{ageDetail.formatted}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="font-bold text-slate-700">Jenis Kelamin</Label>
                <Select value={newGender} onValueChange={(v: 'L' | 'P') => setNewGender(v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih JK" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e_class" className="font-bold text-slate-700">Kelas</Label>
                <Input 
                  id="e_class" 
                  placeholder="Contoh: 3A" 
                  className="rounded-xl border-slate-200"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e_nik" className="font-bold text-slate-700">NIK</Label>
                <Input 
                  id="e_nik" 
                  placeholder="Nomor NIK (16 digit)" 
                  inputMode="numeric"
                  maxLength={16}
                  className="rounded-xl border-slate-200"
                  value={newNIK}
                  onChange={(e) => setNewNIK(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e_nisn" className="font-bold text-slate-700">NISN (Opsional)</Label>
                <Input
                  id="e_nisn"
                  placeholder="Nomor NISN"
                  className="rounded-xl border-slate-200"
                  value={newNISN}
                  onChange={(e) => setNewNISN(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="e_parent" className="font-bold text-slate-700">Nama Orang Tua</Label>
                <Input 
                  id="e_parent" 
                  placeholder="Nama orang tua/wali" 
                  className="rounded-xl border-slate-200"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e_wa" className="font-bold text-slate-700">Nomor WA</Label>
                <Input 
                  id="e_wa" 
                  placeholder="08xxxxxxxxxx" 
                  className="rounded-xl border-slate-200"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-bold text-slate-800 border-b pb-1 block">Alamat Lengkap</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_rt">RT</Label>
                  <Input id="e_addr_rt" placeholder="00" value={newRT} onChange={(e) => setNewRT(e.target.value)} className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_rw">RW</Label>
                  <Input id="e_addr_rw" placeholder="00" value={newRW} onChange={(e) => setNewRW(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_desa">Desa/Kelurahan</Label>
                  <Input id="e_addr_desa" placeholder="Nama desa" value={newDesa} onChange={(e) => setNewDesa(e.target.value)} className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_kec">Kecamatan</Label>
                  <Input id="e_addr_kec" placeholder="Nama kecamatan" value={newKecamatan} onChange={(e) => setNewKecamatan(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_kab">Kabupaten/Kota</Label>
                  <Input id="e_addr_kab" placeholder="Nama kabupaten" value={newKabupaten} onChange={(e) => setNewKabupaten(e.target.value)} className="rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e_addr_prov">Provinsi</Label>
                  <Input id="e_addr_prov" placeholder="Nama provinsi" value={newProvinsi} onChange={(e) => setNewProvinsi(e.target.value)} className="rounded-xl" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateStudent} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemName={deleteTarget?.name ?? ''}
        description={deleteTarget ? `Siswa "${deleteTarget.name}" akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTarget) void handleDeleteStudent(deleteTarget.id, deleteTarget.name); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}

