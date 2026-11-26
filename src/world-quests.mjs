import Ajv2020 from 'ajv/dist/2020.js';
import snapshotSchema from '../contracts/snapshot-v1.schema.json' with {type:'json'};

const ajv = new Ajv2020({strict:false,validateFormats:false});
ajv.addSchema(snapshotSchema);
const shape = ajv.getSchema(snapshotSchema.$id+'#/$defs/worldQuests');
export const rewardKinds = ['gold','items','choices','currencies'];
export const worldQuestTtl = 15 * 60 * 1000;
const confirmed = state => state==='observed' || state==='zeroUnverified';
const requireValid = (condition, field) => {
  if (!condition) throw new Error('전역퀘 데이터 오류: '+field);
};
const utc = value => {
  const time=Date.parse(value);
  requireValid(typeof value==='string' && Number.isFinite(time) &&
    new Date(time).toISOString().replace('.000Z','Z')===value,'UTC 시각');
  return time;
};
const unique = (rows,key) => new Set(rows.map(row=>row[key])).size===rows.length;

function checkReward(group, kind, start, end, cached) {
  const at=group.observedAt===null ? null : utc(group.observedAt);
  requireValid(at===null ? !confirmed(group.state) : at<=end && (cached || at>=start),'보상 관측 시각');
  if (cached) requireValid(group.state==='observed','캐시 상태');
  if (kind==='gold') {
    requireValid((group.state==='observed')===(group.value!==null),'골드 상태');
    return;
  }
  const {state,count,rows}=group;
  requireValid(count===null ? rows.length===0 : rows.length<=count,'보상 개수');
  if (state==='observed') requireValid(count===rows.length,'관측 보상 개수');
  if (state==='uncollected' || state==='failed') requireValid(count===null,'미관측 보상 개수');
  if (kind==='currencies') {
    requireValid(unique(rows,'currencyId'),'화폐 ID 중복');
    return;
  }
  for (const item of rows) {
    const details=[item.detailObservedAt,item.equipLoc,item.classId,item.subclassId];
    if (item.detailState==='observed') {
      requireValid(at!==null && details.every(value=>value!==null) &&
        utc(item.detailObservedAt)>=at && utc(item.detailObservedAt)<=end,'아이템 상세');
    } else requireValid(details.every(value=>value===null),'미관측 아이템 상세');
  }
}

export function validateWorldQuests(scan, outerObservedAt, now=Date.now()) {
  requireValid(shape(scan), '형식 '+(shape.errors?.[0]?.instancePath || '/worldQuests'));
  const start=utc(scan.discoveredAt), end=utc(scan.observedAt), outer=Date.parse(outerObservedAt);
  requireValid(start<=end && end<=outer && outer<=+now+300000,'스캔 시각 순서');
  requireValid(unique(scan.rows,'questId') && unique(scan.maps,'mapId'),'퀘스트 또는 지도 ID 중복');
  requireValid(!['failed','uncollected'].includes(scan.state) || !scan.rows.length,'미수집 목록');
  requireValid(scan.coverage!=='seedPlusDescendantZones' || ['ok','partial','limited'].includes(scan.mapExpansion),'스캔 범위');
  const scannedMaps=new Set();
  for (const map of scan.maps) {
    requireValid((map.status==='ok')===(map.count!==null),'지도 상태');
    if (map.status==='ok') scannedMaps.add(map.mapId);
  }
  const sources={explicit:'quest',scanOnly:'scan',zoneApiResolved:'questZone',hierarchyResolved:'questHierarchy',ambiguous:null,limited:null};
  let totalGold=0;
  const totalCurrency=new Map();
  for (const row of scan.rows) {
    const active=utc(row.activeObservedAt);
    requireValid(start<=active && active<=end,'활성 관측 시각');
    requireValid(row.scanMaps.length && row.scanMaps.every(id=>scannedMaps.has(id)),'발견 지도 출처');
    requireValid(row.mapSource===sources[row.mapStatus] && (row.mapId===null)===(row.mapSource===null) &&
      (row.mapId!==null || row.zoneName===null) && row.candidateLimited===(row.mapStatus==='limited'),'위치 상태');
    const {mapStatus,mapCandidates,mapId}=row;
    if (mapStatus==='explicit') requireValid(mapCandidates.length===1 && mapCandidates[0]===mapId,'직접 지도');
    if (mapStatus==='scanOnly') requireValid(!mapCandidates.length && row.scanMaps.includes(mapId),'스캔 지도');
    if (mapStatus==='hierarchyResolved') requireValid(mapCandidates.length>=2 && mapCandidates.includes(mapId),'계층 지도');
    if (mapStatus==='zoneApiResolved') requireValid(mapCandidates.length>=2 && row.questZoneId===mapId && row.zoneQueryStatus==='ok','지역 API');
    if (mapStatus==='ambiguous') requireValid(mapCandidates.length>=2,'위치 후보');
    requireValid((row.expiresAt===null)===(row.expiryObservedAt===null),'만료 관측 쌍');
    const expiry=row.expiresAt===null ? null : utc(row.expiresAt);
    if (expiry!==null) {
      const at=utc(row.expiryObservedAt);
      requireValid(start<=at && at<=end && expiry>at && expiry-at<=604800000,'만료 범위');
    }
    requireValid(row.completed!==null || row.activeUnverified,'완료 미확인');
    for (const kind of rewardKinds) {
      const group=row[kind];
      checkReward(group,kind,start,end,false);
      requireValid(!confirmed(group.state) || (row.ready===true && row.completed===false && !row.activeUnverified),'현재 보상 준비 및 활성 상태');
      const cached=row.cached?.[kind];
      if (cached) {
        requireValid(scan.context!==null && row.completed===false && !row.activeUnverified &&
          expiry!==null && expiry>end && group.state!=='observed','캐시 참조 조건');
        checkReward(cached,kind,start,end,true);
      }
    }
    if (row.gold.state==='observed') {
      totalGold+=row.gold.value;
      requireValid(Number.isSafeInteger(totalGold),'골드 합계 범위');
    }
    if (row.currencies.state==='observed') for (const currency of row.currencies.rows) {
      const total=(totalCurrency.get(currency.currencyId)??0)+currency.quantity;
      requireValid(Number.isSafeInteger(total),'화폐 합계 범위');
      totalCurrency.set(currency.currencyId,total);
    }
  }
  if (scan.state==='observed') requireValid(!scan.discoveryPartial && scan.mapExpansion==='ok' &&
    scan.maps.length>0 && scan.maps.every(map=>map.status==='ok') &&
    scan.rows.every(row=>row.completed===false && !row.activeUnverified && row.mapId!==null &&
      row.zoneName!==null && row.title!==null && row.expiresAt!==null && row.ready===true &&
      rewardKinds.every(kind=>row[kind].state==='observed') &&
      [...row.items.rows,...row.choices.rows].every(item=>item.detailState==='observed')),'관측 완전성');
  return scan;
}

