export interface RetailRealm {
  slug: string;
  name: string;
}

export interface RetailSnapshot {
  schemaVersion: 1;
  region: 'kr';
  realm: string;
  name: string;
  seasonId: string;
  source: 'blizzard';
  profile: {race: string|null; className: string|null; specialization: string|null; level: number|null};
  fetchedAt: string;
  observedAt: string;
  weaponMode: 'one-hand'|'two-hand'|'dual-wield'|'unknown';
  reportedEquippedAverage: number|null;
  equipment: Array<{slot: string; itemId: number; name: string; ilvl: number; track: null; rank: null; inventoryType: string|null; quality: string|null; icon: string|null}>;
  resources: Record<string, never>;
  progress: null;
}

export function createBlizzardClient(options?: {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}): {
  realms(): Promise<RetailRealm[]>;
  character(realm: string, name: string, options?: {media?: boolean}): Promise<RetailSnapshot>;
};

export function normalize(profile: unknown, equipment: unknown, context: {realm: string; name: string; observedAt: string}): RetailSnapshot;
