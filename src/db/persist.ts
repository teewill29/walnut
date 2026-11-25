export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

// Ask the browser not to clear our data when space runs low. DATA_MODEL.md
// says to ask on first launch. We ask again on later launches until it's
// granted, because some browsers only grant it once the app has been used.
export async function requestPersistentStorage(): Promise<PersistState> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

export async function getPersistState(): Promise<PersistState> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persisted) return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}
