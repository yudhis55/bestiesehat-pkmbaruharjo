import React, { useState, useMemo, useRef } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Activity, Eye, Heart, Brain, Baby, ShieldAlert, FileText, Upload, Download, FileSpreadsheet, ExternalLink, CheckCircle2, Clock, XCircle, Trash2 } from 'lucide-react';
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
import { Screening, Student, School } from '@/types';
import { toast } from 'sonner';
import { getStudents, getSchools, getScreenings, saveScreenings } from '@/lib/storage';
import { calculateAgeDetails } from '@/lib/ageUtils';

interface ScreeningsProps {
  academicYear: string;
}

export function Screenings({ academicYear: currentAcademicYear }: ScreeningsProps) {
  const [screenings, setScreenings] = useState<Screening[]>(() => getScreenings());
  const [students, setStudents] = useState<Student[]>(() => getStudents());
  const [schools, setSchools] = useState<School[]>(() => getSchools());
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedScreening, setSelectedScreening] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedScreenings = useMemo(() => {
    return screenings.map(s => {
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
    });
  }, [screenings, students, schools]);
  
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
  
  // Fisik & Penyakit
  const [bloodPressure, setBloodPressure] = useState('110/70');
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

  // Reset student when school changes
  const handleSchoolChange = (id: string) => {
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

  const bmi = (h: number, w: number) => {
    if (!h || !w) return 0;
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

  const handleSaveScreening = () => {
    if (!schoolId || !studentId || !height || !weight) {
      toast.error("Mohon lengkapi data pemeriksaan utama (Sekolah, Siswa, TB, BB)");
      return;
    }

    const newScreening: Screening = {
      id: Math.random().toString(36).substr(2, 9),
      studentId,
      schoolId,
      academicYear: currentAcademicYear,
      studentClass,
      studentGender,
      date: new Date(date).toISOString(),
      entryDate: new Date().toISOString(),
      height: Number(height),
      weight: Number(weight),
      bmi: calculatedBmi,
      physicalActivity,
      visionLeft,
      visionRight,
      hearingLeft,
      hearingRight,
      dentalCaries,
      dentalMouthHealth,
      bloodPressure,
      bloodSugar,
      tbcScreening,
      hepatitisB,
      hepatitisC,
      mentalHealthStatus,
      reproductiveHealth,
      smokingStatus,
      immunizationHistory,
      anemiaStatus,
      hbLevel: hbLevel ? Number(hbLevel) : undefined,
      hbInterpretation: hbLevel ? hbInterpretation : undefined,
      notes,
      createdBy: 'admin',
      needsReferral: needsReferral === 'Ya',
      referralDestination: needsReferral === 'Ya' ? referralDestination : undefined,
      referralReason: needsReferral === 'Ya' ? referralReason : undefined,
      referralStatus: needsReferral === 'Ya' ? referralStatus : undefined,
    };

    const updated = [newScreening, ...screenings];
    setScreenings(updated);
    saveScreenings(updated);
    toast.success("Hasil pemeriksaan berhasil disimpan");
    
    // Reset form
    setNotes('');
    setNeedsReferral('Tidak');
    setReferralDestination('Puskesmas');
    setReferralReason('');
    setReferralStatus('pending');
    setIsOpen(false);
  };

  const handleDeleteScreening = (id: string) => {
    const updated = screenings.filter(s => s.id !== id);
    setScreenings(updated);
    saveScreenings(updated);
    toast.success("Hasil pemeriksaan berhasil dihapus");
  };

  const handleViewDetail = (screening: any) => {
    setSelectedScreening(screening);
    setIsDetailOpen(true);
  };

  const filteredScreenings = resolvedScreenings.filter(s => 
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.schoolName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadTemplate = () => {
    const templateData = [
      {
        'NIK Siswa': '3201011205150001',
        'Nama Siswa': 'Andi Pratama',
        'Tanggal (YYYY-MM-DD)': '2024-03-15',
        'Tinggi Badan (cm)': '140',
        'Berat Badan (kg)': '35',
        'Tekanan Darah': '110/70',
        'Gula Darah': '90',
        'Kadar HB': '12.5',
        'Visi Kiri': 'Normal',
        'Visi Kanan': 'Normal',
        'Pendengaran Kiri': 'Normal',
        'Pendengaran Kanan': 'Normal',
        'Karies Gigi': 'Tidak Ada',
        'Kesehatan Mulut': 'Sehat',
        'Skrining TBC': 'Negatif',
        'Hepatitis B': 'Negatif',
        'Hepatitis C': 'Negatif',
        'Kesehatan Mental': 'Stabil',
        'Kesehatan Reproduksi': 'Sehat',
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
    reader.onload = (evt) => {
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
        let successCount = 0;
        let errorCount = 0;

        data.forEach((row, index) => {
          // Find student by NIK or Name
          const nik = row['NIK Siswa']?.toString();
          const name = row['Nama Siswa']?.toString();
          const student = students.find(s => (nik && s.nik === nik) || (name && s.name.toLowerCase() === name.toLowerCase()));

          if (!student) {
            console.error(`Baris ${index + 1}: Siswa tidak ditemukan (${name || nik})`);
            errorCount++;
            return;
          }

          const h = Number(row['Tinggi Badan (cm)']);
          const w = Number(row['Berat Badan (kg)']);
          const hb = Number(row['Kadar HB']);
          
          const calculatedBmiValue = bmi(h, w);
          const hbInterp = getHbInterpretation(hb);

          const record = {
            id: Math.random().toString(36).substr(2, 9),
            studentId: student.id,
            schoolId: student.schoolId,
            academicYear: currentAcademicYear,
            studentName: student.name,
            schoolName: student.schoolId === '1' ? 'SDN 01 Kota' : student.schoolId === '2' ? 'SMPN 01 Kota' : 'SMAN 01 Kota',
            schoolType: (student.schoolId === '1' ? 'SD' : student.schoolId === '2' ? 'SMP' : 'SMA') as 'SD' | 'SMP' | 'SMA',
            studentClass: student.class,
            studentGender: student.gender,
            date: row['Tanggal (YYYY-MM-DD)'] ? new Date(row['Tanggal (YYYY-MM-DD)']).toISOString() : new Date().toISOString(),
            entryDate: new Date().toISOString(),
            height: h || 0,
            weight: w || 0,
            bmi: calculatedBmiValue,
            physicalActivity: row['Aktivitas Fisik'] || 'Aktif',
            visionLeft: row['Visi Kiri'] || 'Normal',
            visionRight: row['Visi Kanan'] || 'Normal',
            hearingLeft: row['Pendengaran Kiri'] || 'Normal',
            hearingRight: row['Pendengaran Kanan'] || 'Normal',
            dentalCaries: row['Karies Gigi'] || 'Tidak Ada',
            dentalMouthHealth: row['Kesehatan Mulut'] || 'Sehat',
            bloodPressure: row['Tekanan Darah'] || '110/70',
            bloodSugar: row['Gula Darah'] || '90',
            tbcScreening: row['Skrining TBC'] || 'Negatif',
            hepatitisB: row['Hepatitis B'] || 'Negatif',
            hepatitisC: row['Hepatitis C'] || 'Negatif',
            mentalHealthStatus: row['Kesehatan Mental'] || 'Stabil',
            reproductiveHealth: row['Kesehatan Reproduksi'] || 'Sehat',
            smokingStatus: row['Merokok'] || 'Tidak Merokok',
            immunizationHistory: row['Riwayat Imunisasi'] || 'Lengkap',
            anemiaStatus: hbInterp === 'Normal' ? 'Normal' : 'Anemia',
            hbLevel: hb || undefined,
            hbInterpretation: hb ? hbInterp : undefined,
            notes: row['Catatan'] || '',
            createdBy: 'admin',
            needsReferral: row['Perlu Rujukan (Ya/Tidak)'] === 'Ya',
            referralDestination: row['Tujuan Rujukan'] || undefined,
            referralReason: row['Alasan Rujukan'] || undefined,
            referralStatus: row['Perlu Rujukan (Ya/Tidak)'] === 'Ya' ? 'pending' : undefined,
          };

          newRecords.push(record);
          successCount++;
        });

        if (newRecords.length > 0) {
          setScreenings(prev => {
            const updated = [...newRecords, ...prev];
            saveScreenings(updated);
            return updated;
          });
          toast.success(`Berhasil mengimpor ${successCount} data. ${errorCount > 0 ? `${errorCount} data gagal.` : ''}`);
          setIsImportOpen(false);
        } else {
          toast.error("Tidak ada data valid yang dapat diimpor");
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal memproses file. Pastikan format sesuai.");
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
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Pemeriksaan Kesehatan</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Catat dan pantau hasil pemeriksaan berkala siswa.</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-6 rounded-xl border-primary/20 hover:bg-primary/5 text-primary">
                <Upload className="w-5 h-5" /> Import Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
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

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
                <Plus className="w-5 h-5" /> Catat Pemeriksaan
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">Catat Hasil Pemeriksaan</DialogTitle>
              <DialogDescription className="font-medium">Masukkan data kesehatan hasil pemeriksaan siswa untuk Tahun Ajaran {currentAcademicYear}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-8 py-4">
              {/* Identitas Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Identitas & Waktu
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Sekolah</Label>
                    <Select value={schoolId} onValueChange={handleSchoolChange}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih sekolah" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {schools.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Siswa</Label>
                    <Select value={studentId} onValueChange={handleStudentChange}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Pilih siswa" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {students.filter(s => schoolId === '' || s.schoolId === schoolId).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} (Kelas {s.class})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        <span><strong>Tgl Lahir:</strong> {selStudent.birthDate ? new Date(selStudent.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Belum diisi'}</span>
                      </div>
                      <span className="font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                        Usia: {ageInfo ? ageInfo.formatted : `${selStudent.age || 0} Tahun`}
                      </span>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Tajam Penglihatan (Mata)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Kiri" value={visionLeft} onChange={(e) => setVisionLeft(e.target.value)} className="rounded-xl" />
                      <Input placeholder="Kanan" value={visionRight} onChange={(e) => setVisionRight(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Tajam Pendengaran (Telinga)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Kiri" value={hearingLeft} onChange={(e) => setHearingLeft(e.target.value)} className="rounded-xl" />
                      <Input placeholder="Kanan" value={hearingRight} onChange={(e) => setHearingRight(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
              </div>

              {/* Fisik & Penyakit Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" /> Fisik & Penyakit
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-bold text-slate-700">Tekanan Darah</Label>
                    <Input placeholder="120/80" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)} className="rounded-xl" />
                  </div>
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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

                  {/* Immunization: SD Class 1 */}
                  {schoolType === 'SD' && studentClass === '1' && (
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
                  )}

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
                </div>
              </div>

              {/* Rujukan Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-1 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" /> Rujukan (Jika Diperlukan)
                </h3>
                <div className="grid grid-cols-2 gap-4">
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
              <Button onClick={handleSaveScreening} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">Simpan Hasil Pemeriksaan</Button>
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
        <Table>
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
            {filteredScreenings.map((screening) => (
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
                <TableCell className="text-slate-500 font-mono text-xs py-4">{screening.height}/{screening.weight}</TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2 font-bold text-primary">
                    <Activity className="w-4 h-4" />
                    {screening.bmi}
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant={screening.bmi > 25 ? 'destructive' : screening.bmi < 18.5 ? 'outline' : 'secondary'} className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {screening.bmi > 25 ? 'Overweight' : screening.bmi < 18.5 ? 'Underweight' : 'Normal'}
                  </Badge>
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
                      className="rounded-lg font-bold text-primary hover:bg-primary/10"
                      onClick={() => handleViewDetail(screening)}
                    >
                      Detail
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteScreening(screening.id)}
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

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
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
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedScreening.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Status Gizi & Fisik
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Tinggi/Berat</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.height}cm / {selectedScreening.weight}kg</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">BMI</p>
                      <p className="text-sm font-bold text-primary">{selectedScreening.bmi}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Tekanan Darah</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.bloodPressure || '-'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Gula Darah</p>
                      <p className="text-sm font-bold text-slate-800">{selectedScreening.bloodSugar || '-'} mg/dL</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kadar HB Darah</p>
                      <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Skrining Penyakit & Jiwa
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}
