import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Pill, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  Download, 
  FileSpreadsheet,
  Activity,
  School as SchoolIcon,
  Trash2,
  ChevronsUpDown,
  Check,
  Camera,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight
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
import { TTDCompliance, TTDDocumentation, TTDSlotDate, Student, School, User } from '../types';
import { supabase } from '@/lib/supabase';
import { compressToWebP, formatSizeId, type CompressResult } from '@/lib/image-compress';
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

// Baris snake_case public.ttd_documentations (0008/0009) -> camelCase
// TTDDocumentation. student_id NULLABLE sejak 0009 (school-level, code tidak
// lagi menulis/membacanya — hanya dipetakan best-effort untuk baris lama).
interface TTDDocRow {
  id: string;
  student_id: string | null;
  school_id: string;
  academic_year: string;
  photo_path: string;
  taken_at: string;
  created_by: string | null;
  created_by_name?: string | null;
}

function ttdDocRowToModel(row: TTDDocRow): TTDDocumentation {
  return {
    id: row.id,
    studentId: row.student_id ?? null,
    schoolId: row.school_id,
    academicYear: row.academic_year,
    photoPath: row.photo_path,
    takenAt: row.taken_at,
    createdBy: row.created_by ?? '',
    // Null-safe: baris pra-0012 tidak punya kolom/nilai -> null -> fallback lama.
    createdByName: row.created_by_name ?? null,
  };
}

type ResolvedDoc = TTDDocumentation & { schoolName: string };

// Baris snake_case public.ttd_slot_dates (0010) -> camelCase TTDSlotDate.
// Hanya slot yang DIKUSTOMISASI yang punya baris; tanpa baris = fallback ke
// default Jumat client-side (fridayDefaultsForMonth, tidak pernah disimpan).
interface TTDSlotDateRow {
  school_id: string;
  academic_year: string;
  month: number;
  week_index: number;
  slot_date: string;
}

function ttdSlotDateRowToModel(row: TTDSlotDateRow): Pick<TTDSlotDate, 'schoolId' | 'academicYear' | 'month' | 'weekIndex' | 'slotDate'> {
  return {
    schoolId: row.school_id,
    academicYear: row.academic_year,
    month: row.month,
    weekIndex: row.week_index,
    slotDate: row.slot_date.slice(0, 10),
  };
}

