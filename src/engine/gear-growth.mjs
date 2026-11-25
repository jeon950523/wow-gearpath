export const slotWeight = (slot, weaponMode) => slot==='MAIN_HAND' && weaponMode==='two-hand' ? 2 : 1;
const protectedSlots=new Set(['MAIN_HAND','OFF_HAND','TRINKET_1','TRINKET_2']);
const validCost = n => Number.isSafeInteger(n) && n>=0;
const totalCost = actions => actions.reduce((total,action)=>{
  for(const [key,value] of Object.entries(action.costs)) total[key]=(total[key]??0)+value;
  return total;
},{});

function stepCost(rule, rank, observation, observedAt) {
  const base=rule.steps?.[rank-1]?.costs ??
    (rule.currency ? {[rule.currency]:rule.crestPerStep,gold:rule.goldPerStep} : null);
  if (!base || !Object.keys(base).length || Object.values(base).some(value=>!validCost(value))) return null;
  const policy=rule.discountPolicy;
  if (policy!=='observed') return {base,costs:base,discount:policy==='none'||rule.evidence==='synthetic'?'none':'unknown'};
  const observed=observation?.[rank];
  if (!observed || observed.verified!==true || observed.observedAt!==observedAt ||
      !['character','warband','none'].includes(observed.scope) || !observed.costs ||
      Object.keys(observed.costs).length!==Object.keys(base).length ||
      Object.entries(base).some(([key,max])=>!validCost(observed.costs[key]) || observed.costs[key]>max)) {
    return {base,costs:base,discount:'unknown'};
  }
  return {base,costs:observed.costs,discount:observed.scope};
}

export function analyzeGear(snapshot, rules, {excludeSlots=[], discounts={}, replacements={}}={}) {
  const excluded=new Set(excludeSlots);
  const byTrack=new Map(rules.map(rule=>[rule.track,rule]));
  return snapshot.equipment.map(item=>{
    const rule=byTrack.get(item.track), weight=slotWeight(item.slot,snapshot.weaponMode);
    const matched=rule && Number.isInteger(item.rank) && item.rank>=1 && rule.levels[item.rank-1]===item.ilvl;
    const cap=matched?Math.min(rule.levels.length,item.maxRank??rule.levels.length):null;
    const usableCap=cap!==null && cap>=item.rank?cap:null;
    const instance={slot:item.slot,itemId:item.itemId,itemLink:item.itemLink??null,bonusIds:item.bonusIds??null,
      setId:item.setId??null};
    const instanceKey=JSON.stringify([snapshot.realm,snapshot.name,snapshot.observedAt,instance]);
    const source=snapshot.equipmentSource??snapshot.source;
    const actions=[];
    if (usableCap!==null) for(let rank=item.rank;rank<usableCap;rank++){
      const price=stepCost(rule,rank,discounts[instanceKey],snapshot.observedAt);
      if(!price) break;
      const from=rule.levels[rank-1],to=rule.levels[rank];
      const actionId=item.slot+':'+rank+'-'+(rank+1);
      actions.push({actionId,instance,instanceKey,slot:item.slot,fromRank:rank,toRank:rank+1,from,to,
        gainUnits:(to-from)*weight,averageGain:(to-from)*weight/16,baseCosts:price.base,costs:price.costs,
        discount:price.discount,requires:actions.at(-1)?.actionId??null,
        source:rule.source??null,evidence:rule.evidence??'verified'});
    }
    const options=[{gainUnits:0,costs:{},actions:[]}];
    if (!excluded.has(item.slot)) for(let i=0;i<actions.length;i++){
      if(actions[i].discount==='unknown') break;
      const prefix=actions.slice(0,i+1);
      options.push({gainUnits:prefix.reduce((sum,action)=>sum+action.gainUnits,0),costs:totalCost(prefix),actions:prefix});
    }
    const comparison=replacements[item.slot];
    const alternative=comparison?.verified===true && validCost(comparison.ilvl) && comparison.ilvl>item.ilvl ? comparison : null;
    const simRequired=protectedSlots.has(item.slot)||item.setId!=null||item.embellished===true;
    const maxIlvl=usableCap===null?null:rule.levels[usableCap-1];
    let decision='hold', reason='강화표 또는 현재 단계 대조가 필요합니다.';
    if(excluded.has(item.slot)){decision='preserve';reason='사용자가 이 슬롯을 보존하도록 선택했습니다.';}
    else if(alternative && !simRequired && (maxIlvl===null || alternative.ilvl>=maxIlvl)){
      decision='replace';reason='확인된 대체 장비의 레벨이 현재 장비의 성장 범위보다 높거나 같습니다.';
    }else if(options.length>1){decision='upgrade';reason=simRequired?'강화는 레벨 기준으로 비교할 수 있습니다. 교체 성능은 세트·특수 효과 검증이 필요합니다.':'검증된 단계와 비용을 예산 내에서 비교할 수 있습니다.';}
    else if(simRequired){decision='preserve';reason='세트 구성 또는 특수 효과를 비교하기 전 성능 교체 판단을 보류합니다.';}
    else if(usableCap!==null && item.rank===usableCap){reason='확인된 트랙 상한에 도달했습니다. 대체 장비의 획득 정보가 필요합니다.';}
    else if(actions[0]?.discount==='unknown'){reason='기본 비용이 있으나 실제 적용 할인은 확인되지 않았습니다.';}
    return {instance,instanceKey,slot:item.slot,ilvl:item.ilvl,track:item.track??null,rank:item.rank??null,
      maxRank:usableCap??item.maxRank??null,maxIlvl,remainingRanks:usableCap===null?null:usableCap-item.rank,
      next:actions[0]??null,maxCosts:actions.length && actions.length===usableCap-item.rank && actions.every(a=>a.discount!=='unknown')?totalCost(actions):null,
      verification:matched?(rule.evidence??'verified'):'unknown',source,observedAt:snapshot.observedAt,
      decision,reason,options,performance:{status:'unmeasured',comparisonRequired:simRequired}};
  });
}
