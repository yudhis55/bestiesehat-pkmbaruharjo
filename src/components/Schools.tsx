import { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2 } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { School, SchoolType } from '@/types';
import { toast } from 'sonner';
import { getSchools, saveSchools } from '@/lib/storage';

interface SchoolsProps {
  academicYear: string;
}

export function Schools({ academicYear: currentAcademicYear }: SchoolsProps) {
  const [schools, setSchools] = useState<School[]>(() => getSchools());
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<SchoolType>('SD');
  const [newCoordinator, setNewCoordinator] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveSchool = () => {
    if (!newName || !newCoordinator) {
      toast.error("Mohon isi nama sekolah dan koordinator");
      return;
    }

    const newSchool: School = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      type: newType,
      coordinatorName: newCoordinator,
      address: newAddress,
      phone: newPhone || '-',
    };

    const updated = [...schools, newSchool];
    setSchools(updated);
    saveSchools(updated);
    toast.success("Sekolah berhasil ditambahkan", {
      description: `${newName} telah terdaftar di sistem.`
    });
    
    // Reset form
    setNewName('');
    setNewType('SD');
    setNewCoordinator('');
    setNewAddress('');
    setNewPhone('');
    setIsOpen(false);
  };

  const handleDeleteSchool = (id: string, name: string) => {
    const updated = schools.filter(s => s.id !== id);
    setSchools(updated);
    saveSchools(updated);
    toast.success(`Sekolah ${name} berhasil dihapus`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary">Data Sekolah</h2>
            <Badge variant="outline" className="h-7 px-3 rounded-full border-primary/30 text-primary font-bold bg-primary/5">
              TA {currentAcademicYear}
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium">Kelola daftar sekolah binaan Puskesmas.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
              <Plus className="w-5 h-5" /> Tambah Sekolah
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">Tambah Sekolah Baru</DialogTitle>
              <DialogDescription className="font-medium">Masukkan detail sekolah binaan baru.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="font-bold text-slate-700">Nama Sekolah</Label>
                <Input 
                  id="name" 
                  placeholder="Contoh: SDN 01 Kota" 
                  className="rounded-xl border-slate-200"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type" className="font-bold text-slate-700">Tingkat</Label>
                <Select value={newType} onValueChange={(v: SchoolType) => setNewType(v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Pilih tingkat" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="SD">SD</SelectItem>
                    <SelectItem value="SMP">SMP</SelectItem>
                    <SelectItem value="SMA">SMA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coordinator" className="font-bold text-slate-700">Koordinator UKS</Label>
                <Input 
                  id="coordinator" 
                  placeholder="Nama lengkap" 
                  className="rounded-xl border-slate-200"
                  value={newCoordinator}
                  onChange={(e) => setNewCoordinator(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="font-bold text-slate-700">Nomor Telepon</Label>
                <Input 
                  id="phone" 
                  placeholder="0812..." 
                  className="rounded-xl border-slate-200"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address" className="font-bold text-slate-700">Alamat</Label>
                <Input 
                  id="address" 
                  placeholder="Alamat lengkap" 
                  className="rounded-xl border-slate-200"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveSchool} className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">Simpan Sekolah</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari sekolah..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border-none rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Nama Sekolah</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Tingkat</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Koordinator</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Telepon</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px] py-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSchools.map((school) => (
              <TableRow key={school.id} className="border-slate-100 hover:bg-primary/5 transition-colors">
                <TableCell className="font-bold text-slate-700 py-4">{school.name}</TableCell>
                <TableCell className="py-4">
                  <Badge variant={school.type === 'SD' ? 'secondary' : school.type === 'SMP' ? 'outline' : 'default'} className="rounded-md px-2 py-0.5 text-[10px] font-bold">
                    {school.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600 font-medium py-4">{school.coordinatorName}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs py-4">{school.phone}</TableCell>
                <TableCell className="text-right py-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSchool(school.id, school.name)}
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
  );
}
