import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";
import { db } from "@workspace/db";
import { certificatesTable, historyTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const gcsClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as NonNullable<ConstructorParameters<typeof Storage>[0]>["credentials"],
  projectId: "",
});

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return gcsClient.bucket(bucketId);
}

async function main() {
  console.log("=== PDF Migration to GCS ===");

  // 1. Clean up stale history records (local path + file doesn't exist)
  const historyRows = await db.select().from(historyTable);
  let deletedHistory = 0;
  for (const row of historyRows) {
    const isLocalPath = row.generatedFilePath.startsWith("/");
    if (isLocalPath && !fs.existsSync(row.generatedFilePath)) {
      await db.delete(historyTable).where(eq(historyTable.id, row.id));
      console.log(`  Deleted stale history record #${row.id} (${row.sapCode} NF:${row.invoiceNumber})`);
      deletedHistory++;
    }
  }
  console.log(`Deleted ${deletedHistory} stale history record(s).`);

  // 2. Migrate certificates with local paths to GCS
  const certs = await db.select().from(certificatesTable);
  const bucket = getBucket();
  let migrated = 0;
  let skipped = 0;
  let missing = 0;

  for (const cert of certs) {
    // Already a GCS path (not starting with /)
    if (!cert.filePath.startsWith("/")) {
      skipped++;
      continue;
    }

    if (!fs.existsSync(cert.filePath)) {
      console.log(`  MISSING local file for cert #${cert.id}: ${path.basename(cert.filePath)}`);
      missing++;
      continue;
    }

    const gcsName = `certificates/${randomUUID()}-${path.basename(cert.filePath)}`;
    try {
      await bucket.upload(cert.filePath, { destination: gcsName });
      await db
        .update(certificatesTable)
        .set({ filePath: gcsName })
        .where(eq(certificatesTable.id, cert.id));
      console.log(`  Migrated cert #${cert.id} (${cert.sapCode} ${cert.productionDate}) → ${gcsName}`);
      migrated++;
    } catch (err) {
      console.error(`  ERROR migrating cert #${cert.id}:`, err);
    }
  }

  console.log(`\nDone: migrated=${migrated}, already-in-gcs=${skipped}, missing-local=${missing}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
