# AGENTS.md — UKS Digital (Puskesmas Baruharjo)

Vite 6 + React 19 + TS (non-strict) + Tailwind v4 CSS-first + shadcn `base-nova` + Firebase (placeholder) + localStorage store. School health CRUD + screening + TTD compliance + reports. No router, no state lib, no tests, no CI.

## Commands

```bash
npm install          # Node.js required, no engines pin
npm run dev          # vite --port=3003 --host=0.0.0.0 (NOT 3000; old docs saying 3000 are stale)
npm run build        # vite build -> dist/
npm run preview      # serve dist/
npm run lint         # tsc --noEmit — ONLY verification gate (misnamed typecheck, no eslint)
npm run clean        # rm -rf dist — breaks on Windows PowerShell; use Remove-Item instead
```

- No `npm test`, no test runner, no linter/formatter configs. Verify with `lint` + `build`.
- Env: `process.env.GEMINI_API_KEY` injected via `loadEnv` + `define` in `vite.config.ts`. `.env*` ignored except `!.env.example` (`APP_URL` + `GEMINI_API_KEY`, AI Studio injects). `README.md` reference to `.env.local` is stale — file does not exist.

## Entrypoints

- `index.html` → `/src/main.tsx` (`StrictMode` + `index.css`) → `src/App.tsx`.
- `App.tsx`: owns `isLoggedIn` auth gate, `activeTab` string state-router (no react-router), `academicYear='2024/2025'`. Every feature takes `{ academicYear: string }`.
- Types: `src/types.ts` is single source (`School/Student/Screening/TTDCompliance/Report`, `SchoolType='SD'|'SMP'|'SMA'`). Never redefine locally.
- Store: `src/lib/storage.ts` only — keys `uks_schools|students|screenings|ttd_compliance`, lazy-seed getters + whole-array savers. Route all persistence through its helpers.
- Firebase: `src/lib/firebase.ts` tries `../../firebase-applet-config.json`, falls back to `"placeholder"` config. `getFirestore(app, undefined)` breaks until real config wired.
- Detail maps: `src/components/AGENTS.md` (feature CRUD/XLSX/recharts patterns), `src/lib/AGENTS.md` (storage/Firebase/age-utils).

## Conventions

- Imports: `@/...` only (`@` → `./src`, keep `tsconfig.json` paths + `vite.config.ts` alias in sync). Sole exceptions: `lib/storage.ts:1` and `components/TTDCompliance.tsx` use `'../types'` — keep.
- TS: non-strict (no `strict` flag), `noEmit:true`, `allowImportingTsExtensions`, `moduleDetection:force`. Never add `as any` / `@ts-ignore` (existing ones in `firebase.ts:6,8` are debt).
- Features: `useState(() => getX())` seed → Dialog form → `saveX()` + `setX()` → `toast` (sonner) → shadcn Table. FK joins via `useMemo` with `'Unknown Student/School'` fallback. Filter by `academicYear` where field exists.
- `Dashboard.tsx`: recharts only (`Bar/Pie` + `ResponsiveContainer`), no XLSX. `Screenings/TTDCompliance`: `import * as XLSX from 'xlsx'` + hidden `<input type=file>` via `fileInputRef`.
- Styling: Tailwind v4 CSS-first — no `tailwind.config.*`, never create one. Theme in `src/index.css`: `@theme inline` maps `--color-*` → `var(--*)`; edit `oklch()` values in `:root`/`.dark`, not `--color-*`. Keep import order (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, Geist) and `@custom-variant dark (&:is(.dark *))`.
- `components.json`: `style:base-nova`, `tailwind.config:""` (correct for v4), `css:src/index.css`, `neutral`, `cssVariables:true`. Components consume `var(--background)` etc. — never hardcode hex.
- Age: derive at render via `calculateAgeYears/Details` from `birthDate`; `formatted` is Indonesian (`X Tahun Y Bulan`). Never persist computed age.
- `cn` in `lib/utils.ts` (`twMerge(clsx())`) is canonical — no custom class logic there.

## Do not

- Hand-edit `src/components/ui/*` (vendored shadcn). `chart.tsx` `throw useChart...` is intentional error boundary.
- Touch `vite.config.ts:18-21` HMR guard (`DISABLE_HMR`) — file-watching disabled to prevent flicker during agent edits.
- Add global state lib, per-component `localStorage` keys (all 12 calls already confined to `storage.ts`), new keys without `uks_` prefix, or `JSON.parse` without miss-seed guard shape.
- Add `console.warn/error` in new code — use `toast.error` for user-visible failures.
- Domain branching: `hepatitisC`=SMA-only, `immunizationHistory`=kelas-1-SD, `anemiaStatus/HB`=remaja-putri. Seeds are Bogor/Ciawi placeholders — replace with Baruharjo/Trenggalek before prod. `index.html` title still generic `My Google AI Studio App`.
