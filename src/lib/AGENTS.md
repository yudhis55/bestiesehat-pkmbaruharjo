# LIB KNOWLEDGE BASE

## OVERVIEW
Data + persistence layer: localStorage store, Firebase placeholder, age calc, class merge.

## WHERE TO LOOK
| File | Role | Key exports |
|------|------|-------------|
| `storage.ts` | Seed-first localStorage store (205 lines) | `getSchools/saveSchools`, `getStudents/saveStudents`, `getScreenings/saveScreenings`, `getTTDCompliance/saveTTDCompliance` |
| `firebase.ts` | Placeholder-first Firebase init (29 lines) | `auth`, `db`, `googleProvider`, `signInWithGoogle` |
| `ageUtils.ts` | DOB to age detail (62 lines) | `calculateAgeDetails`, `calculateAgeYears`, `AgeDetail` |
| `utils.ts` | shadcn class merge (6 lines) | `cn` |

## CONVENTIONS
- `storage.ts` imports types via relative `'../types'`: sole `@/` exception in codebase, keep it.
- Keys prefixed `uks_`: `uks_schools`, `uks_students`, `uks_screenings`, `uks_ttd_compliance`.
- Getters lazy-seed: miss writes `initial{Schools,Students,Screenings,Compliance}` then returns it; savers take whole array, no partial updates.
- Seeds are Bogor/Ciawi placeholders: replace with Baruharjo/Trenggalek before prod.
- `firebase.ts` pattern: try-import `../../firebase-applet-config.json`, catch falls back to `"placeholder"` config.
- Age: derive from `birthDate` at render via `calculateAgeYears` / `calculateAgeDetails`; never persist computed age as source of truth.
- `AgeDetail.formatted` is Indonesian (`"X Tahun Y Bulan"`); `shortFormatted` is compact (`"X Thn Y Bln"`); empty input returns `'Belum diisi'` / `'-'`.
- `cn`: `twMerge(clsx(inputs))`, canonical order `clsx` then `twMerge`.

## ANTI-PATTERNS
- `firebase.ts:6` `let firebaseConfig: any` + `firebase.ts:8` `// @ts-ignore`: do not copy to new files.
- `firebase.ts:12` `console.warn` on missing config: only sanctioned warn in lib, do not add more.
- `firebase.ts:26` passes `firebaseConfig.firestoreDatabaseId` (undefined in placeholder) to `getFirestore`: breaks until real config wired, do not replicate.
- Do not grow ad-hoc `localStorage.get/set` outside `storage.ts` helpers (12x direct calls already in components).
- No `JSON.parse` without the miss-seed guard shape; no new keys without `uks_` prefix.
- Keep `utils.ts` canonical: `clsx` + `tailwind-merge` only, no custom class logic here.
