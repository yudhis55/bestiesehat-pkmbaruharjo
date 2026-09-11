import React from 'react';
import logoTrenggalekImg from '@/assets/images/logo_trenggalek_official_1784774240299.jpg';
import logoTrenggalekBackupImg from '@/assets/images/logo_trenggalek_1784773672575.jpg';
import logoPuskesmasBaruharjoImg from '@/assets/images/logo_puskesmas_baruharjo_1784774475857.jpg';
import logoPuskesmasImg from '@/assets/images/logo_puskesmas_1784773689987.jpg';
import logoUksImg from '@/assets/images/logo_uks_1784773704359.jpg';
import { LogoTrenggalekSVG, LogoPuskesmasBaruharjoSVG, LogoUKSSVG } from '@/components/LogosSVG';

export const LOGO_PATHS = {
  trenggalek: logoTrenggalekImg,
  puskesmas: logoPuskesmasBaruharjoImg || logoPuskesmasImg,
  uks: logoUksImg,
};

interface LogosProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabels?: boolean;
}

export function HeaderLogosBanner({ className = '', size = 'md', showLabels = true }: LogosProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20'
  };

  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-teal-100 shadow-xs flex items-center justify-between gap-4 ${className}`}>
      {/* Logo 1: Kabupaten Trenggalek */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <LogoTrenggalekSVG className={`${sizeClasses[size]} drop-shadow-sm`} />
        </div>
        {showLabels && (
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Pemerintah Kabupaten</p>
            <p className="text-sm font-extrabold text-slate-800">Trenggalek</p>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0" />

      {/* Logo 2: Puskesmas */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <LogoPuskesmasBaruharjoSVG className={`${sizeClasses[size]} drop-shadow-sm`} />
        </div>
        {showLabels && (
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Dinas Kesehatan</p>
            <p className="text-sm font-extrabold text-slate-800">Puskesmas Baruharjo</p>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0" />

      {/* Logo 3: UKS */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <LogoUKSSVG className={`${sizeClasses[size]} drop-shadow-sm`} />
        </div>
        {showLabels && (
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Usaha Kesehatan Sekolah</p>
            <p className="text-sm font-extrabold text-slate-800">UKS Digital</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SidebarLogos() {
  return (
    <div className="p-3 bg-linear-to-r from-teal-50/80 via-emerald-50/50 to-cyan-50/80 rounded-2xl border border-teal-100/60 shadow-xs mb-3">
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col items-center group">
          <LogoTrenggalekSVG className="h-9 w-9 drop-shadow-xs transition-transform group-hover:scale-105" />
          <span className="text-[8px] font-bold uppercase text-slate-500 tracking-tight mt-1">Trenggalek</span>
        </div>

        <div className="h-7 w-px bg-teal-200/60" />

        <div className="flex flex-col items-center group">
          <LogoPuskesmasBaruharjoSVG className="h-9 w-9 drop-shadow-xs transition-transform group-hover:scale-105" />
          <span className="text-[8px] font-bold uppercase text-slate-500 tracking-tight mt-1">Puskesmas</span>
        </div>

        <div className="h-7 w-px bg-teal-200/60" />

        <div className="flex flex-col items-center group">
          <LogoUKSSVG className="h-9 w-9 drop-shadow-xs transition-transform group-hover:scale-105" />
          <span className="text-[8px] font-bold uppercase text-slate-500 tracking-tight mt-1">UKS</span>
        </div>
      </div>
    </div>
  );
}

export function AuthLogosBanner() {
  return (
    <div className="flex justify-center items-center gap-4 p-4 bg-linear-to-r from-teal-50/80 via-white to-teal-50/80 rounded-3xl border border-teal-100 shadow-xs my-2">
      <div className="flex flex-col items-center text-center">
        <LogoTrenggalekSVG className="h-14 w-14 drop-shadow-md bg-white p-1 rounded-xl border border-slate-100" />
        <span className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mt-1.5">Trenggalek</span>
      </div>

      <div className="h-10 w-px bg-teal-200" />

      <div className="flex flex-col items-center text-center">
        <LogoPuskesmasBaruharjoSVG className="h-14 w-14 drop-shadow-md bg-white p-1 rounded-xl border border-slate-100" />
        <span className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mt-1.5">Puskesmas</span>
      </div>

      <div className="h-10 w-px bg-teal-200" />

      <div className="flex flex-col items-center text-center">
        <LogoUKSSVG className="h-14 w-14 drop-shadow-md bg-white p-1 rounded-xl border border-slate-100" />
        <span className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mt-1.5">UKS</span>
      </div>
    </div>
  );
}
