import React, { useState, useRef, useMemo } from 'react';
import { Plus, Search, Filter, Download, Upload, FileSpreadsheet, AlertCircle, Trash2, Pencil, Calendar, Clock } from 'lucide-react';
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
import { Student } from '@/types';
import { getStudents, saveStudents, getSchools } from '@/lib/storage';
import { calculateAgeDetails, calculateAgeYears } from '@/lib/ageUtils';

interface StudentsProps {
  academicYear: string;
}

export function Students({ academicYear: currentAcademicYear }: StudentsProps) {
  const [students, setStudents] = useState<Student[]>(() => getStudents());
  const [schools, setSchools] = useState(() => getSchools());
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schoolNames = useMemo(() => {
    return schools.reduce((acc, s) => {
      acc[s.id] = s.name;
      return acc;
    }, {} as Record<string, string>);
  }, [schools]);

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
  const currentAgeYears = ageDetail.years;

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.nik?.includes(searchTerm) ||
                          student.studentIdNumber?.includes(searchTerm);
    const matchesSchool = schoolFilter === 'all' || student.schoolId === schoolFilter;
    return matchesSearch && matchesSchool;
  });

  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const schoolId = student.schoolId;
    if (!acc[schoolId]) {
      acc[schoolId] = [];
    }
    acc[schoolId].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  const handleSaveStudent = () => {
    if (!newName || !newSchoolId || !newClass) {
      toast.error("Mohon isi nama, sekolah, dan kelas");
      return;
    }

    const newStudent: Student = {
      id: Math.random().toString(36).substr(2, 9),
      schoolId: newSchoolId,
      name: newName,
      gender: newGender,
      birthDate: newBirthDate,
      age: currentAgeYears,
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

    const updated = [...students, newStudent];
    setStudents(updated);
    saveStudents(updated);
    toast.success("Siswa berhasil ditambahkan", {
      description: `${newName} (${ageDetail.formatted}) telah terdaftar.`
    });

    // Reset form
    resetForm();
    setIsAddOpen(false);
  };

  const handleOpenEdit = (student: Student) => {
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

  const handleUpdateStudent = () => {
    if (!editingStudent) return;
    if (!newName || !newSchoolId || !newClass) {
      toast.error("Mohon isi nama, sekolah, dan kelas");
      return;
    }

    const updatedStudent: Student = {
      ...editingStudent,
      schoolId: newSchoolId,
      name: newName,
      gender: newGender,
      birthDate: newBirthDate,
      age: currentAgeYears,
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

    const updatedList = students.map(s => s.id === editingStudent.id ? updatedStudent : s);
    setStudents(updatedList);
    saveStudents(updatedList);
    toast.success("Data siswa berhasil diperbarui", {
      description: `Umur siswa diperbarui otomatis: ${ageDetail.formatted}`
    });

    resetForm();
    setEditingStudent(null);
    setIsEditOpen(false);
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

  const handleDeleteStudent = (id: string, name: string) => {
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
    saveStudents(updated);
    toast.success(`Siswa ${name} berhasil dihapus`);
  };

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
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
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (data.length === 0) {
          toast.error("File kosong atau format tidak sesuai");
          return;
        }

        const newStudents: Student[] = data.map((row: any) => {
          const birthDate = row['Tanggal Lahir (YYYY-MM-DD)'] || '';
          const age = calculateAgeYears(birthDate);
          
          // Map school name to ID
          let schoolId = '1';
          const schoolName = row['Nama Sekolah']?.toString().toLowerCase() || '';
          if (schoolName.includes('smp')) schoolId = '2';
          else if (schoolName.includes('sma')) schoolId = '3';

          return {
            id: Math.random().toString(36).substr(2, 9),
            schoolId,
            name: row['Nama Siswa'] || 'Unknown',
            gender: row['Jenis Kelamin (L/P)'] || 'L',
            birthDate,
            age,
            class: row['Kelas']?.toString() || '',
            nik: row['NIK']?.toString() || '',
            parentName: row['Nama Orang Tua'] || '',
            whatsapp: row['Nomor WA']?.toString() || '',
            address: {
              rt: row['RT']?.toString() || '',
              rw: row['RW']?.toString() || '',
              desa: row['Desa'] || '',
              kecamatan: row['Kecamatan'] || '',
              kabupaten: row['Kabupaten'] || '',
              provinsi: row['Provinsi'] || '',
            },
            studentIdNumber: row['NISN (Opsional)']?.toString() || '',
          };
        });

        setStudents(prev => {
          const updated = [...prev, ...newStudents];
          saveStudents(updated);
          return updated;
        });
        toast.success(`${newStudents.length} data siswa berhasil diimpor.`, {
          description: `Data telah ditambahkan ke sistem untuk TA ${currentAcademicYear}.`
        });
        setIsImportOpen(false);
      } catch (error) {
        console.error(error);
        toast.error("Gagal membaca file", {
          description: "Pastikan format file Excel (.xlsx atau .csv) sudah benar."
        });
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  const downloadTemplate = () => {
    const template = [
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
          <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 px-6 rounded-xl shadow-lg shadow-primary/20">
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
                        <SelectValue placeholder="Pilih sekolah" />
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
                      placeholder="Nomor NIK" 
                      className="rounded-xl border-slate-200"
                      value={newNIK}
                      onChange={(e) => setNewNIK(e.target.value)}
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
                <Button onClick={handleSaveStudent} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">Simpan Siswa</Button>
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
              <SelectValue placeholder="Filter Sekolah" />
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
                              className="rounded-lg font-bold text-primary hover:bg-primary/10"
                              onClick={() => handleViewDetail(student)}
                            >
                              Detail
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-lg font-bold text-slate-600 hover:bg-slate-100"
                              onClick={() => handleOpenEdit(student)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteStudent(student.id, student.name)}
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
      </div>

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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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
                    <SelectValue placeholder="Pilih sekolah" />
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
                  placeholder="Nomor NIK" 
                  className="rounded-xl border-slate-200"
                  value={newNIK}
                  onChange={(e) => setNewNIK(e.target.value)}
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
    </div>
  );
}

