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
  ensure(Array.isArray(data.equipment) && data.equipment.length<=16,'장비 목록을 확인하세요.');
  const seen=new Set();
  for(const item of data.equipment){
    ensure(isRecord(item) && SLOTS.includes(item.slot) && !seen.has(item.slot),'잘못되었거나 중복된 장비 슬롯이 있습니다.');
    seen.add(item.slot);
    equipment.push({slot:item.slot,itemId:item.itemId,ilvl:item.ilvl,name:text(item.name),track:item.track??null,rank:item.rank??null,
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
  const missing=SLOTS.filter(slot=>!seen.has(slot) && !(slot==='OFF_HAND' && data.weaponMode==='two-hand'));
  if(missing.length)warnings.push('장비 누락: '+missing.join(', '));
  if(+now-at>86400000)warnings.push('24시간이 지난 스냅샷입니다. 최신 정보로 다시 내보내세요.');
  if(data.patch==null)warnings.push('v1 내보내기에 게임 패치 정보가 없습니다.');
  if(!realms.length && !against)warnings.push('Blizzard 서버 목록과 대조하지 못했습니다. 서버 식별자를 확인하세요.');
  return validate({
    schemaVersion:1,source:'addon',addonVersion:data.addonVersion??null,region:'kr',realm:data.realm,name:data.name,
    realmDisplayName:text(data.realmDisplayName),seasonId:data.seasonId,patch:data.patch??null,observedAt:data.observedAt,
    weaponMode:data.weaponMode,equipment,resources,progress:capture(data.progress,progressKeys),
    keystone:capture(data.keystone,['dungeon','level']),collectionWarnings:warnings,
    reportedEquippedAverage:Number.isFinite(data.reportedEquippedAverage)?data.reportedEquippedAverage:null,
  });
}

export function mergeSnapshots(base,addon,{prefer='auto'}={}){
  if(!base || base.source==='sample') return {...addon,equipmentSource:'addon',fieldSources:{equipment:{source:'addon',observedAt:addon.observedAt},progress:provenance(addon.progress),keystone:provenance(addon.keystone)}};
  ensure(base.region===addon.region && sameName(base.realm,addon.realm) && sameName(base.name,addon.name),'다른 캐릭터의 데이터는 병합할 수 없습니다.');
  ensure(base.seasonId===addon.seasonId,'시즌이 다른 데이터는 병합할 수 없습니다.');
  const complete = row => row.weaponMode!=='unknown' && row.equipment.length===(row.weaponMode==='two-hand'?15:16);
  const takeAddon = prefer==='addon' || (prefer!=='base' && (complete(addon)!==complete(base) ? complete(addon) : Date.parse(addon.observedAt)>=Date.parse(base.observedAt)));
  const equipment = takeAddon?addon:base;
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
    const choices=[base.progress,addon.progress].filter(row=>row?.[key]!=null);
    const selected=choices.reduce((current,row)=>best(current,row),null);
    if(selected){progressValues[key]=selected[key];progressSources[key]=provenance(selected);}
  }
  return {...base,observedAt:equipment.observedAt,equipment:equipment.equipment,weaponMode:equipment.weaponMode,
    equipmentSource:equipment.source,resources,progress:progress?{...progress,...progressValues}:null,keystone,collectionWarnings:addon.collectionWarnings,
    fieldSources:{equipment:provenance(equipment),progress:progressSources,keystone:provenance(keystone)}};
}

const provenance = row => row ? {source:row.source,observedAt:row.observedAt}:null;
