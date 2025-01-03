// src/types/cloudflare.d.ts
interface DurableObjectNamespace {
    newUniqueId(): DurableObjectId;
    idFromName(name: string): DurableObjectId;
    idFromString(hexId: string): DurableObjectId;
    get(id: DurableObjectId): DurableObject;
  }