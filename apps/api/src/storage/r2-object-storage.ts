import type { ObjectMetadata, ObjectStorage, StoredObject, StoredObjectMetadata } from './object-storage';

const checksumPattern = /^[a-f0-9]{64}$/;
function normalize(object: R2Object): StoredObjectMetadata {
  const checksumSha256 = object.customMetadata?.sha256;
  if (!checksumSha256 || !checksumPattern.test(checksumSha256)) {
    throw new Error('Stored object metadata is invalid.');
  }
  return {
    checksumSha256,
    contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.etag,
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
  };
}

export class R2ObjectStorage implements ObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}
  async put(
    key: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | string,
    metadata: ObjectMetadata,
  ) {
    if (!checksumPattern.test(metadata.checksumSha256)) {
      throw new Error('Stored object metadata is invalid.');
    }
    await this.bucket.put(key, body, {
      customMetadata: { sha256: metadata.checksumSha256 },
      httpMetadata: { contentType: metadata.contentType || 'application/octet-stream' },
    });
  }
  async head(key: string) {
    const object = await this.bucket.head(key);
    return object ? normalize(object) : null;
  }
  async get(key: string): Promise<StoredObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return { ...normalize(object), body: object.body as ReadableStream<Uint8Array> };
  }
  async delete(key: string) { await this.bucket.delete(key); }
}
