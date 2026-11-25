import {validate, SLOTS} from './engine.mjs';
import {season} from './rules.mjs';

export const maxImportBytes = 256 * 1024;
const sameName = (a,b) => a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value,max=120) => typeof value === 'string' && value.length <= max ? value : null;
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const statusNames = ['observed','uncollected','failed','incomplete','locked'];
const resourceKeys = ['cofferKey','cofferKeyShard','gold','venomstone','adventurerCrest','veteranCrest','championCrest','heroCrest','mythCrest','spark','craftingReagent'];
const progressKeys = ['maxDelveTier','stableTier','vaultWorld','vaultDungeon','vaultRaid','venomstoneUnlocked'];
const ensure = (condition,message) => { if (!condition) throw new Error(message); };
const tracks = new Set(['explorer','adventurer','veteran','champion','hero','myth']);
const upgradeStates = ['observed','unrecognized','unavailable','not-observed','ambiguous'];
const optional = (row,key,valid) => {
  if (!Object.hasOwn(row,key)) return {};
  const value=row[key];
  ensure(value===null || valid(value),`잘못된 애드온 필드: ${key}`);
  return {[key]:value};
};
const boundedInt = (max) => value => Number.isSafeInteger(value) && value>0 && value<=max;
const boundedText = max => value => typeof value==='string' && value.length>0 && value.length<=max;
const characterFields = {
  classFile:value=>typeof value==='string' && /^[A-Z][A-Z0-9_]{0,31}$/.test(value),
  classId:boundedInt(255), className:boundedText(80), level:boundedInt(255),
  specializationId:boundedInt(65535), specializationName:boundedText(80),
  role:value=>['TANK','HEALER','DAMAGER','NONE'].includes(value),
};
const itemFields = {
  maxRank:boundedInt(20), setId:boundedInt(2147483647),
  bonusIds:value=>Array.isArray(value) && value.length<=64 && value.every(boundedInt(2147483647)),
  upgradeStatus:value=>upgradeStates.includes(value),
  upgradeText:boundedText(400),
};
const pick = (row,fields) => Object.assign({},...Object.entries(fields).map(([key,valid])=>optional(row,key,valid)));
const provenance = row => row ? {source:row.source,observedAt:row.observedAt}:null;
const observedProgress = (snapshot,key) => snapshot.fieldSources?.progress?.[key] ?? provenance(snapshot.progress);

