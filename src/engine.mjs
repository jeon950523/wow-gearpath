import { season, demoRules, rulesAt } from './rules.mjs';

export const SLOTS = ['HEAD','NECK','SHOULDER','BACK','CHEST','WRIST','HANDS','WAIST','LEGS','FEET','FINGER_1','FINGER_2','TRINKET_1','TRINKET_2','MAIN_HAND','OFF_HAND'];
const SOURCES = ['manual','addon','blizzard','sample'];
const validNumber = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const fail = message => { throw new Error(message); };

export function validate(p) {
  if (p?.schemaVersion !== 1 || p.region !== 'kr' || typeof p.realm !== 'string' || !p.realm.trim() || typeof p.name !== 'string' || !p.name.trim()) fail('schemaVersion=1 및 한국 캐릭터 식별 정보가 필요합니다.');
  if (typeof p.seasonId !== 'string' || !Number.isFinite(Date.parse(p.observedAt))) fail('시즌과 관측 시각이 필요합니다.');
  if (!['one-hand','two-hand','dual-wield','unknown'].includes(p.weaponMode)) fail('weaponMode 값이 올바르지 않습니다.');
  if (!SOURCES.includes(p.source) || !Array.isArray(p.equipment) || p.equipment.length > 16) fail('출처 또는 장비 목록이 올바르지 않습니다.');
  const seen = new Set();
  for (const item of p.equipment) {
    if (!SLOTS.includes(item.slot) || seen.has(item.slot)) fail('알 수 없거나 중복된 장비 슬롯입니다.');
    seen.add(item.slot);
    if (!validNumber(item.ilvl) || item.ilvl > 2000 || !Number.isInteger(item.itemId) || item.itemId <= 0) fail('장비 ID 또는 아이템 레벨이 올바르지 않습니다.');
    if (item.track != null && (typeof item.track !== 'string' || !Number.isInteger(item.rank) || item.rank < 1 || item.rank > 20)) fail('강화 트랙에는 유효한 단계가 필요합니다.');
  }
  for (const [key, o] of Object.entries(p.resources ?? {})) {
    if (!o || (o.value !== null && (!validNumber(o.value) || !Number.isSafeInteger(o.value))) ||
      (o.state!==undefined && !(['observed','uncollected','failed','incomplete','locked'].includes(o.state) && (o.state==='observed')===(o.value!==null))) ||
      !SOURCES.includes(o.source) || !Number.isFinite(Date.parse(o.observedAt))) fail(`재화 ${key}: 수량, 상태, 출처, 시각을 확인하세요.`);
  }
  if (p.progress != null) {
    if (!SOURCES.includes(p.progress.source) || !Number.isFinite(Date.parse(p.progress.observedAt))) fail('진행 정보의 출처와 시각이 필요합니다.');
    if (p.progress.maxDelveTier != null && (!Number.isInteger(p.progress.maxDelveTier) || p.progress.maxDelveTier < 1 || p.progress.maxDelveTier > 11)) fail('구렁 단계는 1~11 또는 null입니다.');
    if (p.progress.venomstoneUnlocked != null && typeof p.progress.venomstoneUnlocked !== 'boolean') fail('해금 여부는 boolean 또는 null입니다.');
    for (const key of ['stableTier','vaultWorld','vaultDungeon','vaultRaid']) {
      const value = p.progress[key];
      const isTier = key === 'stableTier';
      if (value != null && (!Number.isInteger(value) || value < (isTier ? 1 : 0) || value > (isTier ? 11 : 99))) fail('구렁 또는 금고 진행 횟수를 확인하세요.');
    }
  }
  if (p.keystone != null && (!SOURCES.includes(p.keystone.source) || !Number.isFinite(Date.parse(p.keystone.observedAt)) || !Number.isInteger(p.keystone.level) || p.keystone.level < 2 || p.keystone.level > 100 || typeof p.keystone.dungeon !== 'string' || !p.keystone.dungeon.trim())) fail('쐐기돌의 던전·단계·출처·시각을 확인하세요.');
  return p;
}

function fresh(at, now) {
  const age = now - Date.parse(at);
  return Number.isFinite(age) && age >= -300000 && age <= 86400000;
}

