import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  sapCode: text("sap_code").notNull(),
  productionDate: text("production_date").notNull(),
  productName: text("product_name"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;

export const palletQuantitiesTable = pgTable("pallet_quantities", {
  id: serial("id").primaryKey(),
  sapCode: text("sap_code").notNull().unique(),
  productName: text("product_name"),
  piecesPerPallet: integer("pieces_per_pallet").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPalletQuantitySchema = createInsertSchema(palletQuantitiesTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertPalletQuantity = z.infer<typeof insertPalletQuantitySchema>;
export type PalletQuantity = typeof palletQuantitiesTable.$inferSelect;

export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").notNull(),
  sapCode: text("sap_code").notNull(),
  productName: text("product_name"),
  productionDate: text("production_date").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  pallets: integer("pallets").notNull(),
  pieces: integer("pieces").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  userName: text("user_name").notNull(),
  generatedFilePath: text("generated_file_path").notNull(),
});

export const insertHistorySchema = createInsertSchema(historyTable).omit({
  id: true,
  generatedAt: true,
});
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