export function parseAddon(raw, {against=null, now=Date.now(), realms=[]}={}) {
  ensure(typeof raw==='string' && new TextEncoder().encode(raw).length<=maxImportBytes,'JSON은 256 KiB 이하로 가져오세요.');
  let data;
  try { data=JSON.parse(raw); } catch { throw new Error('JSON 형식이 손상됐습니다. 애드온에서 다시 내보내세요.'); }
  ensure(isRecord(data) && data.schemaVersion===1,'지원하는 스냅샷 버전은 v1입니다.');
  ensure(data.source==='addon' && (data.addonVersion==null || /^\d+\.\d+\.\d+$/.test(data.addonVersion)),'애드온 내보내기 형식을 확인하세요.');
  ensure(data.region==='kr' && typeof data.realm==='string' && /^[\p{L}\p{N}-]{1,80}$/u.test(data.realm) && typeof data.name==='string' && /^[\p{L}\p{M}]{2,24}$/u.test(data.name),'한국 리테일 서버와 캐릭터명을 확인하세요.');
  if (against && against.source!=='sample') ensure(against.region===data.region && sameName(against.realm,data.realm) && sameName(against.name,data.name),'현재 캐릭터와 서버 또는 이름이 다릅니다.');
  if(realms.length){
    const row=realms.find(r=>sameName(r.slug,data.realm));
    ensure(row && (!data.realmDisplayName || sameName(row.name,data.realmDisplayName)),'서버 이름과 Blizzard 서버 식별자가 일치하지 않습니다.');
  }
  ensure(data.seasonId===season.id && (data.patch==null || data.patch===season.patch),'지원 시즌 또는 패치가 다릅니다.');
  const at=Date.parse(data.observedAt);
  ensure(iso(data.observedAt) && at<=+now+300000,'수집 시각이 올바르지 않거나 미래 시각입니다.');
  const equipment=[];
  const character=pick(data,characterFields);
  ensure(Array.isArray(data.equipment) && data.equipment.length<=16,'장비 목록을 확인하세요.');
  const seen=new Set();
  for(const item of data.equipment){
    ensure(isRecord(item) && SLOTS.includes(item.slot) && !seen.has(item.slot),'잘못되었거나 중복된 장비 슬롯이 있습니다.');
    seen.add(item.slot);
    const detail=pick(item,itemFields);
    const trackKey=typeof item.track==='string'?item.track.toLowerCase():null;
    ensure(item.track==null || boundedText(64)(item.track),'잘못된 강화 트랙입니다.');
    ensure(item.rank==null || (boundedInt(20)(item.rank) && item.track!=null),'잘못된 강화 단계입니다.');
    ensure(detail.maxRank==null || (item.rank!=null && item.rank<=detail.maxRank),'강화 단계가 최대 단계를 넘습니다.');
    ensure(detail.upgradeStatus!=='observed' || (trackKey && tracks.has(trackKey) && item.rank!=null && detail.maxRank!=null),'관측된 강화 정보에 트랙과 단계가 필요합니다.');
    ensure(!detail.upgradeStatus || detail.upgradeStatus==='observed' || (item.track==null && item.rank==null && detail.maxRank==null),'미확인 강화 상태에는 단계가 없어야 합니다.');
    equipment.push({slot:item.slot,itemId:item.itemId,ilvl:item.ilvl,name:text(item.name),track:tracks.has(trackKey)?trackKey:item.track??null,rank:item.rank??null,...detail,
      equipLoc:text(item.equipLoc,40),itemClassId:Number.isInteger(item.itemClassId)?item.itemClassId:null,
      itemSubclassId:Number.isInteger(item.itemSubclassId)?item.itemSubclassId:null,itemLink:text(item.itemLink,1024)});
  }
  ensure(data.resources==null || isRecord(data.resources),'재화 목록 형식이 올바르지 않습니다.');
  const resources={};
  for(const key of resourceKeys){
    const row=data.resources?.[key];
    if(row===undefined) continue;
    ensure(isRecord(row) && row.source==='addon' && iso(row.observedAt) && Date.parse(row.observedAt)<=+now+300000,'재화 출처 또는 수집 시각을 확인하세요.');
    const state=row.state??(row.value===null?'uncollected':'observed');
    ensure(statusNames.includes(state) && (state==='observed'?Number.isSafeInteger(row.value)&&row.value>=0:row.value===null),'재화 수량 또는 수집 상태가 올바르지 않습니다.');
    resources[key]={source:'addon',observedAt:row.observedAt,value:row.value,state};
  }
  const capture=(row,keys)=>{
    if(row==null)return null;
    ensure(isRecord(row) && row.source==='addon' && iso(row.observedAt) && Date.parse(row.observedAt)<=+now+300000,'진행 정보의 출처 또는 수집 시각을 확인하세요.');
    return {...Object.fromEntries(keys.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])),source:'addon',observedAt:row.observedAt};
  };
  const warnings=Array.isArray(data.collectionWarnings)?data.collectionWarnings.slice(0,24).map(w=>text(w,240)).filter(Boolean):[];
  const progress=capture(data.progress,progressKeys);
  const progressSources={};
  for(const key of progressKeys){
    const origin=data.fieldSources?.progress?.[key];
    if(origin===undefined)continue;
    ensure(progress?.[key]!=null && isRecord(origin) && origin.source==='addon' && iso(origin.observedAt) && Date.parse(origin.observedAt)<=at,'진행 항목의 개별 관측 시각을 확인하세요.');
    progressSources[key]=provenance(origin);
  }
  const missing=SLOTS.filter(slot=>!seen.has(slot) && !(slot==='OFF_HAND' && data.weaponMode==='two-hand'));
  if(missing.length)warnings.push('장비 누락: '+missing.join(', '));
  if(+now-at>86400000)warnings.push('24시간이 지난 스냅샷입니다. 최신 정보로 다시 내보내세요.');
  if(data.patch==null)warnings.push('v1 내보내기에 게임 패치 정보가 없습니다.');
  if(!realms.length && !against)warnings.push('Blizzard 서버 목록과 대조하지 못했습니다. 서버 식별자를 확인하세요.');
  return validate({
    schemaVersion:1,source:'addon',addonVersion:data.addonVersion??null,region:'kr',realm:data.realm,name:data.name,
    realmDisplayName:text(data.realmDisplayName),seasonId:data.seasonId,patch:data.patch??null,observedAt:data.observedAt,
    ...character,profile:{...character,specialization:character.specializationName??null},
    fieldSources:{progress:progressSources},weaponMode:data.weaponMode,equipment,resources,progress,
    keystone:capture(data.keystone,['dungeon','level']),collectionWarnings:warnings,
    reportedEquippedAverage:Number.isFinite(data.reportedEquippedAverage)?data.reportedEquippedAverage:null,
  });
}

