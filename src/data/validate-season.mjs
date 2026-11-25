const statuses = new Set(['verified','pending','conflict']);
const trustedSources = new Set(['blizzard','game-measurement']);
const knownTracks = new Set(['explorer','adventurer','veteran','champion','hero','myth']);
const parseDate = value => typeof value==='string' && value.trim() ? Date.parse(value) : NaN;
const count = value => Number.isSafeInteger(value) && value >= 0;
const isRecord = value => value && typeof value==='object' && !Array.isArray(value);

export function validateSeasonData(manifest, definitions, rows) {
  const currencies = new Set(definitions.map(row=>row.key));
  const spendableCurrencies = new Set(definitions.filter(row=>row.spendingStatus==='verified').map(row=>row.key));
  const issues = new Map();
  const mark = (index,reason) => issues.set(index,[...(issues.get(index)??[]),reason]);
  const ids = new Map(), intervals = new Map();
  rows.forEach((rule,index)=>{
    if (!isRecord(rule)) {mark(index,'invalid-record');return;}
    const {ruleId,key,category,conditions,effect}=rule;
    if (typeof ruleId!=='string' || !ruleId || typeof key!=='string' || !key || typeof category!=='string' || !category) mark(index,'missing-identity');
    if (ids.has(ruleId)){mark(index,'duplicate-id');mark(ids.get(ruleId),'duplicate-id');}
    else ids.set(ruleId,index);
    for (const name of ['expansionId','seasonId','patch','region']) if(rule[name]!==manifest[name]) mark(index,'wrong-'+name);
    const start=parseDate(rule.effectiveFrom), end=rule.effectiveUntil===null?Infinity:parseDate(rule.effectiveUntil);
    const due=parseDate(rule.reviewDueAt),checked=parseDate(rule.checkedAt);
    if (!Number.isFinite(start) || !(end>start) || !Number.isFinite(due) || !Number.isFinite(checked) || due<checked || due<start) mark(index,'invalid-dates');
    const logicalKey=JSON.stringify([category,category==='upgrade-table'?effect?.track:key]);
    for (const previous of intervals.get(logicalKey)??[]) {
      if (start<previous.end && previous.start<end){mark(index,'overlap');mark(previous.index,'overlap');}
    }
    intervals.set(logicalKey,[...(intervals.get(logicalKey)??[]),{start,end,index}]);
    if (!statuses.has(rule.verificationStatus)) mark(index,'verification-missing');
    if (typeof rule.source!=='string' || !rule.source.startsWith('https://') || !rule.sourceType || !rule.reuse) mark(index,'provenance-missing');
    if (rule.verificationStatus==='verified' && !trustedSources.has(rule.sourceType)) mark(index,'unverified-source');
    if (!isRecord(conditions)||!isRecord(effect)) {mark(index,'invalid-payload');return;}
    for(const k of [effect.currency,...(Array.isArray(effect.paymentOptions)?effect.paymentOptions:[])]) if(k!==undefined && !currencies.has(k)) mark(index,'unknown-currency');
    if (effect.track!==undefined && !knownTracks.has(effect.track)) mark(index,'unknown-track');
    if (conditions.tracks!==undefined && (!Array.isArray(conditions.tracks) || conditions.tracks.some(k=>!knownTracks.has(k)))) mark(index,'unknown-track');
    for (const value of [effect.quantity,effect.crestPerStep,effect.goldPerStep,effect.weeklyQuantity]) if(value!==undefined && !count(value)) mark(index,'invalid-cost');
    if (effect.probability!==undefined && (typeof effect.probability!=='number' || !Number.isFinite(effect.probability) || effect.probability<0 || effect.probability>1)) mark(index,'invalid-probability');
    if (effect.tier!==undefined && (!Number.isInteger(effect.tier)||effect.tier<1||effect.tier>11)) mark(index,'invalid-tier');
    if (effect.rank!==undefined && (!Number.isInteger(effect.rank)||effect.rank<1||effect.rank>20)) mark(index,'invalid-rank');
    if (effect.levels!==undefined && (!Array.isArray(effect.levels) || effect.levels.length<2 || effect.levels.length>20 ||
        effect.levels.some((v,i)=>!Number.isInteger(v)||v<1||v>2000||(i>0&&v<=effect.levels[i-1])))) mark(index,'invalid-levels');
    if (category==='special-upgrade' && (effect.currency===undefined || !count(effect.quantity)||effect.quantity===0)) mark(index,'missing-spend');
    if (category==='upgrade-table' && (!spendableCurrencies.has(effect.currency) || !knownTracks.has(effect.track) ||
        !Array.isArray(effect.levels) || !count(effect.crestPerStep) || !effect.crestPerStep || !count(effect.goldPerStep) ||
        conditions.eligibility!=='unrestricted' || conditions.discountPolicy!=='none')) mark(index,'incomplete-spend-table');
  });
  return {
    accepted:rows.filter((_,index)=>!issues.has(index)),
    rejected:[...issues].map(([index,reasons])=>({ruleId:rows[index]?.ruleId??null,reasons})),
  };
}

export function activeSeasonRules(validated,now) {
  const at=+new Date(now);
  return validated.accepted.filter(rule=>rule.verificationStatus==='verified' &&
    at>=parseDate(rule.effectiveFrom) && at>=parseDate(rule.checkedAt+'T00:00:00+09:00') &&
    (rule.effectiveUntil===null || at<parseDate(rule.effectiveUntil)) && at<=parseDate(rule.reviewDueAt));
}
