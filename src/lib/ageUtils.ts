export interface AgeDetail {
  years: number;
  months: number;
  days: number;
  formatted: string;
  shortFormatted: string;
}

/**
 * Otomatis menghitung umur siswa berdasarkan tanggal lahir
 * Mengembalikan detail umur dalam Tahun, Bulan, dan Hari
 */
export function calculateAgeDetails(birthDateString: string): AgeDetail {
  if (!birthDateString) {
    return { years: 0, months: 0, days: 0, formatted: 'Belum diisi', shortFormatted: '-' };
  }

  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) {
    return { years: 0, months: 0, days: 0, formatted: 'Tanggal tidak valid', shortFormatted: '-' };
  }

  const today = new Date();
  if (birthDate > today) {
    return { years: 0, months: 0, days: 0, formatted: 'Belum lahir (tanggal di masa depan)', shortFormatted: '-' };
  }

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  let parts: string[] = [];
  if (years > 0) parts.push(`${years} Tahun`);
  if (months > 0) parts.push(`${months} Bulan`);
  if (years === 0 && days > 0) parts.push(`${days} Hari`);

  const formatted = parts.length > 0 ? parts.join(' ') : '0 Hari';
  const shortFormatted = `${years} Thn${months > 0 ? ` ${months} Bln` : ''}`;

  return {
    years,
    months,
    days,
    formatted,
    shortFormatted
  };
}

export function calculateAgeYears(birthDateString: string): number {
  return calculateAgeDetails(birthDateString).years;
}
