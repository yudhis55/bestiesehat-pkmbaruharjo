# COMPONENTS KNOWLEDGE BASE

## OVERVIEW
10 UKS feature modules (Dashboard/Schools/Students/Screenings/TTD/Reports/Auth/Sidebar/HeaderLogos/LogosSVG) + vendored shadcn `ui/` (do not hand-edit).

## WHERE TO LOOK
| File | Role |
|------|------|
| `Dashboard.tsx` | Stats cards + recharts Bar/Pie (screeningBySchool, bmiDistribution); read-only `useState(() => get*)` |
| `Schools.tsx` | School CRUD (SD/SMP/SMA); dialog form + table |
| `Students.tsx` | Student CRUD (NIK, class, gender, schoolId FK); search + dialog form |
| `Screenings.tsx` | Screening CRUD + XLSX import/export; `resolvedScreenings` joins student+school via useMemo |
| `TTDCompliance.tsx` | `TTDComplianceMenu`: remaja-putri tablet tracking; `ComplianceRecord` join type + XLSX import |
| `Reports.tsx` | Monthly aggregate reports (read-only views over storage getters) |
| `Auth.tsx` | Login gate (`onLogin` callback only, no routing) |
| `Sidebar.tsx` | `setActiveTab` string switch driver + academicYear selector |
| `HeaderLogos.tsx` / `LogosSVG.tsx` | Static Puskesmas/school branding; no logic |

## CONVENTIONS
- Signature: `function X({ academicYear }: { academicYear: string })`; filter lists by `academicYear` where field exists.
- State shape: `useState(() => getX())` seed from storage; `searchTerm`, `isOpen/isDetailOpen/isImportOpen`, `selectedScreening/selectedStudent: any | null`, `fileInputRef`.
- CRUD loop: Dialog (form) -> `saveX()` + `setX()` -> `toast.success/error` (sonner) -> Table (shadcn `table/button/input/badge/label/select/dialog`).
- Joins: `useMemo` map FK `studentId/schoolId` to `studentName/schoolName/studentClass` with `'Unknown Student/School'` fallback.
- `Dashboard.tsx`: recharts only (`BarChart/PieChart` + `ResponsiveContainer`); no XLSX there.
- `Screenings.tsx` / `TTDCompliance.tsx`: `import * as XLSX from 'xlsx'` for import/export; hidden `<input type=file>` via `fileInputRef`.

## ANTI-PATTERNS
- Do not widen `any`: `Screenings.tsx:47 selectedScreening: any|null`, `Students.tsx` selected item, `TTDCompliance.tsx` XLSX casts are debt, type new code properly.
- No `console.warn/error` in feature modules; use `toast.error` for user-visible failures.
- Do not hand-edit `ui/*` (vendored shadcn); sole exception `ui/chart.tsx` error boundary (`throw useChart must be used within...`).
- Do not add per-component `localStorage` keys; route all persistence through `@/lib/storage` getters/setters.
