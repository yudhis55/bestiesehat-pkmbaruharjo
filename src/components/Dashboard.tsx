import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  School as SchoolIcon,
  ClipboardCheck,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { User, School, Student, Screening, SchoolType } from '@/types';

interface DashboardProps {
  academicYear: string;
  currentUser?: User;
}

interface SchoolRow {
  id: string;
  name: string;
  address: string;
  coordinator_name: string;
  phone: string;
  type: SchoolType;
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
  blood_pressure: string | null;
  blood_sugar: string | null;
  tbc_screening: string | null;
  hepatitis_b: string | null;
  hepatitis_c: string | null;
  mental_health_status: string | null;
  reproductive_health: string | null;
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

// Satu-satunya titik pemetaan snake_case (schools/students/screenings) ->
// camelCase (School/Student/Screening), mirror Schools.tsx & Students.tsx.
// Dashboard hanya membaca (agregasi client-side), jadi tidak ada mapper insert.
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

function screeningRowToScreening(row: ScreeningRow): Screening {
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
    bloodPressure: row.blood_pressure ?? undefined,
    bloodSugar: row.blood_sugar ?? undefined,
    tbcScreening: row.tbc_screening ?? undefined,
    hepatitisB: row.hepatitis_b ?? undefined,
    hepatitisC: row.hepatitis_c ?? undefined,
    mentalHealthStatus: row.mental_health_status ?? undefined,
    reproductiveHealth: row.reproductive_health ?? undefined,
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

export function Dashboard({ academicYear, currentUser }: DashboardProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setLoadError(null);
    const [schoolRes, studentRes, screeningRes] = await Promise.all([
      supabase.from('schools').select('id, name, address, coordinator_name, phone, type').order('name', { ascending: true }),
      supabase.from('students').select('id, school_id, name, gender, birth_date, class, nik, parent_name, whatsapp, address, student_id_number').order('name', { ascending: true }),
      supabase.from('screenings').select('*'),
    ]);
    if (schoolRes.error || studentRes.error || screeningRes.error || !schoolRes.data || !studentRes.data || !screeningRes.data) {
      toast.error('Gagal memuat data dashboard. Periksa koneksi dan coba lagi.');
      setSchools([]);
      setStudents([]);
      setScreenings([]);
      setLoadError('Gagal memuat data dashboard.');
    } else {
      setSchools((schoolRes.data as SchoolRow[]).map(schoolRowToSchool));
      setStudents((studentRes.data as StudentRow[]).map(studentRowToStudent));
      setScreenings((screeningRes.data as ScreeningRow[]).map(screeningRowToScreening));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadDashboardData();
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isKoordinator = currentUser?.role === 'koordinator';
  const scopedSchoolId = isKoordinator ? currentUser?.schoolId : undefined;
  const [adminSchoolId, setAdminSchoolId] = useState('all');
  const effectiveSchoolId = scopedSchoolId ?? (adminSchoolId !== 'all' ? adminSchoolId : undefined);

  const yearScreenings = useMemo(
    () => screenings.filter((s) => !s.academicYear || s.academicYear === academicYear),
    [screenings, academicYear]
  );

  const visibleSchools = useMemo(
    () => (effectiveSchoolId ? schools.filter((sch) => sch.id === effectiveSchoolId) : schools),
    [schools, effectiveSchoolId]
  );
  const visibleStudents = useMemo(
    () => (effectiveSchoolId ? students.filter((st) => st.schoolId === effectiveSchoolId) : students),
    [students, effectiveSchoolId]
  );
  const visibleScreenings = useMemo(
    () =>
      effectiveSchoolId
        ? yearScreenings.filter((s) => {
            if (s.schoolId) return s.schoolId === effectiveSchoolId;
            const student = students.find((st) => st.id === s.studentId);
            return student?.schoolId === effectiveSchoolId;
          })
        : yearScreenings,
    [yearScreenings, students, effectiveSchoolId]
  );

  const stats = useMemo(() => {
    // Unique students screened
    const uniqueScreened = new Set(visibleScreenings.map(s => s.studentId)).size;

    // Students requiring referral/attention
    const attentionCount = visibleScreenings.filter(s => s.needsReferral).length;

    const pendingStat = { label: 'Belum Diperiksa', value: Math.max(visibleStudents.length - uniqueScreened, 0), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' };

    return isKoordinator
      ? [
        { label: 'Total Siswa', value: visibleStudents.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Siswa Diperiksa', value: uniqueScreened, icon: ClipboardCheck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
        pendingStat,
        { label: 'Perlu Perhatian', value: attentionCount, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
      ]
      : [
        { label: 'Total Sekolah', value: visibleSchools.length, icon: SchoolIcon, color: 'text-teal-600', bg: 'bg-teal-50' },
        { label: 'Total Siswa', value: visibleStudents.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Siswa Diperiksa', value: uniqueScreened, icon: ClipboardCheck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
        { label: 'Perlu Perhatian', value: attentionCount, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
      ];
  }, [visibleSchools, visibleStudents, visibleScreenings, isKoordinator]);

  const screeningBySchool = useMemo(() => {
    return visibleSchools.map(sch => {
      const totalSiswaSkh = visibleStudents.filter(st => st.schoolId === sch.id).length;
      const screenedSiswaSkh = visibleScreenings.filter(s => {
        if (s.schoolId) return s.schoolId === sch.id;
        const student = visibleStudents.find(st => st.id === s.studentId);
        return student?.schoolId === sch.id;
      }).length;

      return {
        name: (sch.name.match(/^(SDN|SMPN|SMAN)\s+\d+/i)?.[0] ?? sch.name).substring(0, 12),
        screened: screenedSiswaSkh,
        total: totalSiswaSkh || 10
      };
    });
  }, [visibleSchools, visibleStudents, visibleScreenings]);

  const screeningByClass = useMemo(() => {
    const screenedIds = new Set(visibleScreenings.map(s => s.studentId));
    const classes: string[] = Array.from(new Set<string>(visibleStudents.map(st => st.class))).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );
    return classes.map(cls => {
      const inClass = visibleStudents.filter(st => st.class === cls);
      return {
        name: `Kelas ${cls}`.substring(0, 12),
        screened: inClass.filter(st => screenedIds.has(st.id)).length,
        total: inClass.length || 10,
      };
    });
  }, [visibleStudents, visibleScreenings]);

  const barData = isKoordinator ? screeningByClass : screeningBySchool;

  const bmiDistribution = useMemo(() => {
    let normal = 0;
    let kurus = 0;
    let gemuk = 0;
    let obesitas = 0;

    visibleScreenings.forEach(s => {
      const b = s.bmi;
      if (b) {
        if (b < 18.5) kurus++;
        else if (b >= 18.5 && b < 25) normal++;
        else if (b >= 25 && b < 30) gemuk++;
        else obesitas++;
      }
    });

    return [
      { name: 'Normal', value: normal, color: 'oklch(0.6 0.18 160)' },
      { name: 'Kurus', value: kurus, color: 'oklch(0.7 0.15 190)' },
      { name: 'Gemuk', value: gemuk, color: 'oklch(0.8 0.12 220)' },
      { name: 'Obesitas', value: obesitas, color: 'oklch(0.6 0.2 25)' },
    ];
  }, [visibleScreenings]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Dashboard</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {academicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">{isKoordinator && visibleSchools[0] ? `Ringkasan data kesehatan ${visibleSchools[0].name}.` : effectiveSchoolId && visibleSchools[0] ? `Ringkasan data kesehatan ${visibleSchools[0].name}.` : 'Ringkasan data kesehatan sekolah wilayah kerja Puskesmas.'}</p>
        </div>
        {!isKoordinator && (
          <Select value={adminSchoolId} onValueChange={setAdminSchoolId}>
            <SelectTrigger className="w-56 h-11 rounded-xl border-slate-200 bg-white/50 font-bold text-slate-600">
              <SelectValue placeholder="Semua Sekolah">{adminSchoolId === 'all' ? undefined : (schools.find((s) => s.id === adminSchoolId)?.name ?? 'Sekolah tidak tersedia')}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Sekolah</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Memuat data dashboard">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 rounded-md bg-slate-200 animate-pulse" />
                  <div className="p-2.5 rounded-2xl bg-slate-100 animate-pulse">
                    <div className="w-5 h-5 rounded-md bg-slate-200" />
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="h-8 w-16 rounded-md bg-slate-200 animate-pulse" />
                  <div className="h-3 w-32 rounded-md bg-slate-100 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loadError ? (
        <Card className="border-destructive/30 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="p-2.5 rounded-2xl bg-rose-50 shadow-inner">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Gagal memuat dashboard</p>
            <p className="text-sm font-medium text-slate-600">{loadError} Data tidak ditampilkan sebagai nol — periksa koneksi lalu coba lagi.</p>
            <Button onClick={() => void loadDashboardData()} className="mt-1">
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : schools.length === 0 && students.length === 0 && screenings.length === 0 ? (
        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-100 shadow-inner">
              <ClipboardCheck className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Belum ada data</p>
            <p className="text-sm font-medium text-slate-600">Belum ada data dashboard untuk tahun ajaran ini. Tambahkan data sekolah, siswa, atau hasil skrining untuk melihat ringkasan.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <div className={cn(stat.bg, "p-2.5 rounded-2xl shadow-inner")}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Aktif</span>
                  <span className="text-[10px] text-muted-foreground font-medium">tahun ajaran ini</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Cakupan Pemeriksaan</CardTitle>
            <CardDescription className="font-medium">{isKoordinator ? 'Jumlah siswa yang sudah diperiksa per kelas.' : 'Jumlah siswa yang sudah diperiksa per sekolah.'}</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.03 160)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'oklch(0.5 0.05 160)', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'oklch(0.5 0.05 160)', fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'oklch(0.95 0.02 160)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="screened" fill="oklch(0.6 0.18 160)" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Status Gizi (BMI)</CardTitle>
            <CardDescription className="font-medium">Berdasarkan hasil pemeriksaan terakhir.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bmiDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {bmiDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {bmiDistribution.map((item) => (
                <div key={item.name} className="flex flex-col p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
