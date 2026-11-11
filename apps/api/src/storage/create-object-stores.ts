import { R2ObjectStorage } from './r2-object-storage';

export interface ObjectStoreBindings { FILES: R2Bucket; QUARANTINE_FILES: R2Bucket }
export function createObjectStores(bindings: ObjectStoreBindings) {
  return {
    published: new R2ObjectStorage(bindings.FILES),
    quarantine: new R2ObjectStorage(bindings.QUARANTINE_FILES),
  } as const;
}
