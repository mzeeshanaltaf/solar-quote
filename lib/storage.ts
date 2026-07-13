import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// S3-compatible object storage (self-hosted MinIO on Coolify) for bill files.
// Bills are PII, so the bucket is private and every read/write is server-side —
// the browser never touches storage directly (the admin route streams bytes
// through the app). Replaces the former Vercel Blob store; the object key is what
// we persist to QuoteSession.blobUrl.

const bucket = process.env.S3_BUCKET ?? "bills";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  // MinIO serves buckets path-style (endpoint/bucket/key), not virtual-hosted.
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

/** Store bytes under `key` and return the key (persisted as the bill reference). */
export async function putBill(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/** Read the object at `key` back into a Buffer (server-side only). */
export async function getBillBytes(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/** Delete the object at `key`. Best-effort cleanup when a session is removed. */
export async function deleteBill(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
