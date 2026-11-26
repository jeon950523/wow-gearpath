export type RewardKind='gold'|'items'|'choices'|'currencies';
export interface RewardRow {
  name:string|null;
  quantity:number;
  itemId?:number;
  currencyId?:number;
  factionId?:number|null;
  ilvl?:number|null;
}
export interface RewardGroup {
  state:'observed'|'zeroUnverified'|'incomplete'|'uncollected'|'failed';
  observedAt:string|null;
  value?:number|null;
  count?:number|null;
  rows?:RewardRow[];
}
export type WorldQuestRow=Record<RewardKind,RewardGroup>&{
  questId:number;
  title:string|null;
  zoneName:string|null;
  expiresAt:string|null;
  completed:boolean|null;
  activeUnverified:boolean;
  cached?:Partial<Record<RewardKind,RewardGroup>>;
};
export interface WorldQuestScan {
  observedAt:string;
  state:'observed'|'incomplete'|'uncollected'|'failed';
  coverage:'seedMapsOnly'|'seedPlusDescendantZones';
  maps:{status:string}[];
  discoveryPartial:boolean;
  mapExpansion:string;
  rows:WorldQuestRow[];
}
interface Scope {
  worldQuests?:WorldQuestScan;
  worldQuestEnvelope?:string;
  worldQuestPatch?:string|null;
  worldQuestHistory?:boolean;
  worldQuestConflict?:boolean;
}
export const rewardKinds:readonly RewardKind[];
export const worldQuestTtl:number;
export function validateWorldQuests(scan:unknown,outerObservedAt:string,now?:number|Date):WorldQuestScan;
export function mergeWorldQuestScan<T extends object>(previous:T|null,incoming:T):T&Scope;
export function analyzeWorldQuests(snapshot:Scope,now:number,currentPatch:string|null):{
  scan:WorldQuestScan;
  rows:{row:WorldQuestRow;active:boolean;included:RewardKind[];locationUsable:boolean}[];
  historical:boolean;
  conflict:boolean;
  nextRefresh:number;
  totals:{goldCopper:number|null;itemCount:number|null;currencies:{
    currencyId:number;name:string|null;quantity:number;factionId:number|null;
  }[]};
}|null;
