# Verallia Certificados

Sistema web para upload, armazenamento, preenchimento e historico de Certificados de Qualidade Verallia em PDF.

## Estrutura

- `artifacts/verallia-cert`: frontend React/Vite.
- `artifacts/api-server`: API Express.
- `lib/db`: schema Drizzle/PostgreSQL.
- `lib/api-spec`: contrato OpenAPI.
- `lib/api-client-react`: cliente gerado para o frontend.
- `lib/api-zod`: validadores gerados a partir do contrato.

## Requisitos

- Node.js 24
- pnpm
- PostgreSQL

## Configuracao

Copie `.env.example` para `.env` e ajuste pelo menos:

```bash
DATABASE_URL=postgresql://usuario:senha@localhost:5432/verallia_cert
```

Para desenvolvimento local, `DEFAULT_OBJECT_STORAGE_BUCKET_ID` pode ficar vazio. Nesse caso, PDFs originais e gerados sao salvos em `LOCAL_STORAGE_DIR` ou `./uploads`.

Para producao na Vercel, configure Supabase Storage:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=certificados
```

Crie o bucket no Supabase antes do primeiro upload. O bucket pode ser privado, pois a API faz download dos PDFs pelo backend.

Para criar as tabelas no Supabase, execute `supabase/schema.sql` no SQL Editor do projeto.

## Instalar

```bash
pnpm install
```

## Rodar

Em um terminal, suba a API:

```bash
pnpm --filter @workspace/api-server run dev
```

Em outro terminal, suba o frontend:

```bash
pnpm --filter @workspace/verallia-cert run dev
```

Padroes locais:

- API: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- Proxy do frontend: `/api` -> `http://localhost:5000`

## Validacao

```bash
pnpm run typecheck
pnpm run build
```

## Deploy na Vercel

O arquivo `vercel.json` esta configurado para:

- instalar dependencias com pnpm;
- buildar o frontend `@workspace/verallia-cert`;
- publicar `artifacts/verallia-cert/dist/public`;
- encaminhar `/api/*` para a funcao serverless em `api/[...path].ts`.

Variaveis necessarias no painel da Vercel:

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=certificados
BASE_PATH=/
```

## Observacoes

- O preenchimento do PDF usa coordenadas fixas. Se o layout do certificado mudar, ajuste a funcao `fillPdf` em `artifacts/api-server/src/routes/history.ts`.
- A extracao de SAP/data/produto usa regex em `artifacts/api-server/src/routes/certificates.ts`.
- A importacao da base de pecas por pallet substitui toda a base existente.
