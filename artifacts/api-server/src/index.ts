import fs from "fs";
import path from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { certificatesTable, historyTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "./lib/objectStorage";

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return null;
  return objectStorageClient.bucket(bucketId);
}

/**
 * Remove history records whose generated PDF no longer exists anywhere
 * (local file missing AND not a GCS path).
 */
async function cleanupStaleHistory() {
  try {
    const rows = await db.select().from(historyTable);
    for (const row of rows) {
      const isLocal = row.generatedFilePath.startsWith("/");
      if (isLocal && !fs.existsSync(row.generatedFilePath)) {
        await db.delete(historyTable).where(eq(historyTable.id, row.id));
        logger.info({ id: row.id, sapCode: row.sapCode }, "Removed stale history record (local file missing)");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Startup history cleanup failed (non-fatal)");
  }
}

/**
 * For every certificate whose filePath is a legacy local path,
 * find the matching GCS object (uploaded by the dev migration) and
 * update the DB record so the production server can serve it.
 *
 * Matching key: the local filename basename is present as a suffix
 * in the GCS object name (certificates/<uuid>-<basename>).
 */
async function migrateCertPathsToGcs() {
  try {
    const bucket = getBucket();
    if (!bucket) return;

    const certs = await db.select().from(certificatesTable);
    const localPathCerts = certs.filter((c) => c.filePath.startsWith("/"));
    if (localPathCerts.length === 0) return;

    logger.info({ count: localPathCerts.length }, "Found certs with legacy local paths — scanning GCS for matches");

    const [gcsFiles] = await bucket.getFiles({ prefix: "certificates/" });

    for (const cert of localPathCerts) {
      const basename = path.basename(cert.filePath);

      // Check local filesystem first (dev environment)
      if (fs.existsSync(cert.filePath)) {
        // Upload to GCS from local file
        const gcsName = `certificates/${cert.id}-${basename}`;
        try {
          await bucket.upload(cert.filePath, { destination: gcsName });
          await db.update(certificatesTable).set({ filePath: gcsName }).where(eq(certificatesTable.id, cert.id));
          logger.info({ certId: cert.id, gcsName }, "Uploaded cert PDF to GCS from local file");
        } catch (err) {
          logger.warn({ err, certId: cert.id }, "Failed to upload local cert to GCS");
        }
        continue;
      }

      // Production: find matching GCS object by basename suffix
      const match = gcsFiles.find((f) => f.name.endsWith(basename));
      if (match) {
        await db.update(certificatesTable).set({ filePath: match.name }).where(eq(certificatesTable.id, cert.id));
        logger.info({ certId: cert.id, gcsName: match.name }, "Resolved cert GCS path from existing object");
      } else {
        logger.warn({ certId: cert.id, basename }, "No GCS object found for cert — user must re-upload");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Startup cert path migration failed (non-fatal)");
  }
}

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run startup migrations async (non-blocking)
  Promise.all([cleanupStaleHistory(), migrateCertPathsToGcs()]).catch((e) =>
    logger.warn({ err: e }, "Startup migrations failed")
  );
});
