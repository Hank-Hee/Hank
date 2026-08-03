import { describe, expect, it, vi } from 'vitest';
import { createObjectStores } from '../src/storage/create-object-stores';
import { R2ObjectStorage } from '../src/storage/r2-object-storage';
import { createApp } from '../src/app';

const checksum = 'a'.repeat(64);
function bucket(name: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); },
  });
  return {
    name,
    put: vi.fn(async () => undefined),
    head: vi.fn(async () => ({
      customMetadata: { sha256: checksum },
      etag: `${name}-etag`,
      httpMetadata: { contentType: 'application/pdf' },
      size: 1,
      uploaded: new Date('2026-07-31T00:00:00.000Z'),
    })),
    get: vi.fn(async () => ({
      body,
      customMetadata: { sha256: checksum },
      etag: `${name}-etag`,
      httpMetadata: { contentType: 'application/pdf' },
      size: 1,
      uploaded: new Date('2026-07-31T00:00:00.000Z'),
    })),
    delete: vi.fn(async () => undefined),
  };
}

describe('private R2 adapters', () => {
  it('uses fixed published and quarantine bindings without caller bucket selection', async () => {
    const published = bucket('published');
    const quarantine = bucket('quarantine');
    const stores = createObjectStores({
      FILES: published as never,
      QUARANTINE_FILES: quarantine as never,
    });
    await stores.published.head('published-key');
    await stores.quarantine.head('quarantine-key');
    expect(published.head).toHaveBeenCalledWith('published-key');
    expect(quarantine.head).toHaveBeenCalledWith('quarantine-key');
    expect(published.head).not.toHaveBeenCalledWith('quarantine-key');
  });

  it('normalizes transport metadata and exposes a Uint8Array stream', async () => {
    const store = new R2ObjectStorage(bucket('published') as never);
    const object = await store.get('key');
    expect(object).toMatchObject({
      checksumSha256: checksum,
      contentType: 'application/pdf',
      etag: 'published-etag',
      size: 1,
    });
    expect(object?.body).toBeInstanceOf(ReadableStream);
  });

  it.each([undefined, 'bad-checksum'])('fails closed for checksum %s', async (sha256) => {
    const unsafe = bucket('unsafe');
    unsafe.head.mockResolvedValue({
      customMetadata: sha256 === undefined ? {} : { sha256 },
      etag: 'etag',
      httpMetadata: {},
      size: 1,
      uploaded: new Date(),
    } as never);
    await expect(new R2ObjectStorage(unsafe as never).head('key')).rejects.toThrow(
      'Stored object metadata is invalid.',
    );
  });

  it('uses application/octet-stream when content type is absent', async () => {
    const value = bucket('published');
    value.head.mockResolvedValue({
      customMetadata: { sha256: checksum }, etag: 'etag', httpMetadata: {}, size: 1, uploaded: new Date(),
    } as never);
    await expect(new R2ObjectStorage(value as never).head('key')).resolves.toMatchObject({
      contentType: 'application/octet-stream',
    });
  });

  it('writes checksum metadata and deletes only through its fixed bucket', async () => {
    const value = bucket('published');
    const store = new R2ObjectStorage(value as never);
    await store.put('key', 'body', { checksumSha256: checksum, contentType: '' });
    await store.delete('key');
    expect(value.put).toHaveBeenCalledWith('key', 'body', {
      customMetadata: { sha256: checksum },
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    expect(value.delete).toHaveBeenCalledWith('key');
  });

  it('does not create a public file route', async () => {
    const response = await createApp().request('/api/v1/files/anything');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
