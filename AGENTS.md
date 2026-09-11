# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-11
**Commit:** n/a (no git repo)
**Branch:** n/a

## OVERVIEW
UKS Digital - Puskesmas Baruharjo: school health (UKS) CRUD + screening + TTD compliance + reports. Stack: Vite 6 + React 19 + TS (non-strict) + Tailwind v4 (CSS-first) + shadcn base-nova + Firebase (placeholder) + localStorage store.

## STRUCTURE
```
./
├── index.html          # -> /src/main.tsx
├── src/
│   ├── App.tsx         # state-router + auth gate
│   ├── main.tsx        # createRoot bootstrap
│   ├── types.ts        # School/Student/Screening/TTDCompliance/Report
│   ├── components/     # feature modules (see src/components/AGENTS.md)
│   ├── components/ui/  # vendored shadcn, do not hand-edit
│   ├── lib/            # store + firebase + utils (see src/lib/AGENTS.md)
│   └── assets/images/  # static logos only
├── components.json     # shadcn base-nova config
├── firebase-blueprint.json # Firestore data-model doc only
├── metadata.json       # AI Studio applet identity
└── .env.example        # GEMINI_API_KEY + APP_URL (AI Studio injects)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| App routing / auth gate | `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Auth.tsx` | No router lib; `activeTab` useState switch |
| Domain types | `src/types.ts` | Single source; import from here, never redefine |
| Persistence | `src/lib/storage.ts` | `uks_schools/students/screenings/ttd_compliance` keys + seed |
| Firebase | `src/lib/firebase.ts` | Placeholder until `firebase-applet-config.json` exists |
| Feature CRUD | `src/components/Dashboard|Schools|Students|Screenings|TTDCompliance|Reports.tsx` | Each takes `academicYear` prop |
| Styling/theme | `src/index.css` | Tailwind v4 `@theme inline`, Geist Variable |
| Build/entry | `index.html`, `vite.config.ts`, `src/main.tsx` | `@` -> `./src` alias |
| Logos/banner | `src/components/HeaderLogos.tsx`, `LogosSVG.tsx` | Static branding |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `App` (default) | component | `src/App.tsx` | Auth gate + `activeTab` router + `academicYear` state |
| `Sidebar` | component | `src/components/Sidebar.tsx` | Drives `activeTab`/`academicYear` |
| `Auth` | component | `src/components/Auth.tsx` | Login gate (`onLogin`) |
| `Dashboard` | component | `src/components/Dashboard.tsx` | Charts via recharts |
| `Schools/Students/Screenings` | components | `src/components/` | CRUD + domain forms |
| `TTDComplianceMenu` | component | `src/components/TTDCompliance.tsx` | TTD menu + XLSX import |
| `Reports` | component | `src/components/Reports.tsx` | Monthly reports |
| `School/Student/Screening/TTDCompliance/Report` | types | `src/types.ts` | Central domain contract |
| `calculateAgeDetails/calculateAgeYears` | fns | `src/lib/ageUtils.ts` | DOB -> age logic |
| `cn` | fn | `src/lib/utils.ts` | Canonical clsx+twMerge |
| `auth/db/googleProvider/signInWithGoogle` | firebase | `src/lib/firebase.ts` | Auth + Firestore handles |

LSP unavailable (no `typescript-language-server`); map derived from explore agents + direct reads. No centrality counts.

## CONVENTIONS
- Imports: `@/...` only (`@` -> `./src` in both `tsconfig.json` paths + `vite.config.ts` alias — keep in sync).
- TS: non-strict (no `strict` flag — Vite default `strict:true` deliberately dropped); `allowImportingTsExtensions`, `moduleDetection:force`, `noEmit:true`.
- Tailwind v4 CSS-first: no `tailwind.config.*`; theme in `src/index.css` via `@theme inline` + `@custom-variant dark`; shadcn css `src/index.css`, `base-nova`, `neutral`, cssVariables.
- Feature signature: every feature component takes `{ academicYear: string }`; `App.tsx` owns `academicYear='2024/2025'`.
- Store: no Zustand/Redux; `src/lib/storage.ts` direct localStorage + exported seed arrays is the store.
- Env: `process.env.GEMINI_API_KEY` injected via `vite.config.ts` define from `loadEnv`; `.env*` ignored except `!.env.example`.
- No formatter/linter configs: no eslint/prettier/editorconfig — match surrounding 2-space, double-quote, `@/` style manually.

## ANTI-PATTERNS (THIS PROJECT)
- Do not add `as any` / `@ts-ignore` — existing escapes (`lib/firebase.ts:6,8`, `Screenings.tsx:any|null`, `Students.tsx:any`, `TTDCompliance.tsx:XLSX cast`) are tech debt, do not expand.
- Do not bypass `src/types.ts` — never redefine School/Student/Screening locally.
- Do not add global state lib — persist via `lib/storage.ts` helpers, not ad-hoc `localStorage.get/set` elsewhere (already 12x direct calls — do not grow).
- Do not touch `vite.config.ts:20-21` HMR guard (`DISABLE_HMR`, file-watching disabled) or `index.css` `@theme` tokens without reason.
- Do not hand-edit `src/components/ui/*` except `chart.tsx` error boundary is intentional (`throw useChart must be used within ChartContainer`); `dangerouslySetInnerHTML` there is shadcn-vendored.
- No `console.warn/error` in new code (`firebase.ts:12`, `Screenings.tsx`, `Students.tsx` are legacy).
- No tests exist — do not claim `npm test`; verification is `npm run lint` + `npm run build`.

## UNIQUE STYLES
- State-router, not react-router: `Sidebar.setActiveTab` string switch in `App.renderContent`.
- Indonesian UKS domain: NIK, RT/RW/desa/kecamatan/kabupaten/provinsi address, SD/SMP/SMA branching (hepatitisC=SMA-only, immunization=kelas-1-SD, anemia/HB=remaja-putri).
- Placeholder-first Firebase: try-import `firebase-applet-config.json` else placeholder config + `console.warn`.
- School-decoration overlay in `App.tsx` (Book/Backpack/Pencil/Ruler fixed icons, pointer-events-none).

## COMMANDS
```bash
npm install          # install (Node.js required, no engines pin)
npm run dev          # vite --port=3000 --host=0.0.0.0, HMR unless DISABLE_HMR=true
npm run build        # vite build -> dist/
npm run preview      # serve dist/
npm run lint         # tsc --noEmit (ONLY verification gate, no tests)
npm run clean        # rm -rf dist
```
No CI (no `.github/workflows`), no Dockerfile, no test runner. `express` + `@types/express` deps are unused; `firebase.json`/`firestore.rules` absent despite `firebase-blueprint.json`.

## NOTES
- `index.html` title still generic `My Google AI Studio App` — update when branding.
- `firebase.ts:26` passes `firebaseConfig.firestoreDatabaseId` (undefined in placeholder) to `getFirestore` — will fail until real config wired.
- `README.md` references missing `.env.local`; canonical env is AI Studio Secrets (`GEMINI_API_KEY`) + `.env.example`.
- Seed data in `storage.ts` uses Kota/Bogor placeholders, not Baruharjo/Trenggalek — replace before prod.