export function mergeSnapshots(base,addon,{prefer='auto'}={}){
  if(!base || base.source==='sample'){
    const progress=Object.fromEntries(progressKeys.filter(key=>addon.progress?.[key]!=null).map(key=>[key,observedProgress(addon,key)]));
    return {...addon,equipmentSource:'addon',fieldSources:{equipment:provenance(addon),profile:provenance(addon),progress,keystone:provenance(addon.keystone)}};
  }
  ensure(base.region===addon.region && sameName(base.realm,addon.realm) && sameName(base.name,addon.name),'다른 캐릭터의 데이터는 병합할 수 없습니다.');
  ensure(base.seasonId===addon.seasonId,'시즌이 다른 데이터는 병합할 수 없습니다.');
  const complete = row => row.weaponMode!=='unknown' && row.equipment.length===(row.weaponMode==='two-hand'?15:16);
  const takeAddon = prefer==='addon' || (prefer!=='base' && (complete(addon)!==complete(base) ? complete(addon) : Date.parse(addon.observedAt)>=Date.parse(base.observedAt)));
  const equipment = takeAddon?addon:base;
  const bySlot = new Map(base.equipment.map(item=>[item.slot,item]));
  const displayedGear = takeAddon ? addon.equipment.map(item=>{
    const api=bySlot.get(item.slot);
    // Media belongs to the item definition. Never copy enhancement metadata across sets.
    if (!api || item.itemId!==api.itemId || item.ilvl!==api.ilvl ||
        (item.bonusIds && api.bonusIds && [...item.bonusIds].sort().join()!==[...api.bonusIds].sort().join())) return item;
    return {...item,icon:api.icon??null,quality:api.quality??null};
  }) : base.equipment;
  const newerProfile = Date.parse(addon.observedAt)>=Date.parse(base.observedAt);
  const details=Object.fromEntries(Object.keys(characterFields).filter(key=>addon[key]!=null).map(key=>[key,addon[key]]));
  const profile={...base.profile,...details};
  for(const key of ['className','level','specialization']){
    const addonValue=key==='specialization'?details.specializationName:details[key];
    profile[key]=(newerProfile?addonValue??base.profile?.[key]:base.profile?.[key]??addonValue)??null;
  }
  const best = (existing,incoming) => {
    if (!incoming || (Object.hasOwn(incoming,'value') && incoming.value===null && existing?.value!=null)) return existing??incoming;
    if (!existing || (Object.hasOwn(existing,'value') && existing.value===null && incoming.value!=null)) return incoming;
    return Date.parse(incoming.observedAt)>Date.parse(existing.observedAt)?incoming:existing;
  };
  const resources={...base.resources};
  for(const [key,value] of Object.entries(addon.resources)) resources[key]=best(resources[key],value);
  const progress=best(base.progress,addon.progress),keystone=best(base.keystone,addon.keystone);
  const progressSources={};
  const progressValues={};
  for(const key of progressKeys){
    const choices=[base,addon].filter(row=>row.progress?.[key]!=null).map(row=>({...observedProgress(row,key),[key]:row.progress[key]}));
    const selected=choices.reduce((current,row)=>best(current,row),null);
    if(selected){progressValues[key]=selected[key];progressSources[key]=provenance(selected);}
  }
  return {...base,...details,profile,observedAt:equipment.observedAt,equipment:displayedGear,weaponMode:equipment.weaponMode,
    equipmentSource:equipment.source,resources,progress:progress?{...progress,...progressValues}:null,keystone,collectionWarnings:addon.collectionWarnings,
    fieldSources:{equipment:provenance(equipment),addonProfile:provenance(addon),progress:progressSources,keystone:provenance(keystone)}};
}