// Tanggal gaya id-ID tgl/bulan/tahun untuk semua tanggal user-visible
// (tabel, modal, tooltip, label hapus): 3/10/2026.
function formatDateId(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

// Tanggal-jam gaya id-ID untuk label galeri ("12 Sep 2024, 09.30").
function formatTakenAtId(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

// Agregasi per-siswi untuk grid mingguan: satu baris = satu siswi dalam
// filter bulan+sekolah aktif. `isCompliant` per record TIDAK diubah
// (consumed>=received; slot merah = 1/0 -> false). % baris = jumlah slot
// diminum / jumlah slot terisi (kosong dikecualikan) * 100, dibulatkan.
// Status: 'patuh' = 100%, 'kurang' = ada merah (<100%), 'nodata' = semua kosong.
type StudentComplianceStatus = 'patuh' | 'kurang' | 'nodata';

interface StudentComplianceSummary {
  student: Student;
  schoolName: string;
  records: ComplianceRecord[];
  slots: (ComplianceRecord | null)[];
  totalReceived: number;
  totalConsumed: number;
  pct: number | null;
  status: StudentComplianceStatus;
}

// Slot mingguan: hari 1-7 -> Pekan 1, 8-14 -> Pekan 2, 15-21 -> Pekan 3,
// 22-akhir -> Pekan 4. Dipilih karena Jumat ke-N selalu jatuh di blok ke-N
// (Jumat-1 di 1-7, Jumat-2 di 8-14, dst) sehingga mapping stabil.
function weekIndexFromDay(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function weekIndexFromISODate(iso: string): number | null {
  const day = Number(iso.slice(8, 10));
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return weekIndexFromDay(day);
}

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Default tanggal slot = Jumat ke-N bulan tersebut (minum TTD tiap Jumat).
// Selalu ada >=4 Jumat per bulan sehingga Pekan 1-4 terisi penuh.
function fridayDefaultsForMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  let firstFriday = -1;
  for (let d = 1; d <= 7; d++) {
    if (new Date(year, month - 1, d).getDay() === 5) { firstFriday = d; break; }
  }
  if (firstFriday < 0) firstFriday = 7;
  const out: string[] = [];
  for (let n = 0; n < 4; n++) {
    const day = Math.min(firstFriday + n * 7, daysInMonth);
    out.push(toISODate(year, month, day));
  }
  return out;
}

// Bulan 7-12 -> tahun awal TA ("2024/2025" -> 2024), bulan 1-6 -> tahun akhir.
function academicYearMonthToYear(academicYear: string, month: number): number {
  const m = academicYear.match(/(\d{4})\s*\/\s*(\d{4})/);
  if (m) return month >= 7 ? Number(m[1]) : Number(m[2]);
  return new Date().getFullYear();
}

function StudentCombobox({ students, value, onChange }: { students: Student[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  const q = query.trim().toLowerCase();
  const filtered = q === '' ? students : students.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.nik ?? '').includes(query.trim()) ||
    (s.class ?? '').toLowerCase().includes(q)
  );
  const selected = students.find(s => s.id === value);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => { setQuery(''); setOpen((v) => !v); }}
        className="w-full justify-between rounded-xl border-slate-200 font-medium"
      >
        <span className="truncate">{selected ? `${selected.name} (Kelas ${selected.class})` : 'Pilih siswa'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Cari nama/NIK/kelas…"
              className="pl-10 rounded-t-xl border-none shadow-none focus-visible:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-slate-500">Siswa tidak ditemukan</p>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s.id); setQuery(''); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-bold text-slate-800">{s.name}</span>
                    <span className="block text-xs font-medium text-slate-500">Kelas {s.class} • NIK {s.nik || '-'}</span>
                  </span>
                  {s.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

// Kalender mini Indonesia mandiri (tanpa dep): tombol menampilkan tanggal
// via formatDateId ("3/10/2026", "Pilih tanggal" bila kosong), panel kalender
// mengambang dengan panah bulan yang dikunci ke rentang [min,max].
function SlotDatePicker({ value, min, max, onChange, className, disabled, title }: { value: string; min?: string; max?: string; onChange: (iso: string) => void; className?: string; disabled?: boolean; title?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const anchor = parseISODate(value) ?? (min ? parseISODate(min) : null) ?? (max ? parseISODate(max) : null);
  const today = new Date();
  const [view, setView] = useState({ y: anchor?.y ?? today.getFullYear(), m: anchor?.m ?? today.getMonth() + 1 });

  // Samakan bulan tampil dengan tanggal/min saat panel dibuka.
  useEffect(() => {
    if (!open) return;
    const a = parseISODate(value) ?? (min ? parseISODate(min) : null) ?? (max ? parseISODate(max) : null);
    if (a) setView({ y: a.y, m: a.m });
  }, [open, value, min, max]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const minYM = min ? parseISODate(min) : null;
  const maxYM = max ? parseISODate(max) : null;
  const viewIdx = view.y * 12 + view.m;
  const canPrev = !minYM || viewIdx > minYM.y * 12 + minYM.m;
  const canNext = !maxYM || viewIdx < maxYM.y * 12 + maxYM.m;

  const daysInView = new Date(view.y, view.m, 0).getDate();
  const leadBlanks = new Date(view.y, view.m - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInView }, (_, i) => i + 1)];

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={`${className ?? 'mt-1 h-7 w-28 justify-between rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium normal-case tracking-normal text-slate-600'}${disabled ? ' cursor-not-allowed opacity-50' : ''}`}
      >
        <span className="truncate">{value ? formatDateId(value) : 'Pilih tanggal'}</span>
        <Calendar className="ml-1 h-3 w-3 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" disabled={!canPrev} onClick={() => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }))} className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-slate-700">{BULAN_ID[view.m - 1]} {view.y}</span>
            <Button type="button" variant="ghost" size="icon" disabled={!canNext} onClick={() => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }))} className="h-7 w-7">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {HARI_ID.map((h) => (
              <span key={h} className="py-1 text-[10px] font-bold uppercase text-slate-400">{h}</span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const iso = toISODate(view.y, view.m, day);
              const disabled = (!!min && iso < min) || (!!max && iso > max);
              const selected = value === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={`h-7 rounded-md text-[11px] font-medium transition-colors ${selected ? 'bg-primary font-bold text-white' : disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'patuh' | 'kurang' | 'nodata'>('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  // Default = bulan kalender berjalan (format kunci sama: String(getMonth()+1)).
  // 'Semua Bulan' ('all') tetap selectable sebagai agregat seluruh waktu.
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dokumentasi foto TTD (opsional, non-harian — state terpisah dari T10).
  const [docs, setDocs] = useState<TTDDocumentation[]>([]);
  const [docsError, setDocsError] = useState<'missing' | 'load' | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  // Foto yang gagal dibuatkan signed URL / gagal dimuat <img>: tampilkan
  // placeholder error eksplisit (bukan spinner tanpa akhir). imgBroken diisi
  // via onError <img>; signedErrors diisi saat createSignedUrl gagal.
  const [signedErrors, setSignedErrors] = useState<Record<string, string>>({});
  const [imgBroken, setImgBroken] = useState<Record<string, boolean>>({});
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docSchoolId, setDocSchoolId] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docCompressed, setDocCompressed] = useState<CompressResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [deleteDocTargetId, setDeleteDocTargetId] = useState<string | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  // Mirror cache signed URL (sumber kebenaran untuk hitung `missing` —
// dibaca langsung dari ref agar tidak bergantung pada closure state yang
  // basi; setiap penulisan state signed URL WAJIB lewat setUrl di bawah agar
  // ref selalu sinkron). Single-flight via signedInflightRef: dedup request
  // in-flight per foto. Tidak ada attempted-gate (vektor lock-up dihapus).
  const signedUrlsRef = useRef<Record<string, string>>({});
  const signedInflightRef = useRef<Set<string>>(new Set());

  // Satu-satunya penulis cache URL: tulis ref + state sekaligus.
  const setUrl = (id: string, url: string) => {
    signedUrlsRef.current[id] = url;
    setSignedUrls((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }));
  };

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

  // ── Dokumentasi foto (T11): loader + signed URLs + upload ──────────────
  // Foto OPSIONAL non-harian: tanpa validasi silang ke records kepatuhan.
  //
  // ROOT CAUSE foto tidak pernah load (round3, Playwright-verified): effect
  // [docs] membaca cache via setState-updater side effect
  // (setSignedUrls((prev) => { missing = ...; return prev; })) + ref-gate
  // attempted/inflight — fetch tidak pernah menyala (nol request storage,
  // tanpa error, spinner abadi) padahal server terbukti OK (sign 200).
  // FIX: hapus indirection effect + hapus attempted-ref total. loadDocs
  // memanggil ensureUrlsFor(fresh) LANGSUNG setelah setDocs; `missing`
  // dihitung dari signedUrlsRef (mirror yang ditulis di setiap setUrl);
  // single-flight via signedInflightRef saja. Cache URL valid dipertahankan
  // antar-load (hanya prune id yang hilang). Expiry tetap 3600s; bucket
  // tetap private; UI error + retry dipertahankan.
  // Prune entri cache milik doc yang sudah tidak ada (URL + error +
  // broken + inflight) agar tidak bocor antar-load. URL valid milik doc yang
  // masih ada dipertahankan sehingga refresh tidak memicu burst request.
  const pruneDocsCache = (liveIds: Set<string>) => {
    Object.keys(signedUrlsRef.current).forEach((id) => {
      if (!liveIds.has(id)) delete signedUrlsRef.current[id];
    });
    setSignedUrls({ ...signedUrlsRef.current });
    setSignedErrors((prev) => {
      const next: Record<string, string> = {};
      liveIds.forEach((id: string) => { if (prev[id]) next[id] = prev[id]; });
      return next;
    });
    setImgBroken((prev) => {
      const next: Record<string, boolean> = {};
      liveIds.forEach((id: string) => { if (prev[id]) next[id] = prev[id]; });
      return next;
    });
    signedInflightRef.current.forEach((id) => { if (!liveIds.has(id)) signedInflightRef.current.delete(id); });
  };

  // Fetch signed URL langsung (plain async, BUKAN effect): dipanggil dengan
  // array doc segar tepat setelah setDocs. `missing` dihitung dari
  // signedUrlsRef (bukan closure state, bukan setState-updater side effect).
  // Single-flight via signedInflightRef saja — tanpa attempted-gate.
  // Bucket PRIVATE, expiry 3600s; gagal -> signedErrors 'Gagal memuat foto.'.
  const ensureUrlsFor = async (targets: TTDDocumentation[]) => {
    const missing = targets.filter(
      (d) => !signedUrlsRef.current[d.id] && !signedInflightRef.current.has(d.id),
    );
    if (missing.length === 0) return;
    missing.forEach((d) => { signedInflightRef.current.add(d.id); });
    try {
      const entries = await Promise.all(
        missing.map(async (d) => {
          try {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('signed-url-timeout')), 15000),
            );
            const { data, error } = await Promise.race([
              supabase.storage.from('ttd-docs').createSignedUrl(d.photoPath, 3600),
              timeout,
            ]);
            return [d.id, !error && data ? data.signedUrl : null] as const;
          } catch {
            return [d.id, null] as const;
          }
        }),
      );
      const failed: string[] = [];
      entries.forEach(([id, url]) => {
        if (url) {
          setUrl(id, url);
        } else {
          failed.push(id);
        }
      });
      if (failed.length > 0) {
        setSignedErrors((prev) => {
          const next = { ...prev };
          failed.forEach((id) => { next[id] = 'Gagal memuat foto.'; });
          return next;
        });
      }
    } finally {
      missing.forEach((d) => { signedInflightRef.current.delete(d.id); });
    }
  };

  const loadDocs = async () => {
    const { data, error } = await supabase
      .from('ttd_documentations')
      .select('id, student_id, school_id, academic_year, photo_path, taken_at, created_by, created_by_name')
      .order('taken_at', { ascending: false });
    if (error || !data) {
      // 42P01 = tabel belum ada (migrasi 0008 belum dijalankan) -> empty
      // state ramah, bukan toast merah.
      setDocs([]);
      pruneDocsCache(new Set<string>());
      setDocsError(error?.code === '42P01' ? 'missing' : 'load');
      return;
    }
    const fresh = (data as TTDDocRow[]).map(ttdDocRowToModel);
    setDocs(fresh);
    setDocsError(null);
    pruneDocsCache(new Set<string>(fresh.map((d) => d.id)));
    void ensureUrlsFor(fresh);
    // Nama pengunggah (best-effort: RLS profiles membatasi koordinator pada
    // barisnya sendiri; admin melihat semua).
    const { data: profs } = await supabase.from('profiles').select('id, name');
    if (profs) {
      const map: Record<string, string> = {};
      (profs as { id: string; name: string }[]).forEach((p) => { map[p.id] = p.name; });
      setUploaderNames(map);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadDocs();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear]);

  // Signed URL per foto (bucket PRIVATE — render SELALU via URL ini, tidak
  // pernah public URL, expiry 3600s). Fetch LANGSUNG via ensureUrlsFor yang
  // dipanggil dari loadDocs tepat setelah setDocs — tanpa effect [docs]
  // (effect + attempted-gate adalah vektor lock-up: fetch tidak pernah
  // menyala). Kegagalan dicatat di signedErrors sehingga UI menampilkan
  // placeholder error + tombol "Coba lagi" (bukan spinner abadi).

  // Coba lagi membuat signed URL untuk satu foto yang gagal (dipakai tombol
  // "Coba lagi" pada placeholder error). Single-flight: abaikan bila request
  // untuk foto yang sama masih berjalan.
  const retrySignedUrl = async (docId: string) => {
    const target = docs.find((d) => d.id === docId);
    if (!target || signedInflightRef.current.has(docId)) return;
    setSignedErrors((prev) => {
      if (!prev[docId]) return prev;
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setImgBroken((prev) => {
      if (!prev[docId]) return prev;
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    await ensureUrlsFor([target]);
  };

  const markImgBroken = (docId: string) => {
    setImgBroken((prev) => (prev[docId] ? prev : { ...prev, [docId]: true }));
  };

  const resolvedDocs = useMemo<ResolvedDoc[]>(() => {
    return docs.map((d) => {
      const school = schools.find((sch) => sch.id === d.schoolId);
      return {
        ...d,
        schoolName: school ? school.name : 'Unknown School',
      };
    });
  }, [docs, schools]);

  // Nama pengunggah + resolusi preview mengikuti filteredDocs di bawah.

  // Prioritas: snapshot created_by_name (0012, terbaca semua role tanpa
  // join profiles) -> map uploaderNames (admin lengkap, koordinator parsial
  // akibat RLS) -> currentUser sendiri -> 'Pengguna' (baris lama tanpa nama).
  const uploaderLabel = (doc: Pick<TTDDocumentation, 'createdBy' | 'createdByName'>): string => {
    const snapshot = (doc.createdByName ?? '').trim();
    if (snapshot) return snapshot;
    if (doc.createdBy && uploaderNames[doc.createdBy]) return uploaderNames[doc.createdBy];
    if (currentUser && doc.createdBy === currentUser.id) return currentUser.name;
    return 'Pengguna';
  };

  const previewDoc = previewDocId ? resolvedDocs.find((d) => d.id === previewDocId) : undefined;
  const deleteDocTarget = deleteDocTargetId ? resolvedDocs.find((d) => d.id === deleteDocTargetId) : undefined;

  const resetDocForm = () => {
    setDocFile(null);
    setDocCompressed(null);
    if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    setDocPreviewUrl(null);
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  // COMPRESS-FIRST: file dipilih -> validasi gambar -> kompresi WebP ->
  // info "3,1 MB → 184 KB". File mentah TIDAK PERNAH diunggah.
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPEG/PNG/WebP).');
      e.target.value = '';
      return;
    }
    setDocFile(file);
    setDocCompressed(null);
    if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    setDocPreviewUrl(URL.createObjectURL(file));
    setIsCompressing(true);
    try {
      const result = await compressToWebP(file, { maxDim: 1280, maxBytes: 256000 });
      setDocCompressed(result);
    } catch (err) {
      setDocCompressed(null);
      toast.error(err instanceof Error ? err.message : 'Gagal mengompresi gambar. Coba foto lain.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleUploadDoc = async () => {
    if (isUploadingDoc || isCompressing) return;
    // Sekolah foto diambil dari Select in-modal (independen dari filter tabel):
    // koordinator terkunci ke sekolahnya sendiri, admin wajib memilih di modal.
    const effectiveDocSchoolId = docSchoolId || undefined;
    if (!effectiveDocSchoolId) {
      toast.error('Pilih sekolah terlebih dahulu untuk mengunggah foto.');
      return;
    }
    if (!docCompressed) {
      toast.error('Foto belum siap. Pilih file gambar dan tunggu kompresi selesai.');
      return;
    }
    // taken_at otomatis = sekarang (tidak bisa diubah user).
    const path = `${effectiveDocSchoolId}/${Date.now()}.webp`;
    setIsUploadingDoc(true);
    try {
      const { error: upErr } = await supabase.storage
        .from('ttd-docs')
        .upload(path, docCompressed.blob, { contentType: 'image/webp', upsert: false });
      if (upErr) {
        toast.error('Gagal mengunggah foto. Periksa koneksi dan coba lagi.');
        return;
      }
      // Snapshot nama pengunggah (0012 `created_by_name`): koordinator bisa
      // baca nama tanpa join profiles (RLS). Graceful degrade bila migrasi
      // 0012 belum jalan: error kolom-hilang (42703) -> retry insert legacy
      // TANPA kolom baru (mirror pola 42P01 di loadDocs). Pilihan retry
      // alih-alih pre-check agar tetap 1 round-trip pada jalur normal.
      const uploaderName = currentUser?.name?.trim() ? currentUser.name : null;
      let insErr: { code?: string; message?: string } | null = null;
      {
        const { error } = await supabase.from('ttd_documentations').insert({
          student_id: null,
          school_id: effectiveDocSchoolId,
          academic_year: academicYear,
          photo_path: path,
          taken_at: new Date().toISOString(),
          created_by: currentUser?.id ?? null,
          created_by_name: uploaderName,
        });
        insErr = error;
        const msg = (error?.message ?? '').toLowerCase();
        if (error && (error.code === '42703' || error.code === '42P01' || msg.includes('created_by_name'))) {
          const { error: legacyErr } = await supabase.from('ttd_documentations').insert({
            student_id: null,
            school_id: effectiveDocSchoolId,
            academic_year: academicYear,
            photo_path: path,
            taken_at: new Date().toISOString(),
            created_by: currentUser?.id ?? null,
          });
          insErr = legacyErr;
        }
      }
      if (insErr) {
        await supabase.storage.from('ttd-docs').remove([path]);
        toast.error(
          insErr.code === '42P01'
            ? 'Tabel dokumentasi belum tersedia. Jalankan migrasi 0008_ttd_documentations.sql terlebih dahulu.'
            : 'Gagal menyimpan data foto.',
        );
        return;
      }
      toast.success('Dokumentasi foto berhasil diunggah.');
      setIsDocOpen(false);
      resetDocForm();
      await loadDocs();
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocTargetId || isDeletingDoc) return;
    const target = docs.find((d) => d.id === deleteDocTargetId);
    setIsDeletingDoc(true);
    try {
      if (target) {
        const { error: rmErr } = await supabase.storage.from('ttd-docs').remove([target.photoPath]);
        if (rmErr) {
          toast.error('Gagal menghapus file foto.');
          return;
        }
      }
      const { error: delErr } = await supabase.from('ttd_documentations').delete().eq('id', deleteDocTargetId);
      if (delErr) {
        toast.error('Gagal menghapus dokumentasi.');
        return;
      }
      toast.success('Dokumentasi foto dihapus.');
      setDeleteDocTargetId(null);
      setPreviewDocId((prev) => (prev === deleteDocTargetId ? null : prev));
      await loadDocs();
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const isKoordinator = currentUser?.role === 'koordinator';
  const scopedSchoolId = isKoordinator ? currentUser?.schoolId : undefined;

  // Form state
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
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

  const eligibleStudents = useMemo(() =>
    students.filter(s => s.gender === 'P' && (!scopedSchoolId || s.schoolId === scopedSchoolId)),
    [students, scopedSchoolId]
  );

  const filterSchool = useMemo(
    () => (schoolFilter === 'all' ? undefined : schools.find((s) => s.id === schoolFilter)),
    [schoolFilter, schools]
  );

  // Record dalam scope TA + bulan + sekolah aktif (tanpa search/status) —
  // basis agregasi per-siswi sekaligus sumber ekspor per-record.
  const monthRecords = useMemo(() => {
    return resolvedRecords.filter((record) =>
      (!record.academicYear || record.academicYear === academicYear) &&
      (!filterSchool || record.schoolName === filterSchool.name) &&
      (monthFilter === 'all' || String(new Date(record.date).getMonth() + 1) === monthFilter)
    );
  }, [resolvedRecords, academicYear, filterSchool, monthFilter]);

  // monthFilter 'all' = "Semua Bulan": agregat SELURUH WAKTU (semua record
  // TA aktif), kolom slot mingguan DISEMBUNYIKAN. Slot UI + input tanggal
  // slot hanya muncul saat bulan spesifik dipilih.
  const isAllMonths = monthFilter === 'all';

  // Bulan slot: filter bulan aktif, atau (month=all) bulan kalender berjalan.
  // Dipilih bulan berjalan agar grid 4 Pekan selalu punya konteks tanggal
  // yang jelas; % + badge saat month=all juga dihitung per bulan berjalan.
  const slotMonth = useMemo(() => {
    if (monthFilter !== 'all') return Number(monthFilter);
    return new Date().getMonth() + 1;
  }, [monthFilter]);
  const slotYear = useMemo(() => {
    if (monthFilter !== 'all') return academicYearMonthToYear(academicYear, Number(monthFilter));
    return new Date().getFullYear();
  }, [academicYear, monthFilter]);

  const slotDefaults = useMemo(
    () => fridayDefaultsForMonth(slotYear, slotMonth),
    [slotYear, slotMonth],
  );
  const [customSlotDates, setCustomSlotDates] = useState<(string | null)[]>([null, null, null, null]);
  const slotDates = slotDefaults.map((d, i) => customSlotDates[i] ?? d);
  const [slotSavingKey, setSlotSavingKey] = useState<string | null>(null);

  // Batas tanggal slot = hari pertama/terakhir bulan slot aktif.
  // Slot header memakai SlotDatePicker (kalender Indonesia) yang dikunci
  // ke rentang [slotMin, slotMax].
  const slotMonthDays = new Date(slotYear, slotMonth, 0).getDate();
  const slotMin = toISODate(slotYear, slotMonth, 1);
  const slotMax = toISODate(slotYear, slotMonth, slotMonthDays);

  // Scope persist kustomisasi = sekolah tunggal konteks aktif: koordinator
  // terkunci ke sekolahnya (scopedSchoolId), admin mengikuti filter sekolah
  // di tabel. Admin + "Semua Sekolah" (null) = tanpa scope tunggal → mode
  // lokal-saja (tidak fetch/tulis DB) agar kustom tidak bocor antar sekolah.
  const slotScopeSchoolId = scopedSchoolId ?? filterSchool?.id ?? null;

  // PERSIST kustomisasi tanggal slot (0010): fetch customs untuk scope
  // (sekolah, TA, bulan) → customSlotDates; tanpa baris = null = fallback ke
  // default Jumat segar. 42P01 (tabel 0010 belum dijalankan) → defaults diam,
  // tanpa toast merah (mirror guard ttd_documentations). Nulls dulu agar
  // customs bulan/sekolah lama tidak sempat tampil (isolasi month switch).
  useEffect(() => {
    setCustomSlotDates([null, null, null, null]);
    if (!slotScopeSchoolId) return;
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from('ttd_slot_dates')
        .select('school_id, academic_year, month, week_index, slot_date')
        .eq('school_id', slotScopeSchoolId)
        .eq('academic_year', academicYear)
        .eq('month', slotMonth);
      if (cancelled) return;
      if (error || !data) return; // 42P01/RLS/jaringan → defaults diam
      const next: (string | null)[] = [null, null, null, null];
      (data as TTDSlotDateRow[]).forEach((row) => {
        const m = ttdSlotDateRowToModel(row);
        if (m.weekIndex < 1 || m.weekIndex > 4) return;
        // Pengaman bila aturan bulan berubah: di luar [slotMin, slotMax]
        // → null = Jumat default.
        next[m.weekIndex - 1] = m.slotDate < slotMin || m.slotDate > slotMax ? null : m.slotDate;
      });
      setCustomSlotDates(next);
    };
    void run();
    return () => { cancelled = true; };
  }, [slotScopeSchoolId, academicYear, slotMonth, slotMin, slotMax]);

  // Picker onChange → optimistic state + upsert baris (satu baris per slot
  // via UNIQUE). Tanpa scope tunggal (admin + Semua Sekolah) atau tabel 0010
  // belum ada (42P01) → lokal-saja untuk sesi ini, tanpa toast merah.
  const handleSlotDateChange = async (weekIndex: number, iso: string) => {
    if (!slotScopeSchoolId) {
      toast.error('Pilih sekolah terlebih dahulu untuk mengatur tanggal.');
      return;
    }
    const clamped = !iso ? iso : iso < slotMin ? slotMin : iso > slotMax ? slotMax : iso;
    const prev = customSlotDates[weekIndex - 1] ?? null;
    const nextVal = clamped || null;
    setCustomSlotDates((prevArr) => {
      const next = [...prevArr];
      next[weekIndex - 1] = nextVal;
      return next;
    });
    if (!slotScopeSchoolId) return;
    if (!nextVal) {
      // Picker tidak punya jalur clear, tapi samakan dengan reset (DELETE)
      // agar baris lama tak menggantung bila iso kosong tiba di sini.
      await supabase
        .from('ttd_slot_dates')
        .delete()
        .eq('school_id', slotScopeSchoolId)
        .eq('academic_year', academicYear)
        .eq('month', slotMonth)
        .eq('week_index', weekIndex);
      return;
    }
    const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase.from('ttd_slot_dates').upsert(
      {
        school_id: slotScopeSchoolId,
        academic_year: academicYear,
        month: slotMonth,
        week_index: weekIndex,
        slot_date: nextVal,
        created_by: createdBy,
      },
      { onConflict: 'school_id,academic_year,month,week_index' },
    );
    if (error) {
      if (error.code === '42P01') return; // tabel belum ada → lokal-saja
      setCustomSlotDates((prevArr) => {
        const next = [...prevArr];
        next[weekIndex - 1] = prev;
        return next;
      });
      toast.error('Gagal menyimpan tanggal slot. Periksa koneksi dan coba lagi.');
    }
  };

  // Reset per-slot (UX terpilih — tanpa "Reset semua" agar kustom pekan lain
  // tidak ikut hilang; satu tombol kecil per slot yang dikustom): DELETE
  // baris → null = Jumat default kembali. Tanpa scope tunggal / tabel belum
  // ada → lokal-saja.
  const handleSlotDateReset = async (weekIndex: number) => {
    if (!slotScopeSchoolId) {
      toast.error('Pilih sekolah terlebih dahulu untuk mengatur tanggal.');
      return;
    }
    const prev = customSlotDates[weekIndex - 1] ?? null;
    setCustomSlotDates((prevArr) => {
      const next = [...prevArr];
      next[weekIndex - 1] = null;
      return next;
    });
    if (!slotScopeSchoolId) return;
    const { error } = await supabase
      .from('ttd_slot_dates')
      .delete()
      .eq('school_id', slotScopeSchoolId)
      .eq('academic_year', academicYear)
      .eq('month', slotMonth)
      .eq('week_index', weekIndex);
    if (error) {
      if (error.code === '42P01') return;
      setCustomSlotDates((prevArr) => {
        const next = [...prevArr];
        next[weekIndex - 1] = prev;
        return next;
      });
      toast.error('Gagal mengembalikan tanggal slot. Coba lagi.');
    }
  };

  // Satu baris per siswi (remaja putri dalam scope): siswi tanpa record
  // tetap tampil sebagai 'Belum dinilai'. Slot 1-4 dipetakan dari record
  // bulan slot via weekIndexFromISODate (blok 1-7/8-14/15-21/22+); bila
  // >1 record jatuh di pekan sama, yang terbaru (tanggal terbesar) menang.
  // % = hijau / (hijau + merah) * 100 (slot kosong dikecualikan).
  const studentRows = useMemo<StudentComplianceSummary[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    const slotPrefix = `${slotYear}-${String(slotMonth).padStart(2, '0')}`;
    return eligibleStudents
      .filter((s) => {
        if (filterSchool && s.schoolId !== filterSchool.id) return false;
        if (q === '') return true;
        const schoolName = schools.find((sch) => sch.id === s.schoolId)?.name ?? '';
        return s.name.toLowerCase().includes(q) || schoolName.toLowerCase().includes(q);
      })
      .map((student): StudentComplianceSummary => {
        const schoolName = schools.find((sch) => sch.id === student.schoolId)?.name ?? 'Unknown School';
        // Mode "Semua Bulan": agregat seluruh waktu — % dihitung dari semua
        // record TA aktif (patuh / total terisi * 100, rumus sama), tanpa
        // filter bulan/slot. slots dikosongkan (kolom slot disembunyikan).
        if (isAllMonths) {
          const recs = resolvedRecords
            .filter((r) => r.studentId === student.id)
            .filter((r) => !r.academicYear || r.academicYear === academicYear)
            .sort((a, b) => a.date.localeCompare(b.date));
          const green = recs.filter((r) => r.isCompliant).length;
          const red = recs.filter((r) => !r.isCompliant).length;
          const filled = green + red;
          const pct = filled > 0 ? Math.round((green / filled) * 100) : null;
          const status: StudentComplianceStatus = pct === null ? 'nodata' : pct >= 100 ? 'patuh' : 'kurang';
          const totalReceived = recs.reduce((sum, r) => sum + r.tabletsReceived, 0);
          const totalConsumed = recs.reduce((sum, r) => sum + r.tabletsConsumed, 0);
          return { student, schoolName, records: recs, slots: [], totalReceived, totalConsumed, pct, status };
        }
        const recs = resolvedRecords
          .filter((r) => r.studentId === student.id)
          .filter((r) => !r.academicYear || r.academicYear === academicYear)
          .filter((r) => r.date.slice(0, 7) === slotPrefix)
          .sort((a, b) => a.date.localeCompare(b.date));
        const slots: (ComplianceRecord | null)[] = [null, null, null, null];
        recs.forEach((r) => {
          const w = weekIndexFromISODate(r.date.slice(0, 10));
          if (w === null) return;
          slots[w - 1] = r;
        });
        const green = slots.filter((s) => s && s.isCompliant).length;
        const red = slots.filter((s) => s && !s.isCompliant).length;
        const filled = green + red;
        const pct = filled > 0 ? Math.round((green / filled) * 100) : null;
        const status: StudentComplianceStatus = pct === null ? 'nodata' : pct >= 100 ? 'patuh' : 'kurang';
        const totalReceived = slots.reduce((sum, s) => sum + (s ? s.tabletsReceived : 0), 0);
        const totalConsumed = slots.reduce((sum, s) => sum + (s ? s.tabletsConsumed : 0), 0);
        return { student, schoolName, records: recs, slots, totalReceived, totalConsumed, pct, status };
      })
      .filter((row) => complianceFilter === 'all' || row.status === complianceFilter);
  }, [eligibleStudents, filterSchool, searchTerm, schools, resolvedRecords, academicYear, slotMonth, slotYear, complianceFilter, isAllMonths]);

  const groupedStudentRows = useMemo(() => {
    const groups: Record<string, StudentComplianceSummary[]> = {};
    studentRows.forEach(row => {
      if (!groups[row.schoolName]) {
        groups[row.schoolName] = [];
      }
      groups[row.schoolName].push(row);
    });
    return groups;
  }, [studentRows]);

  // Ekspor tetap per-record dalam scope filter aktif; filter status
  // dipetakan ke level record (patuh -> isCompliant, kurang -> sebaliknya).
  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return monthRecords.filter((record) =>
      (q === '' ||
        record.studentName.toLowerCase().includes(q) ||
        record.schoolName.toLowerCase().includes(q)) &&
      (complianceFilter === 'all' ||
        (complianceFilter === 'nodata'
          ? false
          : complianceFilter === 'patuh'
            ? record.isCompliant
            : !record.isCompliant))
    );
  }, [monthRecords, searchTerm, complianceFilter]);

  // Scope galeri dokumentasi (SCHOOL-LEVEL) = filter sekolah aktif (RLS
  // server + client untuk koordinator) + TA + search nama sekolah. Ditaruh
  // di sini karena memakai scopedSchoolId/filterSchool T10 di atas.
  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return resolvedDocs
      .filter((d) => !d.academicYear || d.academicYear === academicYear)
      .filter((d) => {
        if (scopedSchoolId && d.schoolId !== scopedSchoolId) return false;
        if (filterSchool && d.schoolId !== filterSchool.id) return false;
        return true;
      })
      .filter((d) => q === '' || d.schoolName.toLowerCase().includes(q));
  }, [resolvedDocs, academicYear, scopedSchoolId, filterSchool, searchTerm]);

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const s = students.find(st => st.id === id);
    if (s) setSchoolId(s.schoolId);
  };

  const resetForm = () => {
    setEditingId(null);
    setStudentId('');
    setSchoolId('');
    setDate(new Date().toISOString().split('T')[0]);
    setTabletsReceived('4');
    setTabletsConsumed('4');
    setNotes('');
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

  // Klik sel 3-state: kosong -> Diminum (1/1 hijau) -> Tidak diminum (1/0
  // merah) -> kosong (DELETE). Identitas slot = (student, bulan, week_index)
  // via blok hari 1-7/8-14/15-21/22+; tanggal slot HANYA dipakai untuk INSERT
  // baru — record lama keep stored date (toggle hijau->merah tidak
  // menggeser tanggal) agar riwayat tidak ikut berubah.
  const handleSlotClick = async (row: StudentComplianceSummary, weekIndex: number) => {
    const slotDate = slotDates[weekIndex - 1];
    if (!slotDate || slotSavingKey) return;
    const key = `${row.student.id}-w${weekIndex}`;
    const existing = row.slots[weekIndex - 1] ?? null;
    const next: 'green' | 'red' | 'empty' = !existing ? 'green' : existing.isCompliant ? 'red' : 'empty';
    setSlotSavingKey(key);
    try {
      if (next === 'empty' && existing) {
        const { error } = await supabase.from('ttd_compliance').delete().eq('id', existing.id);
        if (error) {
          toast.error('Gagal menghapus catatan kepatuhan. Coba lagi.');
          return;
        }
        setRecords((prev) => prev.filter((r) => r.id !== existing.id));
        return;
      }
      const consumed = next === 'green' ? 1 : 0;
      if (existing) {
        const { data, error } = await supabase
          .from('ttd_compliance')
          .update({
            tablets_received: 1,
            tablets_consumed: consumed,
            is_compliant: consumed >= 1,
          })
          .eq('id', existing.id)
          .select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by')
          .single();
        if (error || !data) {
          toast.error('Gagal menyimpan catatan kepatuhan. Periksa koneksi dan coba lagi.');
          return;
        }
        const updated = ttdRowToModel(data as TTDComplianceRow);
        setRecords((prev) => prev.map((r) => (r.id === existing.id ? updated : r)));
      } else {
        const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
        const { data, error } = await supabase
          .from('ttd_compliance')
          .insert(ttdToInsert({
            studentId: row.student.id,
            schoolId: row.student.schoolId,
            academicYear,
            date: slotDate,
            tabletsReceived: 1,
            tabletsConsumed: consumed,
            isCompliant: consumed >= 1,
            notes: '',
            createdBy,
          }))
          .select('id, student_id, school_id, academic_year, date, tablets_received, tablets_consumed, is_compliant, notes, created_by')
          .single();
        if (error || !data) {
          toast.error('Gagal menyimpan catatan kepatuhan. Periksa koneksi dan coba lagi.');
          return;
        }
        const created = ttdRowToModel(data as TTDComplianceRow);
        setRecords((prev) => [created, ...prev]);
      }
    } finally {
      setSlotSavingKey(null);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Kepatuhan TTD</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              Remaja Putri
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Pencatatan konsumsi Tablet Tambah Darah mingguan.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all">
                <Upload className="w-4 h-4" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl">
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

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg sm:max-w-lg rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">{editingId ? 'Edit Konsumsi TTD' : 'Catat Konsumsi TTD'}</DialogTitle>
                <DialogDescription className="font-medium">Masukkan data konsumsi tablet tambah darah siswa.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Siswa (Remaja Putri)</Label>
                  <StudentCombobox students={eligibleStudents} value={studentId} onChange={handleStudentChange} />
                </div>

                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Tanggal Pemberian</Label>
                  <SlotDatePicker value={date} onChange={(v) => setDate(v)} className="w-full justify-between rounded-xl border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <SelectValue placeholder="Semua Sekolah">{schoolFilter === 'all' ? 'Semua Sekolah' : (schools.find((s) => s.id === schoolFilter)?.name ?? 'Sekolah tidak tersedia')}</SelectValue>
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
            <SelectValue placeholder="Semua Bulan">{monthFilter === 'all' ? 'Semua Bulan' : (['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(monthFilter) - 1] ?? 'Bulan tidak tersedia')}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Bulan</SelectItem>
            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((label, i) => (
              <SelectItem key={String(i + 1)} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={complianceFilter} onValueChange={(v) => setComplianceFilter(v as 'all' | 'patuh' | 'kurang' | 'nodata')}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
            <SelectValue placeholder="Semua Status">{complianceFilter === 'all' ? 'Semua Status' : (complianceFilter === 'patuh' ? 'Patuh' : complianceFilter === 'kurang' ? 'Kurang' : 'Belum dinilai')}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="patuh">Patuh</SelectItem>
            <SelectItem value="kurang">Kurang</SelectItem>
            <SelectItem value="nodata">Belum dinilai</SelectItem>
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
        <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Siswi</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Kelas</TableHead>
              {!isAllMonths && [1, 2, 3, 4].map((w) => (
                <TableHead key={w} className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-2 text-center min-w-28">
                  <span className="block">Pekan {w}</span>
                  <div className="flex items-center justify-center gap-1">
                    <SlotDatePicker
                      value={slotDates[w - 1] ?? ''}
                      min={slotMin}
                      max={slotMax}
                      onChange={(v) => void handleSlotDateChange(w, v)}
                      disabled={!slotScopeSchoolId}
                      title={!slotScopeSchoolId ? 'Pilih sekolah terlebih dahulu untuk mengatur tanggal.' : undefined}
                    />
                    {customSlotDates[w - 1] != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!slotScopeSchoolId}
                        title={!slotScopeSchoolId ? 'Pilih sekolah terlebih dahulu untuk mengatur tanggal.' : 'Kembalikan ke Jumat default'}
                        onClick={(e) => { e.stopPropagation(); void handleSlotDateReset(w); }}
                        className="mt-1 h-7 w-7 shrink-0 rounded-md text-slate-400 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4 text-center">% Patuh</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(groupedStudentRows).length > 0 ? (
              (Object.entries(groupedStudentRows) as [string, StudentComplianceSummary[]][]).map(([schoolName, schoolRows]) => (
                <React.Fragment key={schoolName}>
                  <TableRow className="bg-slate-100/50 hover:bg-slate-100/50">
                    <TableCell colSpan={isAllMonths ? 4 : 8} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <SchoolIcon className="w-4 h-4 text-primary" />
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{schoolName}</span>
                        <Badge variant="outline" className="ml-2 rounded-full bg-white text-[10px] font-bold">
                          {schoolRows.length} Siswi
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                  {schoolRows.map((row) => (
                    <TableRow
                      key={row.student.id}
                      className="border-slate-100 hover:bg-primary/5 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="font-bold text-slate-700">{row.student.name}</div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase">NIK {row.student.nik || '-'}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="rounded-lg font-bold">{row.student.class}</Badge>
                      </TableCell>
                      {!isAllMonths && [1, 2, 3, 4].map((w) => {
                        const rec = row.slots[w - 1];
                        const saving = slotSavingKey === `${row.student.id}-w${w}`;
                        return (
                          <TableCell key={w} className="py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={saving}
                              title={!rec ? `Pekan ${w}: kosong — klik untuk Diminum` : rec.isCompliant ? `Pekan ${w}: Diminum (${formatDateId(rec.date)}) — klik untuk Tidak diminum` : `Pekan ${w}: Tidak diminum (${formatDateId(rec.date)}) — klik untuk kosongkan`}
                              onClick={() => { void handleSlotClick(row, w); }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 text-base font-extrabold transition-all disabled:opacity-50 ${!rec ? 'border-slate-300 bg-white text-transparent hover:border-primary/50' : rec.isCompliant ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600' : 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600'}`}
                            >
                              {!rec ? '·' : rec.isCompliant ? '✓' : '✕'}
                            </button>
                          </TableCell>
                        );
                      })}
                      <TableCell className="py-4 text-center">
                        <span className="font-extrabold text-slate-700 font-mono">{row.pct === null ? '—' : `${row.pct}%`}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        {row.status === 'patuh' ? (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 gap-1 rounded-lg px-2 py-1">
                            <CheckCircle2 className="w-3 h-3" /> Patuh
                          </Badge>
                        ) : row.status === 'kurang' ? (
                          <Badge className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 gap-1 rounded-lg px-2 py-1">
                            <XCircle className="w-3 h-3" /> Kurang
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1 rounded-lg px-2 py-1">
                            Belum dinilai
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAllMonths ? 4 : 8} className="h-32 text-center text-muted-foreground">
                  {isAllMonths ? 'Tidak ada data ditemukan pada seluruh bulan.' : 'Tidak ada data ditemukan pada bulan ini. Pilih "Semua Bulan" untuk melihat agregat seluruh waktu.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
      )}
      {/* Dokumentasi foto TTD — opsional, non-harian, tanpa kaitan validasi kepatuhan */}
      <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-800">Dokumentasi Foto</h3>
                {filteredDocs.length > 0 && (
                  <Badge variant="outline" className="rounded-full bg-white text-[10px] font-bold">
                    {filteredDocs.length} Foto
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Dialog open={isDocOpen} onOpenChange={(open) => { setIsDocOpen(open); if (open) { setDocSchoolId(scopedSchoolId ?? (schoolFilter !== 'all' ? schoolFilter : '')); } else { resetDocForm(); setDocSchoolId(''); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 px-5 rounded-xl font-bold shadow-lg shadow-primary/20">
                <Upload className="w-4 h-4" /> Unggah Foto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl max-w-lg sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Unggah Dokumentasi Foto</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Sekolah</Label>
                  {isKoordinator ? (
                    <Select value={docSchoolId} disabled>
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
                        <SelectValue placeholder="Sekolah Anda">{schools.find((s) => s.id === docSchoolId)?.name ?? (schools.find((s) => s.id === scopedSchoolId)?.name ?? 'Sekolah Anda')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {scopedSchoolId && (
                          <SelectItem value={scopedSchoolId}>{schools.find((s) => s.id === scopedSchoolId)?.name ?? 'Sekolah Anda'}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={docSchoolId} onValueChange={setDocSchoolId}>
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
                        <SelectValue placeholder="Pilih sekolah">{docSchoolId ? (schools.find((s) => s.id === docSchoolId)?.name ?? 'Sekolah tidak tersedia') : undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {schools.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Foto</Label>
                  <input
                    type="file"
                    ref={docFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => { void handleDocFileChange(e); }}
                  />
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                    onClick={() => docFileInputRef.current?.click()}
                  >
                    {docPreviewUrl ? (
                      <img src={docPreviewUrl} alt="Pratinjau foto" className="max-h-56 rounded-xl object-contain" />
                    ) : (
                      <>
                        <div className="p-4 bg-primary/10 rounded-full">
                          <Camera className="w-8 h-8 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-700">Klik untuk pilih foto</p>
                          <p className="text-xs text-slate-500">Format gambar (JPEG/PNG/WebP)</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {docFile && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                    {isCompressing
                      ? 'Mengompresi foto…'
                      : docCompressed
                        ? `Ukuran: ${formatSizeId(docCompressed.beforeKB * 1024)} → ${formatSizeId(docCompressed.afterKB * 1024)} (WebP)`
                        : 'Kompresi gagal — pilih foto lain.'}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => { void handleUploadDoc(); }}
                  disabled={isUploadingDoc || isCompressing || !docCompressed}
                  className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg"
                >
                  {isUploadingDoc ? 'Mengunggah…' : 'Unggah Foto'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="p-5">
          {docsError === 'missing' ? (
            <p className="text-center text-sm font-medium text-slate-500 py-8">
              Fitur dokumentasi belum aktif — jalankan migrasi <span className="font-mono font-bold">0008_ttd_documentations.sql</span> di SQL Editor terlebih dahulu.
            </p>
          ) : docsError === 'load' ? (
            <div className="text-center py-8">
              <p className="text-sm font-medium text-slate-500 mb-3">Gagal memuat dokumentasi foto.</p>
              <Button variant="outline" onClick={() => { void loadDocs(); }}>Coba lagi</Button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <p className="text-center text-sm font-medium text-slate-500 py-8">Belum ada foto dokumentasi pada filter ini.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDocs.map((d) => (
                <div key={d.id} className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                  <button type="button" onClick={() => setPreviewDocId(d.id)} className="block w-full text-left">
                    {signedUrls[d.id] && !imgBroken[d.id] ? (
                      <img src={signedUrls[d.id]} alt={`Dokumentasi ${d.schoolName}`} className="aspect-video w-full object-cover" loading="lazy" onError={() => markImgBroken(d.id)} />
                    ) : (signedErrors[d.id] || imgBroken[d.id]) ? (
                      <div className="aspect-video w-full bg-slate-100 flex flex-col items-center justify-center gap-1 px-3 text-center">
                        <XCircle className="w-6 h-6 text-slate-400" />
                        <p className="text-xs font-bold text-slate-500">Foto gagal dimuat</p>
                        <span
                          role="button"
                          tabIndex={0}
                          className="text-xs font-bold text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); void retrySignedUrl(d.id); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void retrySignedUrl(d.id); } }}
                        >
                          Coba lagi
                        </span>
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-slate-100 animate-pulse flex items-center justify-center">
                        <Camera className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </button>
                  <div className="p-3">
                    <p className="text-sm font-bold text-slate-700 truncate">{d.schoolName}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-1">{formatTakenAtId(d.takenAt)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] font-medium text-slate-400 truncate">oleh {uploaderLabel(d)}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Hapus foto"
                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => setDeleteDocTargetId(d.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog open={previewDocId !== null} onOpenChange={(open) => { if (!open) setPreviewDocId(null); }}>
        <DialogContent className="max-w-3xl sm:max-w-3xl rounded-3xl border-none shadow-2xl max-h-[90vh] overflow-y-auto">
          {previewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">{previewDoc.schoolName}</DialogTitle>
                <DialogDescription className="font-medium">
                  {formatTakenAtId(previewDoc.takenAt)} • oleh {uploaderLabel(previewDoc)}
                </DialogDescription>
              </DialogHeader>
              {signedUrls[previewDoc.id] && !imgBroken[previewDoc.id] ? (
                <img
                  src={signedUrls[previewDoc.id]}
                  alt={`Dokumentasi ${previewDoc.schoolName}`}
                  className="max-h-[70vh] w-full object-contain rounded-2xl bg-slate-100"
                  onError={() => markImgBroken(previewDoc.id)}
                />
              ) : (signedErrors[previewDoc.id] || imgBroken[previewDoc.id]) ? (
                <div className="min-h-64 rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <XCircle className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-bold text-slate-500">Foto gagal dimuat.</p>
                  <Button variant="outline" className="rounded-xl" onClick={() => { void retrySignedUrl(previewDoc.id); }}>
                    Coba lagi
                  </Button>
                </div>
              ) : (
                <div className="h-64 rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center">
                  <p className="text-sm font-medium text-slate-400">Memuat foto…</p>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteDocTargetId(previewDoc.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Hapus
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setPreviewDocId(null)}>
                  <X className="w-4 h-4 mr-2" /> Tutup
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteDocTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteDocTargetId(null); }}
        itemName={deleteDocTarget ? `foto dokumentasi ${deleteDocTarget.schoolName}` : undefined}
        description={deleteDocTarget ? `Foto dokumentasi "${deleteDocTarget.schoolName}" (${formatTakenAtId(deleteDocTarget.takenAt)}) akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { void handleDeleteDoc(); }}
        isDeleting={isDeletingDoc}
      />
    </div>
  );
}
