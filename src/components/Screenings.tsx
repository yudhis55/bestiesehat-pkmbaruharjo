import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Activity, Eye, Heart, Brain, Baby, ShieldAlert, FileText, Upload, Download, FileSpreadsheet, ExternalLink, CheckCircle2, Clock, XCircle, Trash2, Edit, ChevronsUpDown, Check } from 'lucide-react';
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
import { Screening, Student, School, User } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { calculateAgeDetails, calculateAgeYears } from '@/lib/ageUtils';
import { classifyBP } from '@/lib/bp-classify';

interface ScreeningsProps {
  academicYear: string;
  currentUser?: User;
}

interface ScreeningRow {
  id: string;
  student_id: string;
  school_id: string;
  academic_year: string;
  date: string;
  entry_date: string | null;
  student_class: string | null;
  student_gender: 'L' | 'P' | null;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  physical_activity: string | null;
  vision_left: string | null;
  vision_right: string | null;
  hearing_left: string | null;
  hearing_right: string | null;
  dental_caries: string | null;
  dental_mouth_health: string | null;
  caries_count: number | null;
  blood_pressure: string | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  bp_category: string | null;
  blood_sugar: string | null;
  tbc_screening: string | null;
  hepatitis_b: string | null;
  hepatitis_c: string | null;
  mental_health_status: string | null;
  reproductive_health: string | null;
  menstruasi: 'Sudah' | 'Belum' | null;
  smoking_status: string | null;
  immunization_history: string | null;
  anemia_status: string | null;
  hb_level: number | null;
  hb_interpretation: string | null;
  notes: string | null;
  created_by: string | null;
  needs_referral: boolean;
  referral_destination: string | null;
  referral_reason: string | null;
  referral_status: 'pending' | 'completed' | 'cancelled' | null;
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

const SCREENING_SELECT =
  'id, student_id, school_id, academic_year, date, entry_date, student_class, student_gender, height, weight, bmi, physical_activity, vision_left, vision_right, hearing_left, hearing_right, dental_caries, dental_mouth_health, caries_count, blood_pressure, systolic_bp, diastolic_bp, bp_category, blood_sugar, tbc_screening, hepatitis_b, hepatitis_c, mental_health_status, reproductive_health, menstruasi, smoking_status, immunization_history, anemia_status, hb_level, hb_interpretation, notes, created_by, needs_referral, referral_destination, referral_reason, referral_status';

// Kolom pra-migrasi 0007 (tanpa 5 kolom baru: caries_count, systolic_bp,
// diastolic_bp, bp_category, menstruasi). Dipakai untuk retry bila DB belum dimigrasi.
const LEGACY_SCREENING_SELECT =
  'id, student_id, school_id, academic_year, date, entry_date, student_class, student_gender, height, weight, bmi, physical_activity, vision_left, vision_right, hearing_left, hearing_right, dental_caries, dental_mouth_health, blood_pressure, blood_sugar, tbc_screening, hepatitis_b, hepatitis_c, mental_health_status, reproductive_health, smoking_status, immunization_history, anemia_status, hb_level, hb_interpretation, notes, created_by, needs_referral, referral_destination, referral_reason, referral_status';

function isMissingColumnError(message: string): boolean {
  return message.includes('42703') || message.includes('42P01');
}

// Satu-satunya titik pemetaan snake_case (screenings/students/schools) <->
// camelCase (Screening/Student/School), mirror TTDCompliance.tsx.
function screeningRowToModel(row: ScreeningRow): Screening {
  return {
    id: row.id,
    studentId: row.student_id,
    schoolId: row.school_id,
    academicYear: row.academic_year,
    date: row.date,
    entryDate: row.entry_date ?? '',
    studentClass: row.student_class ?? undefined,
    studentGender: row.student_gender ?? undefined,
    height: row.height ?? 0,
    weight: row.weight ?? 0,
    bmi: row.bmi ?? 0,
    physicalActivity: row.physical_activity ?? undefined,
    visionLeft: row.vision_left ?? undefined,
    visionRight: row.vision_right ?? undefined,
    hearingLeft: row.hearing_left ?? undefined,
    hearingRight: row.hearing_right ?? undefined,
    dentalCaries: row.dental_caries ?? undefined,
    dentalMouthHealth: row.dental_mouth_health ?? undefined,
    cariesCount: row.caries_count ?? undefined,
    bloodPressure: row.blood_pressure ?? undefined,
    systolicBP: row.systolic_bp ?? undefined,
    diastolicBP: row.diastolic_bp ?? undefined,
    bpCategory: row.bp_category ?? undefined,
    bloodSugar: row.blood_sugar ?? undefined,
    tbcScreening: row.tbc_screening ?? undefined,
    hepatitisB: row.hepatitis_b ?? undefined,
    hepatitisC: row.hepatitis_c ?? undefined,
    mentalHealthStatus: row.mental_health_status ?? undefined,
    reproductiveHealth: row.reproductive_health ?? undefined,
    menstruasi: row.menstruasi ?? undefined,
    smokingStatus: row.smoking_status ?? undefined,
    immunizationHistory: row.immunization_history ?? undefined,
    anemiaStatus: row.anemia_status ?? undefined,
    hbLevel: row.hb_level ?? undefined,
    hbInterpretation: row.hb_interpretation ?? undefined,
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? '',
    needsReferral: row.needs_referral,
    referralDestination: row.referral_destination ?? undefined,
    referralReason: row.referral_reason ?? undefined,
    referralStatus: row.referral_status ?? undefined,
  };
}

function screeningToInsert(s: {
  studentId: string;
  schoolId: string;
  academicYear: string;
  date: string;
  entryDate: string;
  studentClass?: string;
  studentGender?: 'L' | 'P';
  height: number;
  weight: number;
  bmi: number;
  physicalActivity?: string;
  visionLeft?: string;
  visionRight?: string;
  hearingLeft?: string;
  hearingRight?: string;
  dentalCaries?: string;
  dentalMouthHealth?: string;
  cariesCount?: number;
  bloodPressure?: string;
  systolicBP?: number;
  diastolicBP?: number;
  bpCategory?: string;
  bloodSugar?: string;
  tbcScreening?: string;
  hepatitisB?: string;
  hepatitisC?: string;
  mentalHealthStatus?: string;
  reproductiveHealth?: string;
  menstruasi?: 'Sudah' | 'Belum';
  smokingStatus?: string;
  immunizationHistory?: string;
  anemiaStatus?: string;
  hbLevel?: number;
  hbInterpretation?: string;
  notes?: string;
  createdBy: string | null;
  needsReferral?: boolean;
  referralDestination?: string;
  referralReason?: string;
  referralStatus?: 'pending' | 'completed' | 'cancelled';
}) {
  return {
    student_id: s.studentId,
    school_id: s.schoolId,
    academic_year: s.academicYear,
    date: s.date.slice(0, 10),
    entry_date: s.entryDate.slice(0, 10),
    student_class: s.studentClass ?? null,
    student_gender: s.studentGender ?? null,
    height: s.height,
    weight: s.weight,
    bmi: s.bmi,
    physical_activity: s.physicalActivity ?? null,
    vision_left: s.visionLeft ?? null,
    vision_right: s.visionRight ?? null,
    hearing_left: s.hearingLeft ?? null,
    hearing_right: s.hearingRight ?? null,
    dental_caries: s.dentalCaries ?? null,
    dental_mouth_health: s.dentalMouthHealth ?? null,
    caries_count: s.cariesCount ?? null,
    blood_pressure: s.bloodPressure ?? null,
    systolic_bp: s.systolicBP ?? null,
    diastolic_bp: s.diastolicBP ?? null,
    bp_category: s.bpCategory ?? null,
    blood_sugar: s.bloodSugar ?? null,
    tbc_screening: s.tbcScreening ?? null,
    hepatitis_b: s.hepatitisB ?? null,
    hepatitis_c: s.hepatitisC ?? null,
    mental_health_status: s.mentalHealthStatus ?? null,
    reproductive_health: s.reproductiveHealth ?? null,
    menstruasi: s.menstruasi ?? null,
    smoking_status: s.smokingStatus ?? null,
    immunization_history: s.immunizationHistory ?? null,
    anemia_status: s.anemiaStatus ?? null,
    hb_level: s.hbLevel ?? null,
    hb_interpretation: s.hbInterpretation ?? null,
    notes: s.notes ?? null,
    created_by: s.createdBy,
    needs_referral: s.needsReferral ?? false,
    referral_destination: s.referralDestination ?? null,
    referral_reason: s.referralReason ?? null,
    referral_status: s.referralStatus ?? null,
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
// mengembalikan null agar baris dilewati (tidak pernah `|| 0` menjadi vital hantu).
function parseStrictNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined) return null;
  const raw = cell.toString().trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function studentRowToStudent(row: StudentRow): Student {
  return {
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
                  <span className="min-w-0 flex-1 break-words">
                    <span className="block text-sm font-bold text-slate-800 break-words">{s.name}</span>
                    <span className="block text-xs font-medium text-slate-500 break-words">Kelas {s.class} • NIK {s.nik || '-'}</span>
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

export function Screenings({ academicYear: currentAcademicYear, currentUser }: ScreeningsProps) {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedScreening, setSelectedScreening] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [screeningRes, studentRes, schoolRes] = await Promise.all([
      supabase.from('screenings').select(SCREENING_SELECT),
      supabase.from('students').select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number'),
      supabase.from('schools').select('id, name, address, coordinator_name, phone, type'),
    ]);
    // Retry legacy bila migrasi 0007 belum dijalankan (kolom/relasi hilang: 42703/42P01).
    if (screeningRes.error && isMissingColumnError(screeningRes.error.message ?? '')) {
      const retryRes = await supabase.from('screenings').select(LEGACY_SCREENING_SELECT);
      if (!retryRes.error && retryRes.data && !studentRes.error && !schoolRes.error && studentRes.data && schoolRes.data) {
        toast.error('Database belum diperbarui. Jalankan migrasi 0007 di Supabase SQL Editor.');
        setScreenings((retryRes.data as ScreeningRow[]).map(screeningRowToModel));
        setStudents((studentRes.data as StudentRow[]).map(studentRowToStudent));
        setSchools((schoolRes.data as SchoolRow[]).map(schoolRowToSchool));
        return;
      }
    }
    if (screeningRes.error || studentRes.error || schoolRes.error || !screeningRes.data || !studentRes.data || !schoolRes.data) {
      toast.error('Gagal memuat data pemeriksaan. Periksa koneksi dan coba lagi.');
      setScreenings([]);
      setStudents([]);
      setSchools([]);
      return;
    }
    setScreenings((screeningRes.data as ScreeningRow[]).map(screeningRowToModel));
    setStudents((studentRes.data as StudentRow[]).map(studentRowToStudent));
    setSchools((schoolRes.data as SchoolRow[]).map(schoolRowToSchool));
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadData();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isKoordinator = currentUser?.role === 'koordinator';
  const scopedSchoolId = isKoordinator ? currentUser?.schoolId : undefined;

  // Pagination: filter dulu (scope koordinator + tahun + search), baru slice.
  // Reset ke halaman 1 setiap input filter/scope/tahun berubah.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, currentAcademicYear, scopedSchoolId]);

  const resolvedScreenings = useMemo(() => {
    return screenings
      .map(s => {
        const student = students.find(st => st.id === s.studentId);
        const school = schools.find(sch => sch.id === (s.schoolId || student?.schoolId));
        return {
          ...s,
          studentName: student ? student.name : 'Unknown Student',
          schoolName: school ? school.name : 'Unknown School',
        schoolType: school ? school.type : 'SD' as 'SD' | 'SMP' | 'SMA',
        studentClass: s.studentClass || student?.class || '1',
        studentGender: s.studentGender || student?.gender || 'L',
      };
      })
      .filter((s) => {
        if (!scopedSchoolId) return true;
        if (s.schoolId) return s.schoolId === scopedSchoolId;
        const student = students.find((st) => st.id === s.studentId);
        return student?.schoolId === scopedSchoolId;
      });
  }, [screenings, students, schools, scopedSchoolId]);
  
  // Form state
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Status Gizi
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [physicalActivity, setPhysicalActivity] = useState('Aktif');
  
  // Indera
  const [visionLeft, setVisionLeft] = useState('Normal');
  const [visionRight, setVisionRight] = useState('Normal');
  const [hearingLeft, setHearingLeft] = useState('Normal');
  const [hearingRight, setHearingRight] = useState('Normal');
  
  // Gigi
  const [dentalCaries, setDentalCaries] = useState('Tidak Ada');
  const [dentalMouthHealth, setDentalMouthHealth] = useState('Sehat');
  const [cariesCount, setCariesCount] = useState('');
  
  // Fisik & Penyakit
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  // Nilai legacy bloodPressure ("120/80") — hanya dipertahankan saat edit, tidak pernah ditulis baru.
  const [legacyBloodPressure, setLegacyBloodPressure] = useState<string | undefined>(undefined);
  const [bloodSugar, setBloodSugar] = useState('90');
  const [tbcScreening, setTbcScreening] = useState('Negatif');
  const [hepatitisB, setHepatitisB] = useState('Negatif');
  const [hepatitisC, setHepatitisC] = useState('Negatif');
  
  // Jiwa
  const [mentalHealthStatus, setMentalHealthStatus] = useState('Stabil');
  
  // Khusus
  const [reproductiveHealth, setReproductiveHealth] = useState('Sehat');
  const [smokingStatus, setSmokingStatus] = useState('Tidak Merokok');
  const [immunizationHistory, setImmunizationHistory] = useState('Lengkap');
  const [anemiaStatus, setAnemiaStatus] = useState('Normal');
  const [hbLevel, setHbLevel] = useState('');
  const [menstruasi, setMenstruasi] = useState('Belum');
  const [notes, setNotes] = useState('');

  // Rujukan
  const [needsReferral, setNeedsReferral] = useState('Tidak');
  const [referralDestination, setReferralDestination] = useState('Puskesmas');
  const [referralReason, setReferralReason] = useState('');
  const [referralStatus, setReferralStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending');

  const selectedStudent = useMemo(() => 
    students.find(s => s.id === studentId), 
    [students, studentId]
  );

  // Update schoolId when student is selected
  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const student = students.find(s => s.id === id);
    if (student) {
      setSchoolId(student.schoolId);
    }
  };

  const scopedStudents = useMemo(() =>
    students.filter(s => ((scopedSchoolId ?? schoolId) === '' || s.schoolId === (scopedSchoolId ?? schoolId))),
    [students, scopedSchoolId, schoolId]
  );

  // Reset student when school changes
  const handleSchoolChange = (id: string) => {
    if (isKoordinator) return;
    setSchoolId(id);
    setStudentId(''); // Reset student selection
  };

  const getSchoolTypeForId = (schId: string) => {
    const school = schools.find(s => s.id === schId);
    return school ? school.type : 'SD';
  };

  const schoolType = selectedStudent ? getSchoolTypeForId(selectedStudent.schoolId) : 'SD';
  const studentClass = selectedStudent?.class || '1';
  const studentGender = selectedStudent?.gender || 'L';

  const bmi = (h: number, w: number): number | null => {
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightInMeters = h / 100;
    return parseFloat((w / (heightInMeters * heightInMeters)).toFixed(1));
  };

  const calculatedBmi = bmi(Number(height), Number(weight));

  const getHbInterpretation = (hb: number) => {
    if (!hb) return '-';
    if (hb >= 12) return 'Normal';
    if (hb >= 11) return 'Anemia Ringan';
    if (hb >= 8) return 'Anemia Sedang';
    return 'Anemia Berat';
  };

  const hbInterpretation = getHbInterpretation(Number(hbLevel));

  // Klasifikasi TD live: usia dari birthDate (tanpa birthDate → null → tanpa label),
  // jenis kelamin null → ambang paling sensitif (di dalam classifyBP).
  const liveBPAge = selectedStudent?.birthDate ? calculateAgeYears(selectedStudent.birthDate) : null;
  const liveBPResult = classifyBP(liveBPAge, Number(systolicBP), Number(diastolicBP), selectedStudent?.gender ?? null);

  const resetForm = () => {
    setEditingId(null);
    setSchoolId('');
    setStudentId('');
    setDate(new Date().toISOString().split('T')[0]);
    setHeight('');
    setWeight('');
    setPhysicalActivity('Aktif');
    setVisionLeft('Normal');
    setVisionRight('Normal');
    setHearingLeft('Normal');
    setHearingRight('Normal');
    setDentalCaries('Tidak Ada');
    setDentalMouthHealth('Sehat');
    setCariesCount('');
    setSystolicBP('');
    setDiastolicBP('');
    setLegacyBloodPressure(undefined);
    setBloodSugar('90');
    setTbcScreening('Negatif');
    setHepatitisB('Negatif');
    setHepatitisC('Negatif');
    setMentalHealthStatus('Stabil');
    setReproductiveHealth('Sehat');
    setSmokingStatus('Tidak Merokok');
    setImmunizationHistory('Lengkap');
    setAnemiaStatus('Normal');
    setHbLevel('');
    setMenstruasi('Belum');
    setNotes('');
    setNeedsReferral('Tidak');
    setReferralDestination('Puskesmas');
    setReferralReason('');
    setReferralStatus('pending');
  };

  const handleEditScreening = (screening: any) => {
    const student = students.find((st) => st.id === screening.studentId);
    setEditingId(screening.id);
    setSchoolId(screening.schoolId || student?.schoolId || '');
    setStudentId(screening.studentId || '');
    setDate(screening.date ? new Date(screening.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setHeight(String(screening.height ?? ''));
    setWeight(String(screening.weight ?? ''));
    setPhysicalActivity(screening.physicalActivity || 'Aktif');
    setVisionLeft(screening.visionLeft || 'Normal');
    setVisionRight(screening.visionRight || 'Normal');
    setHearingLeft(screening.hearingLeft || 'Normal');
    setHearingRight(screening.hearingRight || 'Normal');
    setDentalCaries(screening.dentalCaries || 'Tidak Ada');
    setDentalMouthHealth(screening.dentalMouthHealth || 'Sehat');
    setCariesCount(screening.cariesCount !== undefined && screening.cariesCount !== null ? String(screening.cariesCount) : '');
    setSystolicBP(screening.systolicBP !== undefined && screening.systolicBP !== null ? String(screening.systolicBP) : '');
    setDiastolicBP(screening.diastolicBP !== undefined && screening.diastolicBP !== null ? String(screening.diastolicBP) : '');
    setLegacyBloodPressure(screening.bloodPressure || undefined);
    setBloodSugar(screening.bloodSugar || '90');
    setTbcScreening(screening.tbcScreening || 'Negatif');
    setHepatitisB(screening.hepatitisB || 'Negatif');
    setHepatitisC(screening.hepatitisC || 'Negatif');
    setMentalHealthStatus(screening.mentalHealthStatus || 'Stabil');
    setReproductiveHealth(screening.reproductiveHealth || 'Sehat');
    setSmokingStatus(screening.smokingStatus || 'Tidak Merokok');
    setImmunizationHistory(screening.immunizationHistory || 'Lengkap');
    setAnemiaStatus(screening.anemiaStatus || 'Normal');
    setHbLevel(screening.hbLevel !== undefined && screening.hbLevel !== null ? String(screening.hbLevel) : '');
    setMenstruasi(screening.menstruasi || 'Belum');
    setNotes(screening.notes || '');
    setNeedsReferral(screening.needsReferral ? 'Ya' : 'Tidak');
    setReferralDestination(screening.referralDestination || 'Puskesmas');
    setReferralReason(screening.referralReason || '');
    setReferralStatus(screening.referralStatus || 'pending');
    setIsOpen(true);
  };

  const handleSaveScreening = async () => {
    if (isSaving) return;
    const effectiveSchoolId = scopedSchoolId ?? schoolId;
    if (!effectiveSchoolId || !studentId) {
      toast.error("Mohon pilih Sekolah dan Siswa");
      return;
    }

    const isRemajaPutri = studentGender === 'P' && ((schoolType === 'SMP' && studentClass === '7') || (schoolType === 'SMA' && studentClass === '10'));
    const isPutri = studentGender === 'P';
    if (dentalCaries === 'Ada') {
      const n = Number(cariesCount);
      if (!cariesCount || !Number.isInteger(n) || n < 1 || n > 32) {
        toast.error("Jumlah karies 1–32");
        return;
      }
    }

    const record: Omit<Screening, 'id' | 'entryDate' | 'createdBy' | 'academicYear'> & { academicYear: string } = {
      studentId,
      schoolId: effectiveSchoolId,
      academicYear: currentAcademicYear,
      studentClass,
      studentGender,
      date: new Date(date).toISOString(),
      height: height ? Number(height) : 0,
      weight: weight ? Number(weight) : 0,
      bmi: calculatedBmi ?? 0,
      physicalActivity,
      visionLeft,
      visionRight,
      hearingLeft,
      hearingRight,
      dentalCaries,
      dentalMouthHealth,
      cariesCount: dentalCaries === 'Ada' ? Number(cariesCount) : undefined,
      bloodPressure: legacyBloodPressure,
      systolicBP: systolicBP ? Number(systolicBP) : undefined,
      diastolicBP: diastolicBP ? Number(diastolicBP) : undefined,
      bpCategory: liveBPResult ? `Sistolik: ${liveBPResult.sysLabel}; Diastolik: ${liveBPResult.diaLabel}` : undefined,
      bloodSugar,
      tbcScreening,
      hepatitisB,
      hepatitisC,
      mentalHealthStatus,
      reproductiveHealth,
      menstruasi: isPutri ? (menstruasi as 'Sudah' | 'Belum') : undefined,
      smokingStatus,
      immunizationHistory,
      anemiaStatus,
      hbLevel: hbLevel ? Number(hbLevel) : undefined,
      hbInterpretation: hbLevel ? hbInterpretation : undefined,
      notes,
      needsReferral: needsReferral === 'Ya',
      referralDestination: needsReferral === 'Ya' ? referralDestination : undefined,
      referralReason: needsReferral === 'Ya' ? referralReason : undefined,
      referralStatus: needsReferral === 'Ya' ? referralStatus : undefined,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('screenings')
          .update(screeningToInsert({ ...record, entryDate: new Date().toISOString(), createdBy: null }))
          .eq('id', editingId)
          .select(SCREENING_SELECT)
          .single();
        if (error || !data) {
          toast.error('Gagal memperbarui hasil pemeriksaan. Periksa koneksi dan coba lagi.');
          return;
        }
        const updatedScreening = screeningRowToModel(data as ScreeningRow);
        setScreenings((prev) => prev.map((s) => (s.id === editingId ? updatedScreening : s)));
        toast.success("Hasil pemeriksaan berhasil diperbarui");
      } else {
        const screeningDay = record.date.slice(0, 10);
        const { data: dupHit, error: dupError } = await supabase
          .from('screenings')
          .select('id')
          .eq('student_id', record.studentId)
          .eq('date', screeningDay)
          .limit(1);
        if (dupError) {
          toast.error('Gagal memeriksa duplikat pemeriksaan. Periksa koneksi dan coba lagi.');
          return;
        }
        if (dupHit && dupHit.length > 0) {
          toast.info('Pemeriksaan siswa ini pada tanggal tersebut sudah tercatat.');
          return;
        }
        const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
        const { data, error } = await supabase
          .from('screenings')
          .insert(screeningToInsert({ ...record, entryDate: new Date().toISOString(), createdBy }))
          .select(SCREENING_SELECT)
          .single();
        if (error || !data) {
          toast.error('Gagal menyimpan hasil pemeriksaan. Periksa koneksi dan coba lagi.');
          return;
        }
        const newScreening = screeningRowToModel(data as ScreeningRow);
        setScreenings((prev) => [newScreening, ...prev]);
        toast.success("Hasil pemeriksaan berhasil disimpan");
      }
    } finally {
      setIsSaving(false);
      // Reset form
      resetForm();
      setIsOpen(false);
    }
  };

  const handleDeleteScreening = async (id: string) => {
    setIsDeleting(true);
    try {
    const { error } = await supabase.from('screenings').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus hasil pemeriksaan. Coba lagi.');
      return;
    }
    setScreenings((prev) => prev.filter((s) => s.id !== id));
    toast.success("Hasil pemeriksaan berhasil dihapus");
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const deleteTargetLabel = (() => {
    if (!deleteTargetId) return '';
    const found = resolvedScreenings.find((s) => s.id === deleteTargetId);
    if (!found) return deleteTargetId;
    const dateStr = found.date ? new Date(found.date).toLocaleDateString('id-ID') : '';
    return `${found.studentName}${dateStr ? ` — ${dateStr}` : ''}`;
  })();

  const handleViewDetail = (screening: any) => {
    setSelectedScreening(screening);
    setIsDetailOpen(true);
  };

  const filteredScreenings = resolvedScreenings.filter(s =>
    (!s.academicYear || s.academicYear === currentAcademicYear) &&
    (s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.schoolName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalCount = filteredScreenings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, totalCount);
  const pagedScreenings = filteredScreenings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleExport = () => {
    // Kolom persis mirror kunci templateData downloadTemplate agar
    // export->import round-trip (siswa dikenali lagi via NIK/nama).
    const dataToExport = filteredScreenings.map((s) => ({
      'NIK Siswa': students.find((st) => st.id === s.studentId)?.nik ?? '',
      'Nama Siswa': s.studentName,
      'Sekolah': s.schoolName,
      'Tanggal (YYYY-MM-DD)': s.date ? s.date.slice(0, 10) : '',
      'Tinggi Badan (cm)': s.height || '',
      'Berat Badan (kg)': s.weight || '',
      'BMI': s.bmi || '-',
      'Tekanan Darah': s.bloodPressure ?? '',
      'Sistolik': s.systolicBP ?? '-',
      'Diastolik': s.diastolicBP ?? '-',
      'Kategori TD': s.bpCategory ?? '-',
      'Gula Darah': s.bloodSugar ?? '',
      'Kadar HB': s.hbLevel ?? '',
      'Visi Kiri': s.visionLeft ?? '',
      'Visi Kanan': s.visionRight ?? '',
      'Pendengaran Kiri': s.hearingLeft ?? '',
      'Pendengaran Kanan': s.hearingRight ?? '',
      'Karies Gigi': s.dentalCaries ?? '',
      'Jumlah Karies': s.cariesCount ?? '-',
      'Kesehatan Mulut': s.dentalMouthHealth ?? '',
      'Skrining TBC': s.tbcScreening ?? '',
      'Hepatitis B': s.hepatitisB ?? '',
      'Hepatitis C': s.hepatitisC ?? '',
      'Kesehatan Mental': s.mentalHealthStatus ?? '',
      'Kesehatan Reproduksi': s.reproductiveHealth ?? '',
      'Menstruasi': s.menstruasi ?? '-',
      'Merokok': s.smokingStatus ?? '',
      'Aktivitas Fisik': s.physicalActivity ?? '',
      'Riwayat Imunisasi': s.immunizationHistory ?? '',
      'Perlu Rujukan (Ya/Tidak)': s.needsReferral ? 'Ya' : 'Tidak',
      'Tujuan Rujukan': s.referralDestination ?? '',
      'Alasan Rujukan': s.referralReason ?? '',
      'Catatan': s.notes ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pemeriksaan");
    XLSX.writeFile(wb, `data-pemeriksaan-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Berhasil mengekspor ${dataToExport.length} data pemeriksaan`);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'NIK Siswa': '3201011205150001',
        'Nama Siswa': 'Andi Pratama',
        'Sekolah': 'SDN Baruharjo 1',
        'Tanggal (YYYY-MM-DD)': '2024-03-15',
        'Tinggi Badan (cm)': '140',
        'Berat Badan (kg)': '35',
        'Tekanan Darah': '110/70',
        'Sistolik': '110',
        'Diastolik': '70',
        'Gula Darah': '90',
        'Kadar HB': '12.5',
        'Visi Kiri': 'Normal',
        'Visi Kanan': 'Normal',
        'Pendengaran Kiri': 'Normal',
        'Pendengaran Kanan': 'Normal',
        'Karies Gigi': 'Tidak Ada',
        'Jumlah Karies': '',
        'Kesehatan Mulut': 'Sehat',
        'Skrining TBC': 'Negatif',
        'Hepatitis B': 'Negatif',
        'Hepatitis C': 'Negatif',
        'Kesehatan Mental': 'Stabil',
        'Kesehatan Reproduksi': 'Sehat',
        'Menstruasi': '',
        'Merokok': 'Tidak Merokok',
        'Aktivitas Fisik': 'Aktif',
        'Riwayat Imunisasi': 'Lengkap',
        'Perlu Rujukan (Ya/Tidak)': 'Tidak',
        'Tujuan Rujukan': '',
        'Alasan Rujukan': '',
        'Catatan': 'Pemeriksaan rutin'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Pemeriksaan");
    XLSX.writeFile(wb, "Template_Pemeriksaan_UKS.xlsx");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error("File kosong atau format tidak sesuai");
          return;
        }

        const newRecords: any[] = [];
        const skippedRows: string[] = [];

        data.forEach((row, index) => {
          const rowNo = index + 1;

          // --- Resolusi sekolah: koordinator -> sekolah sendiri; admin -> kolom 'Sekolah' ---
          let resolvedSchoolId: string | undefined;
          if (scopedSchoolId) {
            resolvedSchoolId = scopedSchoolId;
          } else {
            const schoolCell = row['Sekolah']?.toString().trim() ?? '';
            if (!schoolCell) {
              skippedRows.push(`Baris ${rowNo}: Sekolah tidak dikenali (kolom 'Sekolah' kosong)`);
              return;
            }
            const cellLower = schoolCell.toLowerCase();
            const matches = schools.filter((s) => s.name.toLowerCase().includes(cellLower));
            if (matches.length !== 1) {
              skippedRows.push(`Baris ${rowNo}: Sekolah tidak dikenali ('${schoolCell}')`);
              return;
            }
            resolvedSchoolId = matches[0].id;
          }

          // --- Pencocokan siswa: NIK dulu; bila NIK kosong -> Nama (persis, case-insensitive) + sekolah ---
          const rawNik = row['NIK Siswa']?.toString().trim() ?? '';
          const name = row['Nama Siswa']?.toString().trim() ?? '';
          let student: Student | undefined;
          if (rawNik) {
            student = students.find((s) => s.nik === rawNik);
            if (!student) {
              skippedRows.push(`Baris ${rowNo}: Siswa tidak ditemukan (NIK '${rawNik}')`);
              return;
            }
          } else {
            if (!name) {
              skippedRows.push(`Baris ${rowNo}: Siswa tidak ditemukan (tanpa NIK/nama)`);
              return;
            }
            student = students.find(
              (s) => s.name.toLowerCase() === name.toLowerCase() && s.schoolId === resolvedSchoolId
            );
            if (!student) {
              skippedRows.push(`Baris ${rowNo}: Siswa tidak ditemukan (nama '${name}' di sekolah tersebut)`);
              return;
            }
          }

          // --- TB/BB opsional (T3): kosong -> 0 (tampil '-'); terisi tapi non-numerik -> skip ---
          const hRaw = row['Tinggi Badan (cm)'];
          const wRaw = row['Berat Badan (kg)'];
          const hPresent = hRaw !== null && hRaw !== undefined && hRaw.toString().trim() !== '';
          const wPresent = wRaw !== null && wRaw !== undefined && wRaw.toString().trim() !== '';
          const h = parseStrictNumber(hRaw);
          const w = parseStrictNumber(wRaw);
          if ((hPresent && (h === null || h <= 0)) || (wPresent && (w === null || w <= 0))) {
            const badCol = hPresent && (h === null || h <= 0) ? 'Tinggi Badan (cm)' : 'Berat Badan (kg)';
            skippedRows.push(`Baris ${rowNo}: ${badCol} tidak valid ('${row[badCol]}')`);
            return;
          }
          const hb = parseStrictNumber(row['Kadar HB']);

          // --- Sistolik/Diastolik: hanya dibaca bila kolom ada & terisi (tanda '-' ekspor = kosong) ---
          const sysRaw = row['Sistolik'];
          const diaRaw = row['Diastolik'];
          const sysPresent = sysRaw !== null && sysRaw !== undefined && sysRaw.toString().trim() !== '' && sysRaw.toString().trim() !== '-';
          const diaPresent = diaRaw !== null && diaRaw !== undefined && diaRaw.toString().trim() !== '' && diaRaw.toString().trim() !== '-';
          const sys = sysPresent ? parseStrictNumber(sysRaw) : null;
          const dia = diaPresent ? parseStrictNumber(diaRaw) : null;
          if (sysPresent && (sys === null || sys < 40 || sys > 300)) {
            skippedRows.push(`Baris ${rowNo}: Sistolik tidak valid ('${sysRaw}') — harus angka 40–300`);
            return;
          }
          if (diaPresent && (dia === null || dia < 20 || dia > 200)) {
            skippedRows.push(`Baris ${rowNo}: Diastolik tidak valid ('${diaRaw}') — harus angka 20–200`);
            return;
          }
          const bpAge = student.birthDate ? calculateAgeYears(student.birthDate) : null;
          const bpResult = sys !== null && dia !== null
            ? classifyBP(bpAge, sys, dia, student.gender ?? null)
            : null;

          // --- Menstruasi: Sudah/Belum apa adanya (gating putri berlaku di form) ---
          const mensRaw = row['Menstruasi']?.toString().trim() ?? '';
          const menstruasi = mensRaw === 'Sudah' || mensRaw === 'Belum' ? mensRaw : undefined;

          // --- Visi: petakan ke Normal/Indikasi Gangguan, default Normal ---
          const mapVision = (cell: unknown): string => {
            const t = cell?.toString().trim().toLowerCase() ?? '';
            if (t === '' || t === '-') return 'Normal';
            if (t.includes('gangguan') || t.includes('indikasi') || t === 'tidak normal' || t === 'abnormal') return 'Indikasi Gangguan';
            return 'Normal';
          };

          // --- Jumlah Karies 1–32 bila Karies Ada ---
          const dentalCariesVal: string = row['Karies Gigi'] || 'Tidak Ada';
          const cariesRaw = row['Jumlah Karies'];
          const cariesPresent = cariesRaw !== null && cariesRaw !== undefined && cariesRaw.toString().trim() !== '' && cariesRaw.toString().trim() !== '-';
          let cariesCountVal: number | undefined;
          if (dentalCariesVal === 'Ada' && cariesPresent) {
            const n = parseStrictNumber(cariesRaw);
            if (n === null || !Number.isInteger(n) || n < 1 || n > 32) {
              skippedRows.push(`Baris ${rowNo}: Jumlah Karies tidak valid ('${cariesRaw}') — harus angka bulat 1–32`);
              return;
            }
            cariesCountVal = n;
          }

          const heightVal = h ?? 0;
          const weightVal = w ?? 0;
          const calculatedBmiValue = bmi(heightVal, weightVal);
          const hbInterp = hb === null ? '-' : getHbInterpretation(hb);

          const record = {
            studentId: student.id,
            schoolId: student.schoolId,
            academicYear: currentAcademicYear,
            studentName: student.name,
            schoolName: schools.find((sch) => sch.id === student.schoolId)?.name ?? 'Unknown School',
            schoolType: (schools.find((sch) => sch.id === student.schoolId)?.type ?? 'SD') as 'SD' | 'SMP' | 'SMA',
            studentClass: student.class,
            studentGender: student.gender,
            date: excelCellToISODate(row['Tanggal (YYYY-MM-DD)']) || new Date().toISOString().slice(0, 10),
            entryDate: new Date().toISOString(),
            height: heightVal,
            weight: weightVal,
            bmi: calculatedBmiValue ?? 0,
            physicalActivity: row['Aktivitas Fisik'] || 'Aktif',
            visionLeft: mapVision(row['Visi Kiri']),
            visionRight: mapVision(row['Visi Kanan']),
            hearingLeft: row['Pendengaran Kiri'] || 'Normal',
            hearingRight: row['Pendengaran Kanan'] || 'Normal',
            dentalCaries: dentalCariesVal,
            dentalMouthHealth: row['Kesehatan Mulut'] || 'Sehat',
            cariesCount: cariesCountVal,
            bloodPressure: row['Tekanan Darah'] || '110/70',
            systolicBP: sys ?? undefined,
            diastolicBP: dia ?? undefined,
            bpCategory: bpResult ? `Sistolik: ${bpResult.sysLabel}; Diastolik: ${bpResult.diaLabel}` : undefined,
            bloodSugar: row['Gula Darah'] || '90',
            tbcScreening: row['Skrining TBC'] || 'Negatif',
            hepatitisB: row['Hepatitis B'] || 'Negatif',
            hepatitisC: row['Hepatitis C'] || 'Negatif',
            mentalHealthStatus: row['Kesehatan Mental'] || 'Stabil',
            reproductiveHealth: row['Kesehatan Reproduksi'] || 'Sehat',
            menstruasi,
            smokingStatus: row['Merokok'] || 'Tidak Merokok',
            immunizationHistory: row['Riwayat Imunisasi'] || 'Lengkap',
            anemiaStatus: hbInterp === 'Normal' ? 'Normal' : 'Anemia',
            hbLevel: hb === null ? undefined : hb,
            hbInterpretation: hb === null ? undefined : hbInterp,
            notes: row['Catatan'] || '',
            createdBy: currentUser?.username ?? 'admin',
            needsReferral: row['Perlu Rujukan (Ya/Tidak)'] === 'Ya',
            referralDestination: row['Tujuan Rujukan'] || undefined,
            referralReason: row['Alasan Rujukan'] || undefined,
            referralStatus: row['Perlu Rujukan (Ya/Tidak)'] === 'Ya' ? 'pending' : undefined,
          };

          newRecords.push(record);
        });

        if (newRecords.length > 0) {
          // Paksa scope koordinator server-side: baris sekolah lain dilewati.
          const scopedRecords = scopedSchoolId
            ? newRecords.filter((r) => r.schoolId === scopedSchoolId)
            : newRecords;
          const scopeSkipped = newRecords.length - scopedRecords.length;
          const skippedSummary = scopeSkipped > 0
            ? [`${scopeSkipped} baris dilewati (di luar sekolah Anda)`, ...skippedRows]
            : skippedRows;
          if (skippedSummary.length > 0) {
            toast.error(`${skippedSummary.length} baris dilewati: ${skippedSummary.join('; ')}`);
          }
          if (scopedRecords.length === 0) {
            toast.error("Tidak ada data valid untuk sekolah Anda");
            return;
          }
          const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
          const { error } = await supabase.from('screenings').insert(
            scopedRecords.map((r) => screeningToInsert({ ...r, entryDate: new Date().toISOString(), createdBy }))
          );
          if (error) {
            toast.error('Gagal mengimpor data. Periksa koneksi dan coba lagi.');
            return;
          }
          await loadData();
          toast.success(`Berhasil mengimpor ${scopedRecords.length} data pemeriksaan.`, {
            description: skippedSummary.length > 0 ? `${skippedSummary.length} baris dilewati. TA ${currentAcademicYear}.` : `Data telah ditambahkan untuk TA ${currentAcademicYear}.`
          });
          setIsImportOpen(false);
        } else {
          if (skippedRows.length > 0) {
            toast.error(`${skippedRows.length} baris dilewati: ${skippedRows.join('; ')}`);
          } else {
            toast.error("Tidak ada data valid yang dapat diimpor");
          }
        }
      } catch {
        toast.error("File tak terbaca. Pastikan format sesuai template.");
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset input
    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Pemeriksaan Kesehatan</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Catat dan pantau hasil pemeriksaan berkala siswa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all">
                <Upload className="w-4 h-4" /> Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md sm:max-w-md rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">Import Data Pemeriksaan</DialogTitle>
                <DialogDescription className="font-medium">Unggah file Excel (.xlsx) atau CSV untuk mengimpor data pemeriksaan secara massal.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Klik untuk pilih file</p>
                  <p className="text-xs text-slate-400 mt-1">Mendukung .xlsx, .xls, .csv</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleImportFile}
                  />
                </div>
                
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-start gap-3">
                    <Download className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Gunakan Template</p>
                      <p className="text-xs text-amber-600 mb-3">Pastikan format kolom sesuai dengan template agar data terbaca dengan benar.</p>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg border-amber-200 bg-white text-amber-700 hover:bg-amber-50" onClick={downloadTemplate}>
                        Download Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => resetForm()}>
                <Plus className="w-4 h-4" /> Catat Pemeriksaan
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">{editingId ? 'Edit Hasil Pemeriksaan' : 'Catat Hasil Pemeriksaan'}</DialogTitle>
              <DialogDescription className="font-medium">Masukkan data kesehatan hasil pemeriksaan siswa untuk Tahun Ajaran {currentAcademicYear}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-8 py-4">
              {/* Identitas Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Identitas & Waktu
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Sekolah</Label>
                    <Select value={scopedSchoolId ?? schoolId} onValueChange={handleSchoolChange} disabled={isKoordinator}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih sekolah">{schools.find((s) => s.id === (scopedSchoolId ?? schoolId))?.name ?? ((scopedSchoolId ?? schoolId) ? 'Sekolah tidak tersedia' : undefined)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(scopedSchoolId ? schools.filter(s => s.id === scopedSchoolId) : schools).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Siswa</Label>
                    <StudentCombobox students={scopedStudents} value={studentId} onChange={handleStudentChange} />
                  </div>
                </div>

                {studentId && (() => {
                  const selStudent = students.find(s => s.id === studentId);
                  if (!selStudent) return null;
                  const ageInfo = selStudent.birthDate ? calculateAgeDetails(selStudent.birthDate) : null;
                  return (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span><strong>Tgl Lahir:</strong> {selStudent.birthDate ? new Date(selStudent.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' }) : 'Belum diisi'}</span>
                      </div>
                      <span className="font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                        Usia: {ageInfo ? ageInfo.formatted : `${selStudent.age || 0} Tahun`}
                      </span>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Tanggal Pemeriksaan</Label>
                    <Input type="date" className="rounded-xl border-slate-200" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Level Sekolah & Kelas</Label>
                    <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold">
                      {schoolType} - Kelas {studentClass}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Gizi Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Status Gizi & Kebugaran
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="height" className="font-bold text-slate-700">TB (cm)</Label>
                    <Input id="height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="weight" className="font-bold text-slate-700">BB (kg)</Label>
                    <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">BMI</Label>
                    <div className="h-10 px-3 flex items-center bg-primary/5 border border-primary/20 rounded-xl text-primary font-bold">
                      {calculatedBmi || '-'}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Aktivitas Fisik</Label>
                    <Select value={physicalActivity} onValueChange={setPhysicalActivity}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktif">Aktif</SelectItem>
                        <SelectItem value="Cukup">Cukup</SelectItem>
                        <SelectItem value="Kurang">Kurang</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Indera & Gigi Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" /> Indera, Gigi & Mulut
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Tajam Penglihatan (Mata)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Kiri</span>
                        <Select value={visionLeft} onValueChange={setVisionLeft}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal (visus 6/6–6/9)</SelectItem>
                            <SelectItem value="Indikasi Gangguan">Indikasi gangguan (visus &lt; 6/9)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Kanan</span>
                        <Select value={visionRight} onValueChange={setVisionRight}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal (visus 6/6–6/9)</SelectItem>
                            <SelectItem value="Indikasi Gangguan">Indikasi gangguan (visus &lt; 6/9)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Tajam Pendengaran (Telinga)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Kiri</span>
                        <Input placeholder="Kiri" value={hearingLeft} onChange={(e) => setHearingLeft(e.target.value)} className="rounded-xl" />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Kanan</span>
                        <Input placeholder="Kanan" value={hearingRight} onChange={(e) => setHearingRight(e.target.value)} className="rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Pemeriksaan Karies</Label>
                    <Select value={dentalCaries} onValueChange={setDentalCaries}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tidak Ada">Tidak Ada</SelectItem>
                        <SelectItem value="Ada">Ada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Kesehatan Mulut</Label>
                    <Select value={dentalMouthHealth} onValueChange={setDentalMouthHealth}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sehat">Sehat</SelectItem>
                        <SelectItem value="Perlu Perawatan">Perlu Perawatan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {dentalCaries === 'Ada' && (
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Jumlah Karies</Label>
                    <Input
                      type="number"
                      min={1}
                      max={32}
                      placeholder="1–32"
                      value={cariesCount}
                      onChange={(e) => setCariesCount(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Fisik & Penyakit Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" /> Fisik & Penyakit
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Sistolik (mmHg)</Label>
                    <Input type="number" min={0} placeholder="110" value={systolicBP} onChange={(e) => setSystolicBP(e.target.value)} className="rounded-xl" />
                    <div className="h-6 flex items-center">
                      {liveBPResult ? (
                        <Badge variant="outline" className={`text-[11px] font-bold ${
                          liveBPResult.sysLabel === 'Normal'
                            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                            : liveBPResult.sysLabel === 'Tinggi'
                              ? 'text-amber-600 border-amber-200 bg-amber-50'
                              : 'text-sky-600 border-sky-200 bg-sky-50'
                        }`}>
                          Sistolik: {liveBPResult.sysLabel}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Diastolik (mmHg)</Label>
                    <Input type="number" min={0} placeholder="70" value={diastolicBP} onChange={(e) => setDiastolicBP(e.target.value)} className="rounded-xl" />
                    <div className="h-6 flex items-center">
                      {liveBPResult ? (
                        <Badge variant="outline" className={`text-[11px] font-bold ${
                          liveBPResult.diaLabel === 'Normal'
                            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                            : liveBPResult.diaLabel === 'Tinggi'
                              ? 'text-amber-600 border-amber-200 bg-amber-50'
                              : 'text-sky-600 border-sky-200 bg-sky-50'
                        }`}>
                          Diastolik: {liveBPResult.diaLabel}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                  {legacyBloodPressure && (
                    <p className="col-span-3 text-[11px] text-slate-400">Data lama: {legacyBloodPressure} (dipertahankan apa adanya)</p>
                  )}
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Gula Darah (Diabetes)</Label>
                    <Input placeholder="mg/dL" value={bloodSugar} onChange={(e) => setBloodSugar(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Skrining TBC</Label>
                    <Select value={tbcScreening} onValueChange={setTbcScreening}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Negatif">Negatif</SelectItem>
                        <SelectItem value="Gejala">Ada Gejala</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Hepatitis B</Label>
                    <Select value={hepatitisB} onValueChange={setHepatitisB}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Negatif">Negatif</SelectItem>
                        <SelectItem value="Positif">Positif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {schoolType === 'SMA' && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Hepatitis C (Khusus SMA)</Label>
                      <Select value={hepatitisC} onValueChange={setHepatitisC}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Negatif">Negatif</SelectItem>
                          <SelectItem value="Positif">Positif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Kadar HB Darah (mg/dL)</Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="Contoh: 12.5" 
                      value={hbLevel} 
                      onChange={(e) => setHbLevel(e.target.value)} 
                      className="rounded-xl" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Interpretasi HB (Otomatis)</Label>
                    <div className={`h-10 px-3 flex items-center border rounded-xl font-bold ${
                      hbInterpretation === 'Normal' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      hbInterpretation === '-' ? 'bg-slate-50 border-slate-200 text-slate-500' :
                      'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {hbInterpretation}
                    </div>
                  </div>
                </div>
              </div>

              {/* Jiwa Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Kesehatan Jiwa
                </h3>
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Skrining Kesehatan Mental</Label>
                  <Select value={mentalHealthStatus} onValueChange={setMentalHealthStatus}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stabil">Stabil</SelectItem>
                      <SelectItem value="Perlu Observasi">Perlu Observasi</SelectItem>
                      <SelectItem value="Risiko Tinggi">Risiko Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Khusus Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" /> Pemeriksaan Khusus
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Reproductive Health: SD (4-6), SMP, SMA */}
                  {((schoolType === 'SD' && Number(studentClass) >= 4) || schoolType !== 'SD') && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Kesehatan Reproduksi</Label>
                      <Select value={reproductiveHealth} onValueChange={setReproductiveHealth}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sehat">Sehat</SelectItem>
                          <SelectItem value="Ada Keluhan">Ada Keluhan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Smoking: SD (5-6), SMP, SMA */}
                  {((schoolType === 'SD' && Number(studentClass) >= 5) || schoolType !== 'SD') && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Skrining Merokok</Label>
                      <Select value={smokingStatus} onValueChange={setSmokingStatus}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Tidak Merokok">Tidak Merokok</SelectItem>
                          <SelectItem value="Pernah">Pernah</SelectItem>
                          <SelectItem value="Aktif">Aktif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Immunization: SD Class 1 (tetap tampil saat edit bila data tersimpan belum lengkap) */}
                  {(schoolType === 'SD' && studentClass === '1') || (editingId && immunizationHistory && immunizationHistory !== 'Lengkap') ? (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Riwayat Imunisasi (Kls 1)</Label>
                      <Select value={immunizationHistory} onValueChange={setImmunizationHistory}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lengkap">Lengkap</SelectItem>
                          <SelectItem value="Tidak Lengkap">Tidak Lengkap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {/* Anemia: SMP Class 7, SMA Class 10 (Remaja Putri) */}
                  {studentGender === 'P' && ((schoolType === 'SMP' && studentClass === '7') || (schoolType === 'SMA' && studentClass === '10')) && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Skrining Anemia (Remaja Putri)</Label>
                      <Select value={anemiaStatus} onValueChange={setAnemiaStatus}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Anemia">Anemia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Menstruasi: all female students (gender P) */}
                  {studentGender === 'P' && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Menstruasi</Label>
                      <Select value={menstruasi} onValueChange={setMenstruasi}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sudah">Sudah</SelectItem>
                          <SelectItem value="Belum">Belum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Rujukan Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" /> Rujukan (Jika Diperlukan)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Perlu Rujukan?</Label>
                    <Select value={needsReferral} onValueChange={setNeedsReferral}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tidak">Tidak</SelectItem>
                        <SelectItem value="Ya">Ya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {needsReferral === 'Ya' && (
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Tujuan Rujukan</Label>
                      <Select value={referralDestination} onValueChange={setReferralDestination}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Puskesmas">Puskesmas</SelectItem>
                          <SelectItem value="Rumah Sakit">Rumah Sakit</SelectItem>
                          <SelectItem value="Dokter Spesialis">Dokter Spesialis</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {needsReferral === 'Ya' && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="referralReason" className="font-bold text-slate-700">Alasan Rujukan</Label>
                      <Input 
                        id="referralReason" 
                        value={referralReason} 
                        onChange={(e) => setReferralReason(e.target.value)} 
                        className="rounded-xl" 
                        placeholder="Contoh: Hasil tajam penglihatan rendah, perlu pemeriksaan lanjut" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="font-bold text-slate-700">Status Rujukan Awal</Label>
                      <Select value={referralStatus} onValueChange={(v: any) => setReferralStatus(v)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                          <SelectItem value="completed">Selesai (Completed)</SelectItem>
                          <SelectItem value="cancelled">Dibatalkan (Cancelled)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes" className="font-bold text-slate-700">Catatan Tambahan</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" placeholder="Catatan medis lainnya..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleSaveScreening()} disabled={isSaving} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">{isSaving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Simpan Hasil Pemeriksaan'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama siswa atau sekolah..." 
            className="pl-10 h-11 rounded-xl border-slate-200 bg-white/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Tgl Periksa</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama Siswa</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Level/Kelas</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">TB/BB</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">BMI</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Status Gizi</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Rujukan</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedScreenings.map((screening) => (
              <TableRow key={screening.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                <TableCell className="text-sm py-4">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <CalendarIcon className="w-4 h-4 text-primary/60" />
                    {new Date(screening.date).toLocaleDateString('id-ID')}
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="font-bold text-slate-700">{screening.studentName}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase">{screening.schoolName}</div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {screening.schoolType} - Kls {screening.studentClass}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500 font-mono text-xs py-4">{screening.height || '-'}/{screening.weight || '-'}</TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2 font-bold text-primary">
                    <Activity className="w-4 h-4" />
                    {screening.bmi || '-'}
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  {!screening.bmi ? (
                    <span className="text-[10px] text-slate-400 font-bold uppercase">-</span>
                  ) : (
                  <Badge variant={screening.bmi > 25 ? 'destructive' : screening.bmi < 18.5 ? 'outline' : 'secondary'} className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {screening.bmi > 25 ? 'Gemuk' : screening.bmi < 18.5 ? 'Kurus' : 'Normal'}
                  </Badge>
                  )}
                </TableCell>
                <TableCell className="py-4">
                  {screening.needsReferral ? (
                    <Badge variant="destructive" className="rounded-md px-2 py-0.5 text-[10px] font-bold gap-1 bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100">
                      <ExternalLink className="w-3 h-3" />
                      Rujukan
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold uppercase">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right py-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Lihat detail"
                      className="rounded-lg font-bold text-primary hover:bg-primary/10"
                      onClick={() => handleViewDetail(screening)}
                    >
                      Detail
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleEditScreening(screening)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Hapus"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTargetId(screening.id)}
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

      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{pageStart}-{pageEnd} dari {totalCount}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Sebelumnya</Button>
            <span className="text-sm font-bold text-slate-700">{safePage}/{totalPages}</span>
            <Button variant="outline" size="sm" className="rounded-xl" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Berikutnya</Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Detail Hasil Pemeriksaan</DialogTitle>
            <DialogDescription className="font-medium">Informasi lengkap hasil pemeriksaan kesehatan siswa.</DialogDescription>
          </DialogHeader>
          
          {selectedScreening && (
            <div className="grid gap-8 py-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedScreening.studentName}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{selectedScreening.schoolName} ({selectedScreening.schoolType} - Kelas {selectedScreening.studentClass})</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal Periksa</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedScreening.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Status Gizi & Fisik
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Tinggi/Berat</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.height}cm / {selectedScreening.weight}kg</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">BMI</p>
                      <p className="text-sm font-bold text-primary">{selectedScreening.bmi || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Tekanan Darah</p>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedScreening.systolicBP !== undefined && selectedScreening.diastolicBP !== undefined
                          ? `${selectedScreening.systolicBP}/${selectedScreening.diastolicBP}`
                          : (selectedScreening.bloodPressure || '-')}
                      </p>
                      {selectedScreening.bpCategory && (
                        <Badge variant="outline" className="mt-1 text-[10px] font-bold text-slate-600 border-slate-200 bg-slate-50">
                          {selectedScreening.bpCategory}
                        </Badge>
                      )}
                      {selectedScreening.bloodPressure && (selectedScreening.systolicBP !== undefined || selectedScreening.diastolicBP !== undefined) && (
                        <p className="text-[10px] text-slate-400 mt-1">Data lama: {selectedScreening.bloodPressure}</p>
                      )}
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Gula Darah</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.bloodSugar || '-'} mg/dL</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kadar HB Darah</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm font-bold text-slate-800">{selectedScreening.hbLevel || '-'} mg/dL</p>
                        {selectedScreening.hbInterpretation && (
                          <Badge variant="outline" className={`text-[10px] font-bold ${
                            selectedScreening.hbInterpretation === 'Normal' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'
                          }`}>
                            {selectedScreening.hbInterpretation}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Indera & Gigi
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Mata (L/R)</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.visionLeft}/{selectedScreening.visionRight}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Telinga (L/R)</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.hearingLeft}/{selectedScreening.hearingRight}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Karies Gigi</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.dentalCaries || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kesehatan Mulut</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.dentalMouthHealth || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Skrining Penyakit & Jiwa
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">TBC</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.tbcScreening || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Hepatitis B</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.hepatitisB || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kesehatan Jiwa</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.mentalHealthStatus || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Baby className="w-4 h-4" /> Khusus & Reproduksi
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Reproduksi</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.reproductiveHealth || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Merokok</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.smokingStatus || '-'}</p>
                    </div>
                    {selectedScreening.schoolType === 'SD' && selectedScreening.studentClass === '1' && (
                      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Imunisasi</p>
                        <p className="text-sm font-bold text-slate-800">{selectedScreening.immunizationHistory || '-'}</p>
                      </div>
                    )}
                    {selectedScreening.studentGender === 'P' && (selectedScreening.anemiaStatus) && (
                      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Anemia (Remaja Putri)</p>
                        <p className="text-sm font-bold text-slate-800">{selectedScreening.anemiaStatus || '-'}</p>
                      </div>
                    )}
                    {selectedScreening.studentGender === 'P' && (
                      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Menstruasi</p>
                        <p className="text-sm font-bold text-slate-800">{selectedScreening.menstruasi || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedScreening.needsReferral && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink className="w-3 h-3" /> Informasi Rujukan
                    </p>
                    <Badge 
                      variant={selectedScreening.referralStatus === 'completed' ? 'secondary' : selectedScreening.referralStatus === 'cancelled' ? 'outline' : 'destructive'}
                      className="rounded-full px-3 py-0.5 text-[10px] font-bold gap-1"
                    >
                      {selectedScreening.referralStatus === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                      {selectedScreening.referralStatus === 'pending' && <Clock className="w-3 h-3" />}
                      {selectedScreening.referralStatus === 'cancelled' && <XCircle className="w-3 h-3" />}
                      {selectedScreening.referralStatus === 'completed' ? 'Selesai' : selectedScreening.referralStatus === 'cancelled' ? 'Dibatalkan' : 'Menunggu'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-rose-400 font-bold uppercase">Tujuan</p>
                      <p className="text-sm font-bold text-rose-900">{selectedScreening.referralDestination}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-rose-400 font-bold uppercase">Alasan</p>
                      <p className="text-sm font-medium text-rose-800">{selectedScreening.referralReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedScreening.notes && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Catatan Medis
                  </p>
                  <p className="text-sm text-amber-900 font-medium">{selectedScreening.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="w-full h-12 rounded-xl font-bold">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        itemName={deleteTargetLabel}
        description={deleteTargetLabel ? `Hasil pemeriksaan "${deleteTargetLabel}" akan dihapus permanen dan tidak dapat dikembalikan.` : undefined}
        onConfirm={() => { if (deleteTargetId) void handleDeleteScreening(deleteTargetId); }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
