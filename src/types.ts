export type SchoolType = 'SD' | 'SMP' | 'SMA';

export interface School {
  id: string;
  name: string;
  address: string;
  coordinatorName: string;
  phone: string;
  type: SchoolType;
}

export interface Student {
  id: string;
  schoolId: string;
  name: string;
  gender: 'L' | 'P';
  birthDate: string;
  age: number;
  class: string;
  nik: string;
  parentName: string;
  whatsapp: string;
  address: {
    rt: string;
    rw: string;
    desa: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
  };
  studentIdNumber?: string;
}

export interface Screening {
  id: string;
  studentId: string;
  schoolId: string;
  academicYear: string;
  date: string;
  entryDate: string;
  studentClass?: string;
  studentGender?: 'L' | 'P';
  
  // Status Gizi
  height: number;
  weight: number;
  bmi: number;
  physicalActivity?: string; // Aktivitas fisik
  
  // Indera
  visionLeft?: string;
  visionRight?: string;
  hearingLeft?: string;
  hearingRight?: string;
  
  // Gigi & Mulut
  dentalCaries?: string;
  dentalMouthHealth?: string;
  
  // Fisik & Penyakit
  bloodPressure?: string;
  bloodSugar?: string;
  tbcScreening?: string;
  hepatitisB?: string;
  hepatitisC?: string; // Khusus SMA
  
  // Kesehatan Jiwa
  mentalHealthStatus?: string;
  
  // Khusus & Reproduksi
  reproductiveHealth?: string;
  smokingStatus?: string;
  immunizationHistory?: string; // Khusus Kelas 1 SD
  anemiaStatus?: string; // Khusus Remaja Putri
  hbLevel?: number; // Kadar HB Darah
  hbInterpretation?: string; // Interpretasi HB
  
  notes?: string;
  createdBy: string;

  // Rujukan
  needsReferral?: boolean;
  referralDestination?: string;
  referralReason?: string;
  referralStatus?: 'pending' | 'completed' | 'cancelled';
}

export interface TTDCompliance {
  id: string;
  studentId: string;
  schoolId: string;
  academicYear: string;
  date: string;
  tabletsReceived: number;
  tabletsConsumed: number;
  isCompliant: boolean; // Compliant if consumed >= received or based on weekly target
  notes?: string;
  createdBy: string;
}

export interface Report {
  id: string;
  schoolId: string;
  schoolName: string;
  academicYear: string;
  month: number;
  year: number;
  entryDate: string;
  totalStudents: number;
  status: 'submitted' | 'approved';
  createdBy: string;
}

export type UserRole = 'admin' | 'koordinator';

// NOTE: password is plain-text MOCK for frontend-only prototype. TODO: replace with Supabase Auth.
export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  isActive: boolean;
}
