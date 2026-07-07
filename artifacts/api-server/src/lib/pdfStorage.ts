import fs from "fs";
import path from "path";
import { objectStorageClient } from "./objectStorage";

const LOCAL_KEY_PREFIX = "local/";

function storageRoot() {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads"));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "") || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "";
  return { url, serviceKey, bucket };
}

function isSupabaseStorageEnabled() {
  const { url, serviceKey, bucket } = supabaseConfig();
  return Boolean(url && serviceKey && bucket);
}

function bucketId() {
  return process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
}

export function isObjectStorageEnabled() {
  return bucketId().length > 0;
}

export function isLocalStorageKey(filePath: string) {
  return filePath.startsWith(LOCAL_KEY_PREFIX) || path.isAbsolute(filePath);
}

function resolveLocalPath(filePath: string) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(storageRoot(), filePath.slice(LOCAL_KEY_PREFIX.length));
}

function getBucket() {
  const id = bucketId();
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(id);
}

function encodeObjectPath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function supabaseHeaders(contentType?: string) {
  const { serviceKey } = supabaseConfig();
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    ...(contentType ? { "content-type": contentType } : {}),
  };
}

async function supabaseRequest(filePath: string, init: RequestInit) {
  const { url, bucket } = supabaseConfig();
  const objectUrl = `${url}/storage/v1/object/${bucket}/${encodeObjectPath(filePath)}`;
  const response = await fetch(objectUrl, init);

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase Storage error ${response.status}: ${message}`);
  }

  return response;
}

export async function savePdfFile(localPath: string, destination: string): Promise<string> {
  if (isSupabaseStorageEnabled()) {
    const buffer = await fs.promises.readFile(localPath);
    return savePdfBuffer(buffer, destination);
  }

  if (isObjectStorageEnabled()) {
    await getBucket().upload(localPath, { destination });
    return destination;
  }

  const key = `${LOCAL_KEY_PREFIX}${destination}`;
  const targetPath = resolveLocalPath(key);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await fs.promises.copyFile(localPath, targetPath);
  return key;
}

export async function savePdfBuffer(buffer: Buffer, destination: string): Promise<string> {
  if (isSupabaseStorageEnabled()) {
    await supabaseRequest(destination, {
      method: "POST",
      headers: supabaseHeaders("application/pdf"),
      body: buffer,
    });
    return destination;
  }

  if (isObjectStorageEnabled()) {
    await getBucket().file(destination).save(buffer, { contentType: "application/pdf" });
    return destination;
  }

  const key = `${LOCAL_KEY_PREFIX}${destination}`;
  const targetPath = resolveLocalPath(key);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);
  return key;
}

export async function readPdf(filePath: string): Promise<Buffer> {
  if (isLocalStorageKey(filePath)) {
    return fs.promises.readFile(resolveLocalPath(filePath));
  }

  if (isSupabaseStorageEnabled()) {
    const response = await supabaseRequest(filePath, {
      method: "GET",
      headers: supabaseHeaders(),
    });
    return Buffer.from(await response.arrayBuffer());
  }

  const [contents] = await getBucket().file(filePath).download();
  return contents;
}

export async function deletePdf(filePath: string): Promise<void> {
  try {
    if (isLocalStorageKey(filePath)) {
      await fs.promises.unlink(resolveLocalPath(filePath));
      return;
    }

    if (isSupabaseStorageEnabled()) {
      await supabaseRequest(filePath, {
        method: "DELETE",
        headers: supabaseHeaders(),
      });
      return;
    }

    await getBucket().file(filePath).delete();
  } catch {}
}

export function localStorageRoot() {
  return storageRoot();
}