const canonical = value => JSON.stringify(value,(_key,part)=>
  part && typeof part==='object' && !Array.isArray(part)
    ? Object.fromEntries(Object.keys(part).sort().map(key=>[key,part[key]])) : part);
const contextOf = snapshot => snapshot.worldQuests?.context;
const specializationOf = snapshot => snapshot.specializationId ?? snapshot.profile?.specializationId ?? null;

export function mergeWorldQuestScan(previous, incoming) {
  if (!previous?.worldQuests) return incoming;
  const old=previous.worldQuests, next=incoming.worldQuests;
  if (next && next.observedAt>old.observedAt) {
    const olderEnvelope=Date.parse(incoming.observedAt)<Date.parse(previous.observedAt);
    const changed=previous.worldQuestHistory || canonical(old.context)!==canonical(next.context) ||
      specializationOf(previous)!==specializationOf(incoming) || previous.patch!==incoming.patch;
    return olderEnvelope && changed ? {...incoming,worldQuestHistory:true} : incoming;
  }
  if (next && canonical(old)===canonical(next) && previous.patch===incoming.patch &&
      specializationOf(previous)===specializationOf(incoming) && !previous.worldQuestHistory) return incoming;
  const newerEnvelope=Date.parse(incoming.observedAt)>=Date.parse(previous.observedAt);
  const conflict=next?.observedAt===old.observedAt;
  const contextChanged=canonical(contextOf(previous))!==canonical(contextOf(incoming)) ||
    specializationOf(previous)!==specializationOf(incoming) || previous.patch!==incoming.patch;
  return {...incoming,worldQuests:old,
    worldQuestEnvelope:previous.worldQuestEnvelope??previous.observedAt,
    worldQuestPatch:previous.worldQuestPatch===undefined ? previous.patch : previous.worldQuestPatch,
    worldQuestHistory:Boolean(previous.worldQuestHistory || conflict || (newerEnvelope && contextChanged)),
    worldQuestConflict:Boolean(previous.worldQuestConflict || conflict)};
}

export function analyzeWorldQuests(snapshot, now, currentPatch) {
  const scan=snapshot.worldQuests;
  if (!scan) return null;
  let nextRefresh=Infinity;
  const fresh=at=>{
    if (at===null) return false;
    const observed=Date.parse(at), deadline=observed+worldQuestTtl;
    if (observed>now) {nextRefresh=Math.min(nextRefresh,observed);return false;}
    if (deadline<=now) return false;
    nextRefresh=Math.min(nextRefresh,deadline);
    return true;
  };
  const patch=snapshot.worldQuestPatch===undefined ? snapshot.patch : snapshot.worldQuestPatch;
  const historical=Boolean(snapshot.worldQuestHistory || currentPatch===null || patch!==currentPatch ||
    !scan.context || !fresh(scan.observedAt));
  const totals={goldCopper:null,itemCount:null,currencies:[]};
  const currencies=new Map();
  const rows=scan.rows.map(row=>{
    const active=!historical && !row.activeUnverified && row.completed===false &&
      fresh(row.activeObservedAt) && row.expiresAt!==null && Date.parse(row.expiresAt)>now &&
      fresh(row.expiryObservedAt);
    if (active) nextRefresh=Math.min(nextRefresh,Date.parse(row.expiresAt));
    const included=rewardKinds.filter(kind=>active && row[kind].state==='observed' && fresh(row[kind].observedAt));
    if (included.includes('gold')) totals.goldCopper=(totals.goldCopper??0)+row.gold.value;
    if (included.includes('items')) totals.itemCount=(totals.itemCount??0)+row.items.rows.reduce((sum,item)=>sum+item.quantity,0);
    if (included.includes('currencies')) for (const currency of row.currencies.rows) {
      const key=currency.currencyId;
      const previous=currencies.get(key);
      currencies.set(key,{...currency,name:previous?.name??currency.name,
        factionId:previous && previous.factionId!==currency.factionId ? null : currency.factionId,
        quantity:(previous?.quantity??0)+currency.quantity});
    }
    return {row,active,included,locationUsable:active && ['explicit','zoneApiResolved','hierarchyResolved'].includes(row.mapStatus) && row.zoneName!==null};
  });
  totals.currencies=[...currencies.values()];
  return {scan,rows,totals,historical,nextRefresh,conflict:Boolean(snapshot.worldQuestConflict)};
}
