import type {diagnose} from './engine.mjs';
type Snapshot = Parameters<typeof diagnose>[0];
export interface AddonResource {
  source:'addon';
  observedAt:string;
  state:'observed'|'uncollected'|'failed'|'incomplete'|'locked';
  value:number|null;
  kind?:'currency'|'item'|'money'|null;
  scope?:'character'|'warband'|'unknown'|null;
  currencyId?:number|null;
  itemId?:number|null;
  name?:string|null;
  maxQuantity?:number|null;
  weeklyEarned?:number|null;
  weeklyLimit?:number|null;
}
export interface AddonCharacterDetails {
  classFile?:string|null; classId?:number|null; className?:string|null; level?:number|null;
  specializationId?:number|null; specializationName?:string|null; role?:'TANK'|'HEALER'|'DAMAGER'|'NONE'|null;
}
export interface AddonEquipmentDetails {
  maxRank?:number|null; setId?:number|null; bonusIds?:number[]|null;
  upgradeStatus?:'observed'|'unrecognized'|'unavailable'|'not-observed'|'ambiguous'|null; upgradeText?:string|null;
}
export const maxImportBytes: number;
export function parseAddon(raw: string, options?: {
  against?: Snapshot|null;
  now?: Date|number;
  realms?: Array<{slug:string;name:string}>;
}): Snapshot;
export function mergeSnapshots(base: Snapshot|null, addon: Snapshot, options?: {prefer?: 'auto'|'base'|'addon'}): Snapshot;
