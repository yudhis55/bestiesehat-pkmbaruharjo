import { School, Student, Screening, TTDCompliance } from '../types';

// Initial data keys for localStorage
const SCHOOLS_KEY = 'uks_schools';
const STUDENTS_KEY = 'uks_students';
const SCREENINGS_KEY = 'uks_screenings';
const TTD_KEY = 'uks_ttd_compliance';

const initialSchools: School[] = [
  { id: '1', name: 'SDN 01 Kota', address: 'Jl. Merdeka No. 1', coordinatorName: 'Budi Santoso', phone: '08123456789', type: 'SD' },
  { id: '2', name: 'SMPN 01 Kota', address: 'Jl. Pemuda No. 10', coordinatorName: 'Siti Aminah', phone: '08129876543', type: 'SMP' },
  { id: '3', name: 'SMAN 01 Kota', address: 'Jl. Pendidikan No. 5', coordinatorName: 'Agus Salim', phone: '08121122334', type: 'SMA' },
];

const initialStudents: Student[] = [
  { 
    id: '1', 
    schoolId: '1', 
    name: 'Andi Pratama', 
    gender: 'L', 
    birthDate: '2015-05-12', 
    age: 11,
    class: '5', 
    nik: '3201011205150001',
    parentName: 'Budi Pratama',
    whatsapp: '081234567890',
    address: { rt: '01', rw: '02', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' },
    studentIdNumber: '12345678' 
  },
  { 
    id: '2', 
    schoolId: '1', 
    name: 'Bunga Citra', 
    gender: 'P', 
    birthDate: '2015-08-20', 
    age: 10,
    class: '4', 
    nik: '3201016008150002',
    parentName: 'Citra Lestari',
    whatsapp: '081234567891',
    address: { rt: '03', rw: '02', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' },
    studentIdNumber: '12345679' 
  },
  { 
    id: '3', 
    schoolId: '2', 
    name: 'Candra Wijaya', 
    gender: 'L', 
    birthDate: '2010-02-15', 
    age: 14,
    class: '8', 
    nik: '3201011502100003',
    parentName: 'Wijaya Kusuma',
    whatsapp: '081234567892',
    address: { rt: '01', rw: '01', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' },
    studentIdNumber: '22345678' 
  },
  { 
    id: '4', 
    schoolId: '2', 
    name: 'Dewi Sartika', 
    gender: 'P', 
    birthDate: '2011-01-20', 
    age: 13, 
    class: '7', 
    nik: '3201014501100004', 
    parentName: 'Sartika', 
    whatsapp: '081234567893', 
    address: { rt: '01', rw: '01', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' }, 
    studentIdNumber: '22345679' 
  },
  { 
    id: '5', 
    schoolId: '3', 
    name: 'Eko Prasetyo', 
    gender: 'L', 
    birthDate: '2008-04-10', 
    age: 16, 
    class: '11', 
    nik: '3201011004070005', 
    parentName: 'Prasetyo', 
    whatsapp: '081234567894', 
    address: { rt: '01', rw: '01', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' }, 
    studentIdNumber: '32345678' 
  },
  { 
    id: '6', 
    schoolId: '3', 
    name: 'Fitriani', 
    gender: 'P', 
    birthDate: '2009-03-12', 
    age: 15, 
    class: '10', 
    nik: '3201015203080006', 
    parentName: 'Fitri', 
    whatsapp: '081234567895', 
    address: { rt: '01', rw: '01', desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor', provinsi: 'Jawa Barat' }, 
    studentIdNumber: '32345679' 
  }
];

const initialScreenings: Screening[] = [
  { 
    id: '1', 
    studentId: '1', 
    schoolId: '1', 
    academicYear: '2024/2025',
    date: '2024-03-15T10:00:00Z', 
    entryDate: '2024-03-15T10:00:00Z',
    height: 140, 
    weight: 35, 
    bmi: 17.8, 
    visionLeft: 'Normal', 
    visionRight: 'Normal', 
    hearingLeft: 'Normal',
    hearingRight: 'Normal',
    dentalCaries: 'Tidak Ada',
    dentalMouthHealth: 'Sehat',
    bloodPressure: '110/70',
    bloodSugar: '90',
    tbcScreening: 'Negatif',
    hepatitisB: 'Negatif',
    mentalHealthStatus: 'Stabil',
    smokingStatus: 'Tidak Merokok',
    physicalActivity: 'Aktif',
    createdBy: 'admin'
  },
];

const initialCompliance: TTDCompliance[] = [
  {
    id: '1',
    studentId: '4',
    schoolId: '2',
    academicYear: '2024/2025',
    date: '2024-03-01',
    tabletsReceived: 4,
    tabletsConsumed: 4,
    isCompliant: true,
    createdBy: 'admin'
  },
  {
    id: '2',
    studentId: '6',
    schoolId: '3',
    academicYear: '2024/2025',
    date: '2024-03-01',
    tabletsReceived: 4,
    tabletsConsumed: 2,
    isCompliant: false,
    createdBy: 'admin'
  }
];

export const getSchools = (): School[] => {
  const data = localStorage.getItem(SCHOOLS_KEY);
  if (!data) {
    localStorage.setItem(SCHOOLS_KEY, JSON.stringify(initialSchools));
    return initialSchools;
  }
  return JSON.parse(data);
};

export const saveSchools = (schools: School[]) => {
  localStorage.setItem(SCHOOLS_KEY, JSON.stringify(schools));
};

export const getStudents = (): Student[] => {
  const data = localStorage.getItem(STUDENTS_KEY);
  if (!data) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(initialStudents));
    return initialStudents;
  }
  return JSON.parse(data);
};

export const saveStudents = (students: Student[]) => {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
};

export const getScreenings = (): Screening[] => {
  const data = localStorage.getItem(SCREENINGS_KEY);
  if (!data) {
    localStorage.setItem(SCREENINGS_KEY, JSON.stringify(initialScreenings));
    return initialScreenings;
  }
  return JSON.parse(data);
};

export const saveScreenings = (screenings: Screening[]) => {
  localStorage.setItem(SCREENINGS_KEY, JSON.stringify(screenings));
};

export const getTTDCompliance = (): TTDCompliance[] => {
  const data = localStorage.getItem(TTD_KEY);
  if (!data) {
    localStorage.setItem(TTD_KEY, JSON.stringify(initialCompliance));
    return initialCompliance;
  }
  return JSON.parse(data);
};

export const saveTTDCompliance = (records: TTDCompliance[]) => {
  localStorage.setItem(TTD_KEY, JSON.stringify(records));
};
