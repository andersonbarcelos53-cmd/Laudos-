# Verallia Certificados

Sistema web para controle, armazenamento e preenchimento de Certificados de Qualidade da Verallia em PDF.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/verallia-cert run dev` — run the frontend (reads PORT from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- PDF reading: `pdf-parse`
- PDF writing/overlay: `pdf-lib`
- Excel parsing: `xlsx`
- File uploads: `multer`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/certificates.ts` — DB schema (certificates, pallet_quantities, history tables)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/verallia-cert/src/` — React frontend
- `artifacts/verallia-cert/src/pages/home.tsx` — Main 4-tab page
- `artifacts/verallia-cert/src/components/tabs/` — Tab components
- `uploads/certificates/` — Uploaded PDF originals (server-side)
- `uploads/generated/` — Generated filled PDFs (server-side)

## Architecture decisions

- PDFs are stored on disk (not in DB) with paths saved to the database.
- PDF text extraction uses `pdf-parse` with regex heuristics to pull SAP code, production date, and product name from the certificate format.
- PDF filling uses `pdf-lib` to overlay text on the original PDF at approximate coordinates matching the Verallia certificate layout.
- Pallet quantities are imported from Excel and replace all existing entries on each import.
- History tracks every generated certificate and links back to the original certificate.

## Product

- **Upload de PDFs** — drag-and-drop upload of Verallia quality certificate PDFs; auto-extracts SAP code and production date
- **Base Peças/Pallet** — import Excel file with SAP code → pieces-per-pallet mapping; used for auto-calculation
- **Preencher Certificado** — select SAP code + production date, enter invoice number and pallets (pieces auto-calculated), generate filled PDF
- **Histórico** — view all previously generated certificates with re-download links

## User preferences

- App in Portuguese (pt-BR)
- Professional, industrial UI (dense, high-contrast teal/dark theme)

## Gotchas

- PDF text coordinates for filling (invoice, pallets, pieces) are approximate and may need adjustment if Verallia changes their certificate layout.
- Run `pnpm run typecheck:libs` after any DB schema change before typechecking leaf packages.
- `pdf-parse` v2 uses ESM-only imports via `pdf-parse/node` path for Node.js usage.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
