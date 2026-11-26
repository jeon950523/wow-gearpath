import {season} from './rules.mjs';

export const maxUpgradeDiagnosticBytes=64*1024;
const record=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const integer=(value,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value) && value>=min && value<=max;
const optional=(value,check)=>value===null || check(value);
const flag=value=>optional(value,v=>typeof v==='boolean');

function requireValid(ok,field) {
  if (!ok) throw new Error('강화 진단 형식 오류 · '+field);
}
function exactKeys(value,fields,section) {
  requireValid(record(value) && Object.keys(value).length===fields.length &&
    fields.every(key=>Object.hasOwn(value,key)),section);
}
function checkCosts(rows) {
  requireValid(Array.isArray(rows) && rows.length<=20,'비용 목록');
  const seen=new Set();
  for (const row of rows) {
    exactKeys(row,['id','cost','discounted','watermark','partialTwoHand','accountWide','characterMeets'],'비용 필드');
    requireValid(integer(row.id,1,2147483647) && !seen.has(row.id) && integer(row.cost,0) &&
      optional(row.watermark,v=>integer(v,0,10000)) &&
      [row.discounted,row.partialTwoHand,row.accountWide,row.characterMeets].every(flag),'비용 값');
    seen.add(row.id);
  }
}

export function parseUpgradeDiagnostic(raw,{now=Date.now()}={}) {
  requireValid(typeof raw==='string' && raw.length<=maxUpgradeDiagnosticBytes &&
    new TextEncoder().encode(raw).length<=maxUpgradeDiagnosticBytes,'64 KiB 용량');
  let data;
  try { data=JSON.parse(raw); } catch { requireValid(false,'JSON'); }
  exactKeys(data,['kind','schemaVersion','diagnosticVersion','context','observationCount','captureCount','observations'],'진단 헤더');
  requireValid(data.kind==='wgg-upgrade-diagnostics' && data.schemaVersion===1 &&
    data.diagnosticVersion==='0.2.0','진단 버전');
  requireValid(Array.isArray(data.observations) && data.observations.length<=64 &&
    data.observationCount===data.observations.length && integer(data.captureCount,0,256),'관측 개수');
  const context=data.context;
  if (context===null) requireValid(!data.observations.length,'수집 컨텍스트');
  else {
    exactKeys(context,['patch','build','regionID','level','specializationIndex','specializationId','lootSpecializationId','seasonId'],'컨텍스트 필드');
    requireValid(context.patch===season.patch && context.seasonId===season.id && context.regionID===2 &&
      integer(context.build,1,2147483647) && integer(context.level,1,1000) &&
      integer(context.specializationIndex,1,100) && integer(context.specializationId,1,2147483647) &&
      integer(context.lootSpecializationId,0,2147483647),'수집 컨텍스트');
  }
  let captures=0;
  for (const entry of data.observations) {
    exactKeys(entry,['captures','observation'],'관측 항목');
    requireValid(integer(entry.captures,1,256),'캡처 횟수');
    captures+=entry.captures;
    const row=entry.observation;
    exactKeys(row,['state','baseCostState','identityState','patch','build','locale','regionID','observedAt',
      'itemId','currentRank','maxRank','itemLevel','pvp','upgradeable','watermarkSlot','characterWatermark',
      'accountWatermark','nextRank','increment','moneyCopper','failurePresent','currencies','items'],'관측 필드');
    requireValid(row.patch===context.patch && row.build===context.build && row.regionID===context.regionID &&
      integer(row.observedAt,1,253402300799) && row.observedAt*1000<=+now+300000 &&
      optional(row.locale,v=>typeof v==='string' && /^[a-zA-Z]{2}[A-Z]{2}$/.test(v)),'관측 시각과 문맥');
    requireValid(row.baseCostState==='unobserved' && row.identityState==='unresolved' &&
      integer(row.itemId,1,2147483647) && integer(row.maxRank,1,20) && integer(row.currentRank,0,row.maxRank) &&
      optional(row.itemLevel,v=>integer(v,1,10000)) && [row.pvp,row.upgradeable,row.failurePresent].every(flag) &&
      optional(row.watermarkSlot,v=>integer(v,0,1000)) &&
      [row.characterWatermark,row.accountWatermark].every(value=>optional(value,v=>integer(v,0,10000))),'장비 및 watermark');
    if (row.state==='maxRank') {
      requireValid(row.currentRank===row.maxRank &&
        [row.nextRank,row.increment,row.moneyCopper,row.currencies,row.items,row.failurePresent].every(v=>v===null),'최대 단계');
    } else {
      requireValid(row.state==='costsObserved' && row.nextRank===row.currentRank+1 &&
        row.nextRank<=row.maxRank && integer(row.increment,1,10000) && integer(row.moneyCopper,0),'다음 한 단계 비용');
      checkCosts(row.currencies);
      checkCosts(row.items);
    }
  }
  requireValid(captures===data.captureCount,'캡처 합계');
  return data;
}

// The diagnosis has no public character key. These are comparison candidates only.
export function upgradeSlotCandidates(diagnostic,observation,snapshot) {
  const context=diagnostic.context;
  const snapshotAt=Date.parse(snapshot.observedAt);
  if (!context || !Number.isFinite(snapshotAt) || !diagnostic.observations.some(entry=>entry.observation===observation) ||
      snapshot.region!=='kr' || snapshot.patch!==context.patch || snapshot.seasonId!==context.seasonId ||
      snapshot.specializationId!==context.specializationId || snapshot.level!==context.level ||
      observation.itemLevel===null || observation.pvp!==false ||
      Math.abs(snapshotAt-observation.observedAt*1000)>15*60*1000) return [];
  return snapshot.equipment.filter(item=>item.itemId===observation.itemId &&
    item.rank===observation.currentRank && item.maxRank===observation.maxRank &&
    item.ilvl===observation.itemLevel).map(item=>item.slot);
}
