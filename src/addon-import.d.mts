import type {diagnose} from './engine.mjs';
type Snapshot = Parameters<typeof diagnose>[0];
export const maxImportBytes: number;
export function parseAddon(raw: string, options?: {
  against?: Snapshot|null;
  now?: Date|number;
  realms?: Array<{slug:string;name:string}>;
}): Snapshot;
export function mergeSnapshots(base: Snapshot|null, addon: Snapshot, options?: {prefer?: 'auto'|'base'|'addon'}): Snapshot;
