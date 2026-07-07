import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import { certificatesTable, db, eq, inArray, sql } from "@workspace/db";
import { GetCertificatesBySapParams, DeleteCertificateParams, BulkDeleteCertificatesBody } from "@workspace/api-zod";
import { deletePdf, readPdf, savePdfFile } from "../lib/pdfStorage";

const router = Router();

const tmpDir = path.join(os.tmpdir(), "verallia-cert", "certificates");
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${randomUUID()}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({ storage });

async function extractPdfText(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

function parseCertificateData(text: string, fileName: string): {
  sapCode: string | null;
  productionDate: string | null;
  productName: string | null;
} {
  let sapCode: string | null = null;
  let productionDate: string | null = null;
  let productName: string | null = null;

  const sapMatch =
    text.match(/Refer[eê]ncia\s+Interna\s+Verallia\s*[-–]?\s*SAP[:\s]+(\d{5,10})/i) ||
    text.match(/SAP[:\s]+(\d{5,10})/i) ||
    text.match(/\b(\d{7})\b/);
  if (sapMatch) sapCode = sapMatch[1].trim();

  const dateMatch =
    text.match(/DATA\s+PRODU[CÇ][AÃ]O[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})/i) ||
    text.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) productionDate = dateMatch[1].trim();

  const nameMatch =
    text.match(/GFA\.[^\n\r]{3,100}/i) ||
    text.match(/Produto[:\s]+([^\n\r]+)/i);
  if (nameMatch) productName = nameMatch[0].trim().substring(0, 200);

  if (!sapCode) {
    const fileMatch = fileName.match(/(\d{7,10})/);
    if (fileMatch) sapCode = fileMatch[1];
  }

  return { sapCode, productionDate, productName };
}

router.post("/certificates/upload", upload.array("files"), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No PDF files uploaded" });
    return;
  }

  const pdfFiles = files.filter((f) => {
    const ext = path.extname(f.originalname).toLowerCase();
    return ext === ".pdf" || f.mimetype === "application/pdf";
  });

  if (pdfFiles.length === 0) {
    res.status(400).json({ error: "Only PDF files are allowed" });
    return;
  }

  const results = [];

  for (const file of pdfFiles) {
    try {
      const text = await extractPdfText(file.path);
      const { sapCode, productionDate, productName } = parseCertificateData(text, file.originalname);

      if (!sapCode || !productionDate) {
        results.push({
          fileName: file.originalname,
          error: `Não foi possível extrair: SAP=${sapCode ?? "não encontrado"}, Data=${productionDate ?? "não encontrada"}`,
        });
        fs.unlink(file.path, () => {});
        continue;
      }

      const storedPath = await savePdfFile(file.path, `certificates/${randomUUID()}-${file.originalname}`);
      fs.unlink(file.path, () => {});

      const [cert] = await db
        .insert(certificatesTable)
        .values({
          sapCode,
          productionDate,
          productName: productName ?? null,
          fileName: file.originalname,
          filePath: storedPath,
        })
        .returning();

      results.push({
        id: cert.id,
        sapCode: cert.sapCode,
        productionDate: cert.productionDate,
        productName: cert.productName,
        fileName: cert.fileName,
        uploadedAt: cert.uploadedAt.toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "Error processing PDF");
      try { fs.unlinkSync(file.path); } catch {}
      results.push({ fileName: file.originalname, error: "Falha ao processar o PDF" });
    }
  }

  res.status(201).json(results);
});

router.get("/certificates", async (_req, res) => {
  const certs = await db.select().from(certificatesTable).orderBy(certificatesTable.uploadedAt);
  res.json(
    certs.map((c) => ({
      id: c.id,
      sapCode: c.sapCode,
      productionDate: c.productionDate,
      productName: c.productName,
      fileName: c.fileName,
      uploadedAt: c.uploadedAt.toISOString(),
    }))
  );
});

router.get("/certificates/sap-codes", async (_req, res) => {
  const rows = await db
    .select({
      sapCode: certificatesTable.sapCode,
      productName: sql<string | null>`MAX(${certificatesTable.productName})`,
      count: sql<number>`count(*)::int`,
    })
    .from(certificatesTable)
    .groupBy(certificatesTable.sapCode);

  const allCerts = await db.select().from(certificatesTable);

  const result = rows.map((row) => ({
    sapCode: row.sapCode,
    productName: row.productName,
    certificateCount: row.count,
    dates: allCerts
      .filter((c) => c.sapCode === row.sapCode)
      .map((c) => c.productionDate),
  }));

  res.json(result);
});

router.get("/certificates/by-sap/:sapCode", async (req, res) => {
  const parsed = GetCertificatesBySapParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid SAP code" }); return; }

  const certs = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.sapCode, parsed.data.sapCode));

  if (certs.length === 0) {
    res.status(404).json({ error: "Nenhum certificado encontrado para este código SAP" });
    return;
  }

  res.json(
    certs.map((c) => ({
      id: c.id,
      sapCode: c.sapCode,
      productionDate: c.productionDate,
      productName: c.productName,
      fileName: c.fileName,
      uploadedAt: c.uploadedAt.toISOString(),
    }))
  );
});

router.delete("/certificates/:id", async (req, res) => {
  const parsed = DeleteCertificateParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [cert] = await db
    .delete(certificatesTable)
    .where(eq(certificatesTable.id, parsed.data.id))
    .returning();

  if (!cert) { res.status(404).json({ error: "Certificate not found" }); return; }

  await deletePdf(cert.filePath);

  res.status(204).send();
});

router.post("/certificates/bulk-delete", async (req, res) => {
  const parsed = BulkDeleteCertificatesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { ids } = parsed.data;
  if (ids.length === 0) {
    res.json({ deleted: 0 });
    return;
  }

  const certs = await db
    .select()
    .from(certificatesTable)
    .where(inArray(certificatesTable.id, ids));

  await db.delete(certificatesTable).where(inArray(certificatesTable.id, ids));

  for (const cert of certs) {
    await deletePdf(cert.filePath);
  }

  res.json({ deleted: certs.length });
});

export { readPdf };
export default router;
