import { useState } from 'react';
import { FileText, Download, Filter, CheckCircle2, Clock, Calendar as CalendarIcon, ArrowUpDown } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { Report } from '@/types';
import { LogoTrenggalekSVG, LogoPuskesmasBaruharjoSVG, LogoUKSSVG } from '@/components/LogosSVG';

const mockReports: Report[] = [
  { id: '1', schoolId: '1', schoolName: 'SDN 01 Kota', month: 3, year: 2024, academicYear: '2024/2025', entryDate: '2024-03-12T00:00:00Z', status: 'approved', totalStudents: 150, createdBy: 'admin' },
  { id: '2', schoolId: '2', schoolName: 'SMPN 01 Kota', month: 3, year: 2024, academicYear: '2024/2025', entryDate: '2024-03-14T00:00:00Z', status: 'submitted', totalStudents: 200, createdBy: 'admin' },
  { id: '3', schoolId: '3', schoolName: 'SMAN 01 Kota', month: 2, year: 2024, academicYear: '2023/2024', entryDate: '2024-02-10T00:00:00Z', status: 'approved', totalStudents: 180, createdBy: 'admin' },
];

const monthNames = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface ReportsProps {
  academicYear: string;
}

export function Reports({ academicYear: currentAcademicYear }: ReportsProps) {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [reportToVerify, setReportToVerify] = useState<Report | null>(null);
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<Report | null>(null);

  const filteredReports = reports.filter((report) => {
    const matchesMonth = selectedMonth === 'all' || report.month.toString() === selectedMonth;
    const matchesStatus = selectedStatus === 'all' || report.status === selectedStatus;
    const matchesAcademicYear = report.academicYear === currentAcademicYear;
    return matchesMonth && matchesStatus && matchesAcademicYear;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const dateA = new Date(a.entryDate).getTime();
    const dateB = new Date(b.entryDate).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const handleVerifyClick = (report: Report) => {
    setReportToVerify(report);
    setVerifyDialogOpen(true);
  };

  const handleDetailClick = (report: Report) => {
    setSelectedReportForDetail(report);
    setDetailDialogOpen(true);
  };

  const confirmVerification = () => {
    if (reportToVerify) {
      setReports(reports.map(r => 
        r.id === reportToVerify.id ? { ...r, status: 'approved' } : r
      ));
      toast.success("Laporan berhasil disetujui");
      setVerifyDialogOpen(false);
      setReportToVerify(null);
    }
  };

  const handleExport = () => {
    if (sortedReports.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const dataToExport = sortedReports.map(report => ({
      'Sekolah': report.schoolName,
      'Bulan': monthNames[report.month],
      'Tahun': report.year,
      'Tahun Ajaran': report.academicYear,
      'Tanggal Entri': new Date(report.entryDate).toLocaleDateString('id-ID'),
      'Status': report.status === 'approved' ? 'Disetujui' : 'Menunggu Verifikasi',
      'Total Siswa': report.totalStudents,
      'Dibuat Oleh': report.createdBy
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan UKS");
    
    // Export as CSV
    XLSX.writeFile(wb, `Laporan_UKS_${currentAcademicYear.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
    
    toast.success("Laporan berhasil diekspor ke CSV");
  };

  // Data for Charts
  const reportsByMonthData = monthNames.slice(1).map((name, index) => {
    const monthIndex = index + 1;
    const count = reports.filter(r => r.month === monthIndex && r.academicYear === currentAcademicYear).length;
    const students = reports
      .filter(r => r.month === monthIndex && r.academicYear === currentAcademicYear)
      .reduce((sum, r) => sum + r.totalStudents, 0);
    
    return {
      name,
      jumlah: count,
      siswa: students
    };
  }).filter(d => d.jumlah > 0);

  const statusData = [
    { name: 'Disetujui', value: reports.filter(r => r.status === 'approved' && r.academicYear === currentAcademicYear).length, color: '#10b981' },
    { name: 'Menunggu', value: reports.filter(r => r.status === 'submitted' && r.academicYear === currentAcademicYear).length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Laporan UKS</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Kelola dan verifikasi laporan bulanan dari sekolah.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-5 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
            <Download className="w-5 h-5" /> Rekap Tahunan
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white shadow-sm">
            <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Pilih Bulan" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Bulan</SelectItem>
            {monthNames.map((name, index) => index > 0 && (
              <SelectItem key={index} value={index.toString()}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white shadow-sm">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="submitted">Menunggu Verifikasi</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v: 'asc' | 'desc') => setSortOrder(v)}>
          <SelectTrigger className="w-48 h-11 rounded-xl border-slate-200 bg-white shadow-sm">
            <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Urutkan" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="desc">Terbaru</SelectItem>
            <SelectItem value="asc">Terlama</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Visualisasi Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Tren Laporan Bulanan</CardTitle>
            <CardDescription>Jumlah laporan dan siswa yang diperiksa per bulan</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportsByMonthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="jumlah" name="Jumlah Laporan" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="siswa" name="Siswa Diperiksa" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Status Verifikasi</CardTitle>
            <CardDescription>Distribusi status laporan saat ini</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedReports.length > 0 ? (
          sortedReports.map((report) => (
            <Card key={report.id} className="border-none shadow-sm hover:shadow-md transition-all duration-200 bg-white/50 backdrop-blur-sm group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Laporan {monthNames[report.month]} {report.year}
                </CardTitle>
                {report.status === 'approved' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xl font-extrabold text-slate-800 group-hover:text-primary transition-colors">{report.schoolName}</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                  <Clock className="w-3 h-3" />
                  Entri: {new Date(report.entryDate).toLocaleDateString('id-ID')}
                </div>
                <div className="flex items-center justify-between mt-6">
                  <div className="text-xs font-bold text-muted-foreground">
                    <span className="text-primary">{report.totalStudents}</span> Siswa diperiksa
                  </div>
                  <Badge variant={report.status === 'approved' ? 'secondary' : 'outline'} className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {report.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 rounded-xl border-slate-200 hover:bg-primary/5 hover:text-primary transition-all"
                    onClick={() => handleDetailClick(report)}
                  >
                    <FileText className="w-3 h-3" /> Detail
                  </Button>
                  <Button 
                    size="sm" 
                    className="rounded-xl shadow-md shadow-primary/10"
                    onClick={() => handleVerifyClick(report)}
                    disabled={report.status === 'approved'}
                  >
                    {report.status === 'approved' ? 'Telah Diverifikasi' : 'Verifikasi'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white/30 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-muted-foreground font-medium">Tidak ada laporan yang ditemukan untuk filter ini.</p>
          </div>
        )}
      </div>

      {/* Verification Confirmation Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Konfirmasi Verifikasi</DialogTitle>
            <DialogDescription className="font-medium">
              Are you sure you want to approve this report?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {reportToVerify && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700">{reportToVerify.schoolName}</p>
                <p className="text-xs text-muted-foreground mt-1">Laporan Bulan {monthNames[reportToVerify.month]} {reportToVerify.year}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)} className="rounded-xl font-bold">Batal</Button>
            <Button onClick={confirmVerification} className="rounded-xl shadow-lg shadow-primary/20 font-bold">Ya, Setujui</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-primary">Detail Laporan UKS</DialogTitle>
                <DialogDescription className="font-medium">
                  Informasi lengkap mengenai laporan pemeriksaan kesehatan sekolah.
                </DialogDescription>
              </div>
              {selectedReportForDetail?.status === 'approved' && (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 rounded-full px-4 py-1">
                  Disetujui
                </Badge>
              )}
            </div>
          </DialogHeader>
          
          {selectedReportForDetail && (
            <div className="grid gap-6 py-2">
              {/* Kop Surat Header */}
              <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-2xl border border-teal-100/80 mb-2">
                <LogoTrenggalekSVG className="h-12 w-12" />
                <div className="text-center flex-1 px-2">
                  <p className="text-[10px] font-black uppercase text-teal-800 tracking-wider">Pemerintah Kabupaten Trenggalek</p>
                  <p className="text-sm font-black text-slate-800 uppercase">Dinas Kesehatan - Puskesmas Baruharjo</p>
                  <p className="text-[10px] font-bold text-slate-500">Tim Pembina Usaha Kesehatan Sekolah (UKS)</p>
                </div>
                <div className="flex gap-2 items-center">
                  <LogoPuskesmasBaruharjoSVG className="h-10 w-10" />
                  <LogoUKSSVG className="h-10 w-10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Sekolah</p>
                  <p className="text-lg font-extrabold text-slate-800">{selectedReportForDetail.schoolName}</p>
                </div>
                <div className="space-y-1 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Periode Laporan</p>
                  <p className="text-lg font-extrabold text-slate-800">{monthNames[selectedReportForDetail.month]} {selectedReportForDetail.year}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Total Siswa</p>
                  <p className="text-2xl font-black text-primary">{selectedReportForDetail.totalStudents}</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tahun Ajaran</p>
                  <p className="text-lg font-extrabold text-slate-800">{selectedReportForDetail.academicYear}</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal Entri</p>
                  <p className="text-lg font-extrabold text-slate-800">{new Date(selectedReportForDetail.entryDate).toLocaleDateString('id-ID')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 px-1">Ringkasan Data (Simulasi)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-sm text-slate-600">Siswa Laki-laki</span>
                    <span className="text-sm font-bold text-slate-800">{Math.floor(selectedReportForDetail.totalStudents * 0.45)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-sm text-slate-600">Siswa Perempuan</span>
                    <span className="text-sm font-bold text-slate-800">{Math.ceil(selectedReportForDetail.totalStudents * 0.55)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-sm text-slate-600">Status Gizi Normal</span>
                    <span className="text-sm font-bold text-emerald-600">{Math.floor(selectedReportForDetail.totalStudents * 0.82)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-sm text-slate-600">Perlu Perhatian</span>
                    <span className="text-sm font-bold text-amber-600">{Math.ceil(selectedReportForDetail.totalStudents * 0.18)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button onClick={() => setDetailDialogOpen(false)} className="rounded-xl font-bold w-full sm:w-auto">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
