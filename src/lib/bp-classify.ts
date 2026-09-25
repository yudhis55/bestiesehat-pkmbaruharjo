// Klasifikasi skrining tekanan darah anak (acuan AAP 2017, skrining awal — bukan diagnosis).
// Tanpa tinggi badan hanya memakai ambang Tabel 6 (7–12 thn) / Tabel 3 (>=13 thn)
// plus ambang hipotensi PALS. Label netral, tanpa bahasa diagnostik.

export type BPComponentLabel = 'Normal' | 'Rendah' | 'Tinggi';

export interface BPResult {
  label: string;
  needsReferralHint: boolean;
  sysLabel: BPComponentLabel;
  diaLabel: BPComponentLabel;
}

// Tabel 6 AAP 2017 (P90 skrining per usia/jenis kelamin): [sistolik, diastolik]
const TABLE_7_12: Record<number, { L: [number, number]; P: [number, number] }> = {
  7: { L: [106, 68], P: [106, 68] },
  8: { L: [107, 69], P: [107, 69] },
  9: { L: [107, 70], P: [108, 71] },
  10: { L: [108, 72], P: [109, 72] },
  11: { L: [110, 74], P: [111, 74] },
  12: { L: [113, 75], P: [114, 75] },
};

function resolveHighThresholds(
  ageYears: number,
  sex: 'L' | 'P' | null,
): [number, number] {
  if (ageYears >= 13) return [120, 80];
  const row = TABLE_7_12[ageYears] ?? TABLE_7_12[7];
  if (sex === 'P') return row.P;
  if (sex === 'L') return row.L;
  return [Math.min(row.L[0], row.P[0]), Math.min(row.L[1], row.P[1])];
}

export function classifyBP(
  ageYears: number | null,
  sys: number,
  dia: number,
  sex: 'L' | 'P' | null,
): BPResult | null {
  if (ageYears === null || ageYears === undefined) return null;
  if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia <= 0) return null;

  // Hipotensi: SBP < 70 + 2×usia (<=10 thn, PALS), < 90 (>10 thn)
  const hypoThreshold = ageYears <= 10 ? 70 + 2 * ageYears : 90;
  // Hipotensi diastolik: 2/3 ambang sistolik, dibulatkan.
  const diaHypoThreshold = Math.round((hypoThreshold * 2) / 3);
  const [highSys, highDia] = resolveHighThresholds(ageYears, sex);
  const sysLabel: BPComponentLabel =
    sys < hypoThreshold ? 'Rendah' : sys >= highSys ? 'Tinggi' : 'Normal';
  const diaLabel: BPComponentLabel =
    dia < diaHypoThreshold ? 'Rendah' : dia >= highDia ? 'Tinggi' : 'Normal';

  if (sys < hypoThreshold) return { label: 'Hipotensi', needsReferralHint: true, sysLabel, diaLabel };

  if (ageYears >= 13) {
    if (sys < 120 && dia < 80) return { label: 'Normal', needsReferralHint: false, sysLabel, diaLabel };
    if (sys >= 120 && sys <= 129 && dia < 80)
      return { label: 'Pra-hipertensi', needsReferralHint: false, sysLabel, diaLabel };
    if (sys >= 140 || dia >= 90)
      return { label: 'Hipertensi Stage 2', needsReferralHint: true, sysLabel, diaLabel };
    if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89))
      return { label: 'Hipertensi Stage 1', needsReferralHint: true, sysLabel, diaLabel };
    // Fallback defensif (mis. sys < 120 tetapi dia 80–89 sudah tertangkap di atas)
    return { label: 'Hipertensi Stage 1', needsReferralHint: true, sysLabel, diaLabel };
  }

  if (ageYears >= 7) {
    const row = TABLE_7_12[ageYears];
    const threshold: [number, number] = sex === 'P' ? row.P : sex === 'L' ? row.L : [
      Math.min(row.L[0], row.P[0]),
      Math.min(row.L[1], row.P[1]),
    ];
    const [tSys, tDia] = threshold;
    // Proxy krisis (sys >= ambang + 12) tercakup: nilainya selalu >= ambang,
    // sehingga selalu hint true lewat cabang di bawah.
    if (sys >= tSys || dia >= tDia)
      return { label: 'Hipertensi (skrining)', needsReferralHint: true, sysLabel, diaLabel };
    return { label: 'Normal', needsReferralHint: false, sysLabel, diaLabel };
  }

  // Usia < 7: pakai baris usia 7 (paling sensitif pada anak kecil)
  const row7 = TABLE_7_12[7];
  const threshold: [number, number] =
    sex === 'P' ? row7.P : sex === 'L' ? row7.L : [
      Math.min(row7.L[0], row7.P[0]),
      Math.min(row7.L[1], row7.P[1]),
    ];
  if (sys >= threshold[0] || dia >= threshold[1])
    return { label: 'Hipertensi (skrining)', needsReferralHint: true, sysLabel, diaLabel };
  return { label: 'Normal', needsReferralHint: false, sysLabel, diaLabel };
}