export function diagnose(input, { now = new Date(), demo = false, web = false, solo = false } = {}) {
  const p = validate(input), timestamp = +new Date(now);
  if (!Number.isFinite(timestamp)) fail('분석 시각이 올바르지 않습니다.');
  if (demo && p.source !== 'sample') fail('샘플 출처에서만 데모 계산을 사용할 수 있습니다.');
  const warnings = [], bySlot = new Map(p.equipment.map(x => [x.slot, x]));
  const equipmentFresh = fresh(p.observedAt, timestamp);
  const seasonValid = p.seasonId === season.id && (p.patch==null || p.patch===season.patch) &&
    (season.effectiveUntil===null || timestamp<Date.parse(season.effectiveUntil)) &&
    timestamp <= Date.parse(season.validUntil) && timestamp >= Date.parse(season.checkedAt+'T00:00:00+09:00');
  const active = rulesAt(timestamp);
  if (!equipmentFresh) warnings.push('장비 정보가 24시간 이상 지났거나 시각이 잘못되어 소비 및 그룹 추천을 보류합니다.');
  if (!seasonValid) warnings.push('시즌이 다르거나 규칙 재검토 기한이 지나 시즌별 추천과 소비 계산을 보류합니다.');
  const missingSlots = SLOTS.filter(s => !bySlot.has(s) && !(s === 'OFF_HAND' && p.weaponMode === 'two-hand'));
  const complete = missingSlots.length === 0 && p.weaponMode !== 'unknown' && !(p.weaponMode === 'two-hand' && bySlot.has('OFF_HAND'));
  if (!complete) warnings.push('장비 슬롯 또는 무기 방식이 불완전합니다. 평균 및 315 판정을 보류합니다.');
  const rawAverage = complete ? SLOTS.reduce((sum,s) => sum+(bySlot.get(s)?.ilvl ?? bySlot.get('MAIN_HAND').ilvl),0)/16 : null;
  // Never gate on the rounded display value or overall/bag item level.
  const groupEligible = !solo && seasonValid && equipmentFresh && rawAverage !== null && rawAverage >= 315;
  const weakSlots = [...p.equipment].sort((a,b)=>a.ilvl-b.ilvl).slice(0,5);
  if (p.equipment.some(x=>!x.track)) warnings.push('강화 트랙 미확인 장비가 있습니다. 아이템 레벨만으로 트랙을 추정하지 않습니다.');
  const resource = key => {
    const o = p.resources?.[key];
    return o && fresh(o.observedAt,timestamp) ? o.value : null;
  };
  const progress = p.progress ? Object.fromEntries(Object.entries(p.progress).filter(([key])=>
    fresh(p.fieldSources?.progress?.[key]?.observedAt ?? p.progress.observedAt,timestamp))) : {};
  const activities = [{id:'weak-slots', kind:'solo', title:'낮은 슬롯부터 교체 후보 확인', reason:weakSlots.map(x=>`${x.slot} ${x.ilvl}`).join(', ') || '장비 입력 필요', certainty:'진단'}];
  if (seasonValid) {
    const keys = resource('cofferKey');
    activities.push({id:'delves', kind:'solo', title:'안정적으로 완료 가능한 구렁 우선', reason:progress.stableTier != null ? `입력한 안정 완료 단계는 ${progress.stableTier}단입니다. 실제 해금 단계와 풍요 보상을 확인하세요.` : '최고 해금 단계와 실제 완료 가능 단계를 확인하세요. 해금 단계는 성공을 보장하지 않습니다.', certainty:'조건부'});
    if (active.byId.has('bountiful-delve-open')) activities.push({id:'bountiful', kind:'solo', title:keys === null ? '풍요로운 구렁 열쇠 수량 입력' : keys === 0 ? '열쇠 획득 경로 확인' : '풍요로운 구렁 보상 비교 후 열쇠 사용 검토', reason:keys === null ? '미입력·오래된 값은 0개와 구분합니다.' : `관측 열쇠 ${keys}개. 보상 미획득 여부와 단계별 보상을 게임에서 확인해야 합니다.`, certainty:'조건부'});
    if (active.byId.has('season-vault-open')) activities.push({id:'vault', kind:'solo', title:'이번 주 위대한 금고 진행 확인', reason:active.byId.has('vault-voidcore')?'공식 시즌 공지에는 성운의 공허핵 보상 선택지가 포함됩니다. 이번 주 해금 조건과 실제 후보는 게임에서 확인하세요.':'이번 주 구렁 금고 진행과 보상 후보는 게임에서 확인하세요.', certainty:'확인 필요'});
    if (web) {
      activities.push(
        {id:'world',kind:'solo',title:'필드 보상과 주간 퀘스트 확인',reason:'현재 보상 미리보기에서 교체할 부위를 찾으세요. 획득 완료와 주간 초기화는 게임에 표시된 상태를 따릅니다.',certainty:'확인 필요'},
        {id:'spend',kind:'solo',title:'교체 기회 확인 후 강화·제작 비교',reason:'이번 주 금고와 파밍 보상으로 교체할 가능성이 있는 부위는 소비를 보류하고, 계속 장착할 부위의 강화 비용·제작 주문을 게임에서 비교하세요.',certainty:'조건부'},
      );
    }
    const venomTier = active.byId.get('venomstone-bountiful-tier')?.effect.tier;
    const venomCost = active.byId.get('venomstone-upgrade')?.effect.quantity;
    const venomQuantity = active.byId.get('venomstone-bountiful-quantity')?.effect.quantity;
    if (venomTier && resource('cofferKey') > 0 && progress.maxDelveTier === venomTier && (progress.stableTier == null || progress.stableTier >= venomTier) && progress.venomstoneUnlocked === true) {
      const reward = venomQuantity ? `공식 긴급 수정 기준 풍요로운 금고에서 ${venomQuantity}개를 획득합니다. ` : '';
      activities.push({id:'venomstone', kind:'solo', title:`${venomTier}단 풍요로운 구렁의 추가 강화 재료 검토`,
        reason:reward+(venomCost?`추가 강화의 기준 비용은 맹독석 ${venomCost}개입니다. 최대 강화 및 대상 슬롯 조건을 게임에서 확인하세요.`:'실제 획득 조건을 게임에서 확인하세요.'), certainty:'조건부'});
    }
    if (groupEligible) {
      activities.push({id:'raid', kind:'group', title:'레이드 보상 후보 비교', reason:'315 기준 충족. 일반 난이도부터 공략 숙련도·역할·모집 조건과 교체 가능한 보상을 확인하세요.', certainty:'후보'});
      const key = p.keystone && fresh(p.keystone.observedAt,timestamp) ? p.keystone : null;
      activities.push({id:'mythic', kind:'group', title:'낮은 쐐기돌부터 보상 후보 비교', reason:`315 기준 충족. ${key ? `보유 쐐기: ${key.dungeon} +${key.level}. ` : '보유 쐐기 정보 미확인. '}던전 숙련도·파티 조건 확인 후 단계를 정하세요. 보유 단계가 권장 단계라는 뜻은 아닙니다.`, certainty:'후보'});
      if (web) activities.push({id:'group-vault',kind:'group',title:'레이드·쐐기 주간 금고 비교',reason:'레이드는 처치 가능한 우두머리와 남은 보상을, 쐐기는 안정적으로 완료할 단계와 소요 시간을 비교하세요. 금고 후보는 다음 주에 확인합니다.',certainty:'조건부'});
    }
  }
  const rules = demo ? demoRules : active.upgrades;
  if (!demo && !rules.length) warnings.push('공식 출처로 단계별 비용·할인까지 검증한 강화표가 없어 재화 소비안은 계산하지 않습니다.');
  if (demo) warnings.push('샘플 전용 가상 강화표입니다. 실제 게임의 비용이나 보상으로 사용하지 마세요.');
  const remaining = Object.fromEntries(Object.keys(p.resources ?? {}).map(k=>[k,resource(k)]));
  const working = structuredClone(p.equipment), upgrades = [];
  // Greedy next-step comparison, NOT a global/time-optimal planner.
  if (equipmentFresh && seasonValid && complete) {
    for (let iteration=0; iteration<100; iteration++) {
      const candidates = working.flatMap(item=>{
        const r = rules.find(x=>x.track===item.track);
        if (!r || item.rank >= r.levels.length || item.ilvl !== r.levels[item.rank-1]) return [];
        if (remaining[r.currency] == null || remaining.gold == null || remaining[r.currency] < r.crestPerStep || remaining.gold < r.goldPerStep) return [];
        const next = r.levels[item.rank], weight = item.slot==='MAIN_HAND' && p.weaponMode==='two-hand' ? 2 : 1;
        return [{ item, r, next, gain:(next-item.ilvl)*weight/16 }];
      }).sort((a,b)=>b.gain/b.r.crestPerStep-a.gain/a.r.crestPerStep || a.item.slot.localeCompare(b.item.slot));
      const c = candidates[0];
      if (!c) break;
      upgrades.push({slot:c.item.slot, from:c.item.ilvl, to:c.next, averageGain:c.gain, currency:c.r.currency, cost:c.r.crestPerStep, gold:c.r.goldPerStep});
      remaining[c.r.currency] -= c.r.crestPerStep; remaining.gold -= c.r.goldPerStep;
      c.item.ilvl=c.next; c.item.rank++;
    }
  }
  const resources = Object.entries(p.resources ?? {}).map(([key,o])=>({key,...o,status:!fresh(o.observedAt,timestamp)?'오래됨':o.value===null?'미입력':'입력됨'}));
  return {schemaVersion:1, generatedAt:new Date(timestamp).toISOString(), mode:demo?'sample':'conservative', character:{name:p.name,realm:p.realm,region:p.region}, season:season.name, rawAverage, displayAverage:rawAverage===null?null:rawAverage.toFixed(3), groupEligible, missingSlots, weakSlots, equipment:p.equipment, resources, activities, upgrades, remaining, warnings, sources:[season.source,season.updateSource]};
}
