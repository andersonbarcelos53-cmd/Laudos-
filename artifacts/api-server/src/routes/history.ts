import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { certificatesTable, historyTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import {
  FillCertificateBody,
  DownloadGeneratedPdfParams,
  DeleteHistoryRecordParams,
  BulkDeleteHistoryBody,
} from "@workspace/api-zod";
import { deletePdf, readPdf, savePdfBuffer } from "../lib/pdfStorage";

const router = Router();

async function fillPdf(
  originalBuffer: Buffer,
  invoiceNumber: string,
  pallets: number,
  pieces: number
): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.load(originalBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const textColor = rgb(0, 0, 0);
  const fontSize = 11;

  firstPage.drawText(invoiceNumber, { x: 451, y: 167, size: fontSize, font, color: textColor });
  firstPage.drawText(String(pallets), { x: 413, y: 133, size: fontSize, font, color: textColor });
  firstPage.drawText(String(pieces), { x: 481, y: 133, size: fontSize, font, color: textColor });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function formatRow(r: typeof historyTable.$inferSelect) {
  return {
    id: r.id,
    sapCode: r.sapCode,
    productName: r.productName,
    productionDate: r.productionDate,
    invoiceNumber: r.invoiceNumber,
    pallets: r.pallets,
    pieces: r.pieces,
    generatedAt: r.generatedAt.toISOString(),
    userName: r.userName,
    downloadUrl: `/api/history/${r.id}/download`,
  };
}

router.get("/history", async (_req, res) => {
  const rows = await db
    .select()
    .from(historyTable)
    .orderBy(desc(historyTable.generatedAt));
  res.json(rows.map(formatRow));
});

router.post("/history", async (req, res) => {
  const parsed = FillCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { certificateId, invoiceNumber, pallets, pieces } = parsed.data;

  const [cert] = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.id, certificateId));

  if (!cert) {
    res.status(404).json({ error: "Certificado não encontrado" });
    return;
  }

  let originalBuffer: Buffer;
  try {
    originalBuffer = await readPdf(cert.filePath);
  } catch {
    res.status(404).json({ error: "Arquivo PDF original não encontrado no servidor" });
    return;
  }

  try {
    const pdfBuffer = await fillPdf(originalBuffer, invoiceNumber, pallets, pieces);

    const dateStr = cert.productionDate.replace(/\//g, "");
    const storedPath = await savePdfBuffer(
      pdfBuffer,
      `generated/${randomUUID()}-CERTIFICADO_${cert.sapCode}_${dateStr}_${invoiceNumber}.pdf`
    );

    const [histRecord] = await db
      .insert(historyTable)
      .values({
        certificateId: cert.id,
        sapCode: cert.sapCode,
        productName: cert.productName,
        productionDate: cert.productionDate,
        invoiceNumber,
        pallets,
        pieces,
        userName: "Operador",
        generatedFilePath: storedPath,
      })
      .returning();

    res.status(201).json(formatRow(histRecord));
  } catch (err) {
    req.log.error({ err }, "Error generating PDF");
    res.status(500).json({ error: "Falha ao gerar o PDF" });
  }
});

// Must come before /:id/download to avoid route conflict
router.post("/history/bulk-delete", async (req, res) => {
  const parsed = BulkDeleteHistoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { ids } = parsed.data;
  if (ids.length === 0) {
    res.json({ deleted: 0 });
    return;
  }

  const records = await db
    .select()
    .from(historyTable)
    .where(inArray(historyTable.id, ids));

  await db.delete(historyTable).where(inArray(historyTable.id, ids));

  for (const record of records) {
    await deletePdf(record.generatedFilePath);
  }

  res.json({ deleted: records.length });
});

router.delete("/history/:id", async (req, res) => {
  const parsed = DeleteHistoryRecordParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [record] = await db
    .delete(historyTable)
    .where(eq(historyTable.id, parsed.data.id))
    .returning();

  if (!record) { res.status(404).json({ error: "Registro não encontrado" }); return; }

  await deletePdf(record.generatedFilePath);

  res.status(204).send();
});

router.get("/history/:id/download", async (req, res) => {
  const parsed = DownloadGeneratedPdfParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [record] = await db
    .select()
    .from(historyTable)
    .where(eq(historyTable.id, parsed.data.id));

  if (!record) { res.status(404).json({ error: "Registro não encontrado" }); return; }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await readPdf(record.generatedFilePath);
  } catch {
    res.status(404).json({ error: "PDF gerado não encontrado no servidor" });
    return;
  }

  const dateStr = record.productionDate.replace(/\//g, "");
  const fileName = `CERTIFICADO_${record.sapCode}_${dateStr}_${record.invoiceNumber}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(pdfBuffer);
});

export default router;
