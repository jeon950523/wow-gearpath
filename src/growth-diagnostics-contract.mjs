import Ajv2020 from 'ajv/dist/2020.js';
import merchant from '../contracts/merchant-diagnostics-v1.schema.json' with {type:'json'};
import craft from '../contracts/craft-diagnostics-v1.schema.json' with {type:'json'};
import storage from '../contracts/growth-diagnostics-storage-v1.schema.json' with {type:'json'};

const ajv=new Ajv2020({strict:false});
const checks={merchant:ajv.compile(merchant),craft:ajv.compile(craft)};
const checkStorage=ajv.compile(storage);
const encoder=new TextEncoder();
const byteLength=text=>encoder.encode(text).length;
const limits={merchant:65536,craft:262144};
const typedKey=row=>row.itemID===null?'currency:'+row.currencyID:'item:'+row.itemID;

function requireValid(condition,message) {
  if (!condition) throw new Error('관측 계약 오류 · '+message);
}
function unique(rows,key){
  requireValid(new Set(rows.map(key)).size===rows.length,'중복 식별자');
}
function checkMerchant(data){
  requireValid(data.rows.length===data.count && (data.count===0)===(data.state==='empty'),'상인 목록 길이');
  for (const [index,row] of data.rows.entries()){
    requireValid(row.index===index+1,'상품 인덱스');
    const known=row.costState==='observed' || row.costState==='partial';
    if (known){
      const complete=row.costs.every(cost=>(cost.itemID===null)!==(cost.currencyID===null) && cost.quantity!==null);
      requireValid(row.hasExtendedCost===true && row.costCount>0 && row.costs.length===row.costCount &&
        row.costs.every((cost,i)=>cost.index===i+1) && complete===(row.costState==='observed'),'교환 비용 개수와 상태');
    } else {
      requireValid(row.costs.length===0 && (row.costState==='noExtendedCost'
        ? row.hasExtendedCost===false && row.costCount===0 : row.hasExtendedCost!==false && row.costCount===null),'교환 비용 미관측');
    }
    if (row.infoState!=='observed'){
      requireValid(['saleCurrencyID','priceCopper','stackCount','numAvailable','isPurchasable','isUsable','hasExtendedCost']
        .every(key=>row[key]===null) && row.costState==='unobserved' && row.detailState==='unobserved','상품 정보 미관측');
    }
    requireValid((row.detailState==='observed')===(row.itemLevel!==null && row.equipLoc!==null) &&
      (row.itemLevel===null || (row.previewLevel===false && row.itemID!==null)) &&
      (row.detailState!=='unobserved' || [row.previewLevel,row.itemLevel,row.equipLoc].every(value=>value===null)),'상품 상세 근거');
  }
}
function checkCraft(data){
  const slots=data.schematic?.slots??[];
  const allocations=data.allocations??[];
  unique(slots,row=>row.dataSlotIndex);
  if(data.target){
    const {state,itemID,itemLevel}=data.target;
    requireValid((state==='observed')===(itemID!==null && itemLevel!==null) &&
      (state!=='unselected' || (itemID===null && itemLevel===null)),'재제작 대상 상태');
  }
  if(data.preview){
    const p=data.preview;
    const expected=data.source==='personalCraft'?'personalOperation':'customerMinimum';
    requireValid((p.kind===null || p.kind===expected) &&
      (expected==='personalOperation' || (p.concentration===null && (p.qualityRank===null || p.qualityRank===data.draft.minimumQuality))) &&
      (p.state==='observed')===(p.itemLevel!==null) &&
      (p.itemLevel===null || (p.kind===expected && p.linkFlag===false && p.itemID!==null && p.qualityRank!==null && p.qualityID!==null &&
        (data.mode!=='recraft' || data.target.state==='observed'))),'미리보기 출처와 관측 상태');
  }
  if(data.inventory){
    const {state,slotState,balances,requirements,retention}=data.inventory;
    requireValid(state!=='unavailable' || (!balances.length && !requirements.length && !retention.length && slotState===null),'재료 미수집');
    requireValid(slotState==='sample' || !requirements.length,'슬롯 관측 상태');
    unique(balances,typedKey);
    unique(requirements,row=>row.dataSlotIndex);
    unique(retention,row=>row.allocation);
    for(const row of balances){
      const item=row.itemID!==null;
      requireValid(item===(row.scope==='itemCountNoBanks') &&
        (row.state==='observed')===(row.owned!==null),'잔액 범위와 상태');
      const comparable=data.mode==='craft' && item && row.owned!==null;
      requireValid(row.allocationGapNoBanks===(comparable?Math.max(0,row.allocated-row.owned):null) &&
        row.singleRequiredGapNoBanks===(comparable && row.singleRequired!==null && row.singleRequirementUnknown!==true
          ? Math.max(0,row.singleRequired-row.owned):null),'비교용 차이');
    }
    for(const row of requirements){
      requireValid(!(row.singleItemID!==null && row.singleCurrencyID!==null) &&
        (row.singleRequired===null || (row.required===true && data.mode==='craft' &&
          (row.singleItemID===null)!==(row.singleCurrencyID===null))) &&
        (row.originalState==='observed')===(row.originalIdentity!==null) &&
        (data.mode==='recraft')===(row.originalState!=='notApplicable'),'필수 슬롯 또는 원본 관측');
    }
    requireValid(retention.every(row=>data.mode==='recraft' && row.allocation<=allocations.length),'원본 비교 참조');
  }
  const hints=data.catalog?.hints??[];
  unique(hints,row=>row.catalogRef);
  for (const {catalogRef} of hints){
    const [type,index,option]=catalogRef.split(':');
    requireValid(type==='allocation'?Boolean(allocations[+index-1]):Boolean(slots[+index-1]?.options[+option-1]),'재료 분류 참조');
  }
}

export function parseGrowthDiagnostic(kind,raw,{now=Date.now()}={}){
  requireValid(Object.hasOwn(limits,kind) && typeof raw==='string' && raw.length<=limits[kind] &&
    byteLength(raw)<=limits[kind],'자료 종류 또는 크기');
  let data;
  try {data=JSON.parse(raw);} catch {requireValid(false,'JSON');}
  requireValid(checks[kind](data),'종류별 스키마');
  requireValid(data.observedAt*1000<=+now,'미래 관측 시각');
  if(kind==='merchant') checkMerchant(data);
  else checkCraft(data);
  return data;
}

export function validateGrowthDiagnosticsStorage(database,options){
  requireValid(checkStorage(database),'저장 컨테이너');
  unique(database.characters,row=>JSON.stringify([row.realmDisplayName,row.name].map(value=>value.toLowerCase())));
  let bytes=0;
  for(const row of database.characters){
    requireValid([row.realmDisplayName,row.name].every(value=>byteLength(value)<=128),'캐릭터 식별 길이');
    for(const kind of ['merchant','craft']){
      const seen=new Set();
      let previous=0;
      for(const raw of row[kind]){
        bytes+=byteLength(raw);
        requireValid(bytes<=2097152 && !seen.has(raw),'저장 용량 또는 원문 중복');
        seen.add(raw);
        const {observedAt}=parseGrowthDiagnostic(kind,raw,options);
        requireValid(observedAt>=previous,'관측 시각 역전');
        previous=observedAt;
      }
    }
  }
  return database;
}
