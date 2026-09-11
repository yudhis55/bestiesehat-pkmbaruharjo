import React, { useState, useMemo, useRef } from 'react';
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
  User,
  School as SchoolIcon,
  Trash2
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
import { TTDCompliance, Student, School } from '../types';
import { getStudents, getSchools, getTTDCompliance, saveTTDCompliance } from '@/lib/storage';

interface TTDComplianceProps {
  academicYear: string;
}

type ComplianceRecord = TTDCompliance & { studentName: string, schoolName: string, studentClass: string };

export function TTDComplianceMenu({ academicYear }: TTDComplianceProps) {
  const [records, setRecords] = useState<TTDCompliance[]>(() => getTTDCompliance());
  const [students, setStudents] = useState<Student[]>(() => getStudents());
  const [schools, setSchools] = useState<School[]>(() => getSchools());
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tabletsReceived, setTabletsReceived] = useState('4');
  const [tabletsConsumed, setTabletsConsumed] = useState('4');
  const [notes, setNotes] = useState('');

  const resolvedRecords = useMemo(() => {
    return records.map(r => {
      const student = students.find(st => st.id === r.studentId);
      const school = schools.find(sch => sch.id === (r.schoolId || student?.schoolId));
      return {
        ...r,
        studentName: student ? student.name : 'Unknown Student',
        schoolName: school ? school.name : 'Unknown School',
        studentClass: student ? student.class : '1',
      };
    });
  }, [records, students, schools]);

  const filteredRecords = useMemo(() => {
    return resolvedRecords.filter(record => 
      record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.schoolName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [resolvedRecords, searchTerm]);

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

  const handleSaveRecord = () => {
    if (!studentId || !schoolId) {
      toast.error("Mohon pilih siswa dan sekolah");
      return;
    }

    const received = Number(tabletsReceived);
    const consumed = Number(tabletsConsumed);

    const newRecord: TTDCompliance = {
      id: Math.random().toString(36).substr(2, 9),
      studentId,
      schoolId,
      academicYear,
      date,
      tabletsReceived: received,
      tabletsConsumed: consumed,
      isCompliant: consumed >= received,
      notes,
      createdBy: 'admin'
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    saveTTDCompliance(updated);
    toast.success("Catatan kepatuhan berhasil disimpan");
    setIsOpen(false);
    
    // Reset form
    setStudentId('');
    setSchoolId('');
    setTabletsReceived('4');
    setTabletsConsumed('4');
    setNotes('');
  };

  const handleDeleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    saveTTDCompliance(updated);
    toast.success("Catatan kepatuhan berhasil dihapus");
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

        const newRecords: TTDCompliance[] = [];
        data.forEach(row => {
          const nik = row['NIK Siswa']?.toString();
          const name = row['Nama Siswa']?.toString();
          const student = students.find(s => (nik && s.nik === nik) || (name && s.name.toLowerCase() === name.toLowerCase()));

          if (student) {
            const received = Number(row['Tablet Diterima']) || 0;
            const consumed = Number(row['Tablet Diminum']) || 0;
            newRecords.push({
              id: Math.random().toString(36).substr(2, 9),
              studentId: student.id,
              schoolId: student.schoolId,
              academicYear,
              date: row['Tanggal (YYYY-MM-DD)'] || new Date().toISOString().split('T')[0],
              tabletsReceived: received,
              tabletsConsumed: consumed,
              isCompliant: consumed >= received,
              notes: row['Catatan'] || '',
              createdBy: 'admin'
            });
          }
        });

        if (newRecords.length > 0) {
          setRecords(prev => {
            const updated = [...newRecords, ...prev];
            saveTTDCompliance(updated);
            return updated;
          });
          toast.success(`Berhasil mengimpor ${newRecords.length} data`);
          setIsImportOpen(false);
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
        
        <div className="flex items-center gap-3">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-11 px-6 rounded-xl border-slate-200 hover:bg-slate-50">
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

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
                <Plus className="w-5 h-5" /> Catat Kepatuhan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-primary">Catat Konsumsi TTD</DialogTitle>
                <DialogDescription className="font-medium">Masukkan data konsumsi tablet tambah darah siswa.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-slate-700">Siswa (Remaja Putri)</Label>
                  <Select value={studentId} onValueChange={(id) => {
                    setStudentId(id);
                    const s = students.find(st => st.id === id);
                    if (s) setSchoolId(s.schoolId);
                  }}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue placeholder="Pilih siswa" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {students.filter(s => s.gender === 'P').map(s => (
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
                <Button onClick={handleSaveRecord} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">Simpan Catatan</Button>
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
    </div>
  );
}
