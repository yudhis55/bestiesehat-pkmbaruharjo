import React, { useState, useMemo } from 'react';
import { 
  Users, 
  School as SchoolIcon, 
  ClipboardCheck, 
  AlertCircle 
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { getSchools, getStudents, getScreenings } from '@/lib/storage';

interface DashboardProps {
  academicYear: string;
}

export function Dashboard({ academicYear }: DashboardProps) {
  const [schools] = useState(() => getSchools());
  const [students] = useState(() => getStudents());
  const [screenings] = useState(() => getScreenings());

  const stats = useMemo(() => {
    // Unique students screened
    const uniqueScreened = new Set(screenings.map(s => s.studentId)).size;
    
    // Students requiring referral/attention
    const attentionCount = screenings.filter(s => s.needsReferral).length;

    return [
      { label: 'Total Sekolah', value: schools.length, icon: SchoolIcon, color: 'text-teal-600', bg: 'bg-teal-50' },
      { label: 'Total Siswa', value: students.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Siswa Diperiksa', value: uniqueScreened, icon: ClipboardCheck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
      { label: 'Perlu Perhatian', value: attentionCount, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];
  }, [schools, students, screenings]);

  const screeningBySchool = useMemo(() => {
    return schools.map(sch => {
      const totalSiswaSkh = students.filter(st => st.schoolId === sch.id).length;
      const screenedSiswaSkh = screenings.filter(s => {
        if (s.schoolId) return s.schoolId === sch.id;
        const student = students.find(st => st.id === s.studentId);
        return student?.schoolId === sch.id;
      }).length;

      return {
        name: sch.name.replace(/^(SDN|SMPN|SMAN)\s+\d+\s+/, '').substring(0, 10) || sch.name,
        screened: screenedSiswaSkh,
        total: totalSiswaSkh || 10
      };
    });
  }, [schools, students, screenings]);

  const bmiDistribution = useMemo(() => {
    let normal = 0;
    let kurus = 0;
    let gemuk = 0;
    let obesitas = 0;

    screenings.forEach(s => {
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
  }, [screenings]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">Dashboard</h2>
          <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
            TA {academicYear}
          </Badge>
        </div>
        <p className="text-muted-foreground font-medium">Ringkasan data kesehatan sekolah wilayah kerja Puskesmas.</p>
      </div>

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
            <CardDescription className="font-medium">Jumlah siswa yang sudah diperiksa per sekolah.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={screeningBySchool}>
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
    </div>
  );
}
