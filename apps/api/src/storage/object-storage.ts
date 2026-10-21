export interface ObjectMetadata {
  checksumSha256: string;
  contentType: string;
}
export interface StoredObjectMetadata extends ObjectMetadata {
  etag: string;
  size: number;
  uploadedAt: string;
}
export interface StoredObject extends StoredObjectMetadata {
  body: ReadableStream<Uint8Array>;
}
export interface ObjectStorage {
  put(
    key: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | string,
    metadata: ObjectMetadata,
  ): Promise<void>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
