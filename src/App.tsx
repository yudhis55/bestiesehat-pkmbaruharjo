/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Schools } from '@/components/Schools';
import { Students } from '@/components/Students';
import { Screenings } from '@/components/Screenings';
import { TTDComplianceMenu } from '@/components/TTDCompliance';
import { Reports } from '@/components/Reports';
import { Auth } from '@/components/Auth';
import { Toaster } from '@/components/ui/sonner';
import { HeaderLogosBanner } from '@/components/HeaderLogos';
import { Book, Pencil, GraduationCap, Backpack, Ruler } from 'lucide-react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [academicYear, setAcademicYear] = useState('2024/2025');

  if (!isLoggedIn) {
    return (
      <>
        <Auth onLogin={() => setIsLoggedIn(true)} />
        <Toaster />
      </>
    );
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard academicYear={academicYear} />;
      case 'schools':
        return <Schools academicYear={academicYear} />;
      case 'students':
        return <Students academicYear={academicYear} />;
      case 'screenings':
        return <Screenings academicYear={academicYear} />;
      case 'ttd':
        return <TTDComplianceMenu academicYear={academicYear} />;
      case 'reports':
        return <Reports academicYear={academicYear} />;
      default:
        return <Dashboard academicYear={academicYear} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 relative overflow-hidden">
      {/* Global School Decorations */}
      <div className="fixed top-20 right-10 text-primary/5 -rotate-12 pointer-events-none">
        <Book size={200} />
      </div>
      <div className="fixed bottom-20 left-72 text-secondary/5 rotate-12 pointer-events-none">
        <Backpack size={180} />
      </div>
      <div className="fixed top-1/2 right-40 text-primary/3 rotate-45 pointer-events-none">
        <Pencil size={100} />
      </div>
      <div className="fixed top-40 left-80 text-secondary/3 -rotate-45 pointer-events-none">
        <Ruler size={120} />
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        academicYear={academicYear} 
        setAcademicYear={setAcademicYear} 
        onLogout={handleLogout}
      />
      
      <main className="md:pl-64 transition-all duration-300 relative z-10">
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
          <HeaderLogosBanner />
          {renderContent()}
        </div>
      </main>

      <Toaster />
    </div>
  );
}


