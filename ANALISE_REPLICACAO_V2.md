# Analise para Replicacao 2.0 - Verallia Certificados

## Resumo

O projeto atual e um monorepo TypeScript criado em pnpm workspaces. Ele contem:

- `artifacts/verallia-cert`: frontend React + Vite + Tailwind/shadcn.
- `artifacts/api-server`: API Express 5.
- `lib/api-spec`: contrato OpenAPI, usado para gerar cliente React e schemas.
- `lib/api-client-react`: cliente gerado por Orval para o frontend.
- `lib/api-zod`: schemas/validadores gerados a partir do OpenAPI.
- `lib/db`: schema Drizzle/PostgreSQL.
- `scripts`: utilitarios, incluindo migracao de PDFs para GCS.

O produto atual faz upload de certificados PDF da Verallia, extrai codigo SAP/data/produto, importa base Excel de pecas por pallet, preenche PDF com NF/pallets/pecas e mantem historico de emissao/download.

## Stack Atual

- Node.js 24
- pnpm workspaces
- TypeScript 5.9
- React 19 + Vite 7
- Tailwind CSS 4 + shadcn/ui/Radix
- TanStack Query
- Express 5
- PostgreSQL + Drizzle ORM
- OpenAPI + Orval + Zod
- `pdf-parse` para extracao de texto
- `pdf-lib` para preencher PDF por coordenadas fixas
- `xlsx` para importacao Excel
- Google Cloud Storage/Replit Object Storage para PDFs

## Fluxos Principais

1. Upload de PDFs
   - Endpoint: `POST /api/certificates/upload`
   - Faz upload temporario via multer.
   - Extrai texto do PDF.
   - Usa regex para identificar SAP, data de producao e produto.
   - Salva PDF no bucket e metadados no banco.

2. Base pecas/pallet
   - Endpoint: `POST /api/pallet-quantities/import`
   - Importa XLS/XLSX.
   - Aceita varias nomenclaturas de coluna.
   - Substitui toda a base a cada importacao.
   - Tambem permite adicionar, editar e excluir registros manualmente.

3. Preenchimento de certificado
   - Endpoint: `POST /api/history`
   - Busca certificado original no storage.
   - Preenche NF, pallets e pecas no PDF usando coordenadas fixas.
   - Salva PDF gerado no storage.
   - Registra historico.

4. Historico e downloads
   - Endpoint: `GET /api/history`
   - Download: `GET /api/history/{id}/download`
   - Permite excluir registros individuais ou em lote.

## Banco de Dados

Tabelas principais:

- `certificates`
  - SAP, data de producao, produto, nome do arquivo, caminho do PDF original.
- `pallet_quantities`
  - SAP unico, produto e pecas por pallet.
- `history`
  - certificado base, NF, pallets, pecas, usuario fixo e caminho do PDF gerado.

## Pontos Fortes para Reaproveitar

- Separacao boa entre frontend, API, contrato OpenAPI e DB.
- Cliente React e Zod gerados a partir de contrato unico.
- UI ja cobre os quatro fluxos essenciais.
- Bulk delete ja existe para certificados e historico.
- Importacao Excel flexivel para varios nomes de coluna.
- Migracao parcial ja considera legado local -> GCS.

## Riscos e Limitacoes da Versao Atual

- Nao ha `node_modules` instalado nesta pasta; e necessario rodar `pnpm install` antes de build/typecheck.
- A pasta nao e um repositorio Git local neste ambiente.
- Runtime exige variaveis obrigatorias:
  - `PORT`
  - `BASE_PATH`
  - `DATABASE_URL`
  - `DEFAULT_OBJECT_STORAGE_BUCKET_ID` para storage em bucket.
- O preenchimento de PDF usa coordenadas fixas. Se o layout do certificado mudar, a saida pode ficar desalinhada.
- Extracao de dados do PDF depende de regex; PDFs com texto diferente ou escaneados podem falhar.
- `userName` esta fixo como `Operador`.
- Nao ha autenticacao, perfis, auditoria formal ou controle de permissao.
- A base de pallets importada substitui tudo, sem staging/confirmacao de diferencas.
- Nao foram encontrados testes automatizados.
- A documentacao ainda menciona armazenamento local em alguns pontos, mas o codigo atual usa bucket/GCS para PDFs.

## Recomendacao para Versao 2.0

### Base tecnica

- Manter monorepo, mas criar uma estrutura 2.0 limpa:
  - `apps/web`
  - `apps/api`
  - `packages/api-contract`
  - `packages/api-client`
  - `packages/db`
  - `packages/pdf`
  - `packages/importers`
- Separar regra de negocio de rotas Express.
- Criar camada de storage com adaptadores:
  - local filesystem para desenvolvimento
  - S3/GCS/Object Storage para producao
- Adicionar `.env.example` e defaults locais seguros.

### Produto

- Autenticacao e usuarios reais.
- Historico com usuario, status e trilha de auditoria.
- Tela de validacao apos upload mostrando SAP/data/produto extraidos antes de salvar.
- Staging de importacao Excel, com diferencas: novos, alterados, removidos.
- Busca, filtros e paginacao em certificados e historico.
- Preview do PDF antes de baixar.
- Editor/calibrador visual de coordenadas do PDF por modelo de certificado.
- Suporte a multiplos modelos/layouts de certificado.
- Status de processamento para uploads grandes.
- Exportacao do historico para Excel/CSV.

### Qualidade

- Testes unitarios para:
  - parser de PDF
  - parser de Excel
  - calculo pallets/pecas
  - formacao de nomes de arquivos
- Testes de integracao para rotas principais.
- Validacao de tamanho/tipo de arquivo.
- Logs estruturados com correlation id.
- Tratamento padronizado de erros.

## Ordem Sugerida para Replicar

1. Instalar dependencias e validar build/typecheck do projeto atual.
2. Criar `.env.example` com variaveis reais do app.
3. Extrair regras de PDF, Excel e storage para modulos isolados.
4. Criar o esqueleto 2.0 mantendo o contrato OpenAPI como fonte de verdade.
5. Migrar primeiro os fluxos existentes sem mudar comportamento.
6. Adicionar melhorias 2.0 por etapas: autenticacao, filtros, preview, auditoria e calibrador de PDF.

## Comandos Esperados

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/verallia-cert run dev
```

Para rodar localmente, sera necessario definir as variaveis de ambiente antes dos comandos de dev.
