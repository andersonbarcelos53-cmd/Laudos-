import { Router } from "express";
import { certificatesTable, db, desc, historyTable, palletQuantitiesTable, sql } from "@workspace/db";

const router = Router();

router.get("/stats", async (_req, res) => {
  const [certCount] = await db.select({ count: sql<number>`count(*)::int` }).from(certificatesTable);
  const [sapCount] = await db
    .select({ count: sql<number>`count(distinct sap_code)::int` })
    .from(certificatesTable);
  const [histCount] = await db.select({ count: sql<number>`count(*)::int` }).from(historyTable);
  const [palletCount] = await db.select({ count: sql<number>`count(*)::int` }).from(palletQuantitiesTable);

  const recentHistory = await db
    .select()
    .from(historyTable)
    .orderBy(desc(historyTable.generatedAt))
    .limit(5);

  res.json({
    totalCertificates: certCount.count,
    totalSapCodes: sapCount.count,
    totalHistoryRecords: histCount.count,
    totalPalletEntries: palletCount.count,
    recentHistory: recentHistory.map((r) => ({
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
    })),
  });
});

export default router;
