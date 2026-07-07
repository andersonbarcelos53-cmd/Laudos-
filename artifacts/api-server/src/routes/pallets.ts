import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { db, eq, palletQuantitiesTable } from "@workspace/db";
import {
  GetPalletQuantityParams,
  DeletePalletQuantityParams,
  UpdatePalletQuantityParams,
  AddPalletQuantityBody,
  UpdatePalletQuantityBody,
} from "@workspace/api-zod";

const router = Router();

const uploadsDir = path.join(os.tmpdir(), "verallia-cert", "pallets");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `pallet-import-${Date.now()}${path.extname(file.originalname)}`),
  }),
});

function formatRow(r: typeof palletQuantitiesTable.$inferSelect) {
  return {
    id: r.id,
    sapCode: r.sapCode,
    productName: r.productName,
    piecesPerPallet: r.piecesPerPallet,
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/pallet-quantities", async (_req, res) => {
  const rows = await db.select().from(palletQuantitiesTable).orderBy(palletQuantitiesTable.sapCode);
  res.json(rows.map(formatRow));
});

router.post("/pallet-quantities/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No Excel file uploaded" });
    return;
  }

  try {
    const xlsx = await import("xlsx");
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      res.status(400).json({ error: "Excel file is empty or could not be parsed" });
      return;
    }

    const entries: { sapCode: string; piecesPerPallet: number; productName: string | null }[] = [];

    for (const row of rows) {
      const sapCode = String(
        row["SAP"] ?? row["Código SAP"] ?? row["Codigo SAP"] ?? row["Código"] ?? row["Codigo"] ??
        row["sap_code"] ?? row["SAP Code"] ?? Object.values(row)[0] ?? ""
      ).trim();

      const piecesRaw =
        row["Peças por Pallet"] ?? row["Pecas por Pallet"] ?? row["Pcs/Pallet"] ??
        row["Pieces"] ?? row["Peças"] ?? row["Pecas"] ?? row["piecesPerPallet"] ??
        Object.values(row)[1] ?? 0;

      const piecesPerPallet = Number(piecesRaw);
      const productName = String(
        row["Produto"] ?? row["Product"] ?? row["Nome"] ?? row["Name"] ?? row["productName"] ?? ""
      ).trim() || null;

      if (!sapCode || isNaN(piecesPerPallet) || piecesPerPallet <= 0) continue;

      entries.push({ sapCode, piecesPerPallet, productName });
    }

    if (entries.length === 0) {
      res.status(400).json({ error: "No valid entries found. Expected columns: SAP code and Peças por Pallet" });
      return;
    }

    // Deduplicate by sapCode (last entry wins)
    const deduped = new Map<string, typeof entries[0]>();
    for (const e of entries) deduped.set(e.sapCode, e);
    const unique = Array.from(deduped.values());

    await db.delete(palletQuantitiesTable);
    for (const entry of unique) {
      await db.insert(palletQuantitiesTable).values(entry);
    }

    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      imported: entries.length,
      total: rows.length,
      message: `${entries.length} registros importados com sucesso`,
    });
  } catch (err) {
    req.log.error({ err }, "Error importing Excel");
    res.status(400).json({ error: "Failed to parse Excel file" });
  }
});

router.post("/pallet-quantities/add", async (req, res) => {
  const parsed = AddPalletQuantityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { sapCode, piecesPerPallet, productName } = parsed.data;

  const existing = await db
    .select()
    .from(palletQuantitiesTable)
    .where(eq(palletQuantitiesTable.sapCode, sapCode));

  if (existing.length > 0) {
    res.status(400).json({ error: `Código SAP ${sapCode} já existe na base` });
    return;
  }

  const [row] = await db
    .insert(palletQuantitiesTable)
    .values({ sapCode, piecesPerPallet, productName: productName ?? null })
    .returning();

  res.status(201).json(formatRow(row));
});

router.get("/pallet-quantities/:id", async (req, res) => {
  const parsed = GetPalletQuantityParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select()
    .from(palletQuantitiesTable)
    .where(eq(palletQuantitiesTable.id, parsed.data.id));

  if (!row) { res.status(404).json({ error: "Não encontrado" }); return; }

  res.json(formatRow(row));
});

router.patch("/pallet-quantities/:id", async (req, res) => {
  const paramsParsed = UpdatePalletQuantityParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const bodyParsed = UpdatePalletQuantityBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: bodyParsed.error.issues });
    return;
  }

  const updates: Partial<{ sapCode: string; productName: string | null; piecesPerPallet: number }> = {};
  if (bodyParsed.data.sapCode !== undefined) updates.sapCode = bodyParsed.data.sapCode;
  if (bodyParsed.data.productName !== undefined) updates.productName = bodyParsed.data.productName ?? null;
  if (bodyParsed.data.piecesPerPallet !== undefined) updates.piecesPerPallet = bodyParsed.data.piecesPerPallet;

  const [row] = await db
    .update(palletQuantitiesTable)
    .set(updates)
    .where(eq(palletQuantitiesTable.id, paramsParsed.data.id))
    .returning();

  if (!row) { res.status(404).json({ error: "Não encontrado" }); return; }

  res.json(formatRow(row));
});

router.delete("/pallet-quantities/:id", async (req, res) => {
  const parsed = DeletePalletQuantityParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .delete(palletQuantitiesTable)
    .where(eq(palletQuantitiesTable.id, parsed.data.id))
    .returning();

  if (!row) { res.status(404).json({ error: "Não encontrado" }); return; }

  res.status(204).send();
});

export default router;
