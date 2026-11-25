import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {diagnose} from '../src/engine.mjs';
import {season,seasonData,resourceDefinitions,rulesAt} from '../src/rules.mjs';
import {validateSeasonData,activeSeasonRules} from '../src/data/validate-season.mjs';

const now=new Date('2026-11-26T12:35:00Z');
const fixture=()=>JSON.parse(readFileSync(new URL('../contracts/examples/resources-0.3.0.json',import.meta.url)));
const parse=input=>parseAddon(JSON.stringify(input),{now});
const field=(value,extras={})=>({value,source:'addon',state:value===null?'uncollected':'observed',observedAt:fixture().observedAt,...extras});

test('ADDON-003A PR 실생성 fixture의 v1, 패치, 9종 재화 및 315 정책',()=>{
  const input=fixture(), loaded=mergeSnapshots(null,parse(input)), out=diagnose(loaded,{now});
  assert.equal(loaded.addonVersion,'0.3.0');
  assert.equal(loaded.patch,'12.1.5');
  assert.equal(Object.keys(loaded.resources).length,9);
  assert.deepEqual(loaded.resources,input.resources);
  assert.equal(out.remaining.cofferKey,0);
  assert.equal(out.remaining.veteranCrest,null);
  assert.equal(out.groupEligible,true);
  assert.equal(diagnose(loaded,{now,solo:true}).groupEligible,false);
});

test('신규 화폐는 ID와 유형을 검증하며 메타데이터는 선택 사항',()=>{
  const input=fixture();
  input.resources.undercoin=field(2,{currencyId:2803,scope:'warband',kind:'currency',maxQuantity:100,weeklyEarned:0,weeklyLimit:20});
  input.resources.nebulousVoidcore=field(0,{currencyId:3513});
  input.resources.voidlightMarl=field(null,{state:'locked',currencyId:3316,name:'공허불빛 이회토'});
  input.resources.futureSecret={secret:'private-fixture'};
  assert.deepEqual(parse(input).resources.undercoin,input.resources.undercoin);
  assert.equal(parse(input).resources.nebulousVoidcore.value,0);
  assert.equal(parse(input).resources.voidlightMarl.state,'locked');
  assert.equal(parse(input).resources.futureSecret,undefined);
  for (const variant of [
    x=>x.resources.nebulousVoidcore.currencyId=3418,
    x=>x.resources.venomstone.itemId=285065,
    x=>x.resources.undercoin.itemId=2803,
    x=>x.resources.undercoin.weeklyEarned=-1,
    x=>x.resources.gold.scope='warband',
    x=>x.resources.voidlightMarl.value=0,
    x=>x.patch='12.1.7',x=>x.seasonId='midnight-s1',
  ]) {
    const copy=structuredClone(input);variant(copy);assert.throws(()=>parse(copy));
  }
});

test('전투부대 관측값은 합산하지 않으며 오래된 재화로 소비하지 않음',()=>{
  const snapshot=fixture();
  snapshot.resources.undercoin=field(8,{scope:'warband',currencyId:2803});
  const base={...parse(snapshot),source:'blizzard',resources:{
    undercoin:field(7,{scope:'warband',currencyId:2803,observedAt:'2026-11-26T12:00:00Z'}),
    veteranCrest:{value:0,source:'manual',observedAt:'2026-11-26T12:00:00Z'},
    cofferKey:{value:4,source:'manual',observedAt:'2026-11-24T00:00:00Z'},
  }};
  snapshot.resources.cofferKey=field(null);
  const merged=mergeSnapshots(base,parse(snapshot));
  assert.equal(merged.resources.undercoin.value,8);
  assert.equal(merged.resources.veteranCrest.value,0);
  const result=diagnose(merged,{now});
  assert.equal(result.remaining.cofferKey,null);
  assert.deepEqual(result.upgrades,[]);
});

test('운영 시즌 팩은 검증된 정보만 활성화하고 기한이 만료되면 제외',()=>{
  assert.deepEqual(seasonData.rejected,[]);
  const current=rulesAt(now);
  assert.equal(current.byId.get('venomstone-upgrade').effect.quantity,10);
  assert.equal(current.byId.get('vault-voidcore').effect.rewardAvailable,true);
  assert.equal(current.byId.has('regular-upgrade-price'),false);
  assert.deepEqual(current.upgrades,[]);
  assert.deepEqual(rulesAt('2026-12-04T00:00:00+09:00').upgrades,[]);
  assert.equal(rulesAt('2026-12-04T00:00:00+09:00').byId.size,0);
});

test('시즌 규칙별 구조 오류는 해당 행만 격리',()=>{
  const template=rulesAt(now).byId.get('venomstone-upgrade');
  const rule=(id, changes={})=>({...structuredClone(template),ruleId:id,key:id,...changes});
  const rows=[rule('good'),rule('bad-patch',{patch:'12.1.7'}),rule('bad-season',{seasonId:'old'}),
    rule('bad-id',{effect:{currency:'fiction',quantity:1}}),rule('bad-value',{effect:{currency:'venomstone',quantity:-1}}),
    rule('bad-chance',{effect:{currency:'venomstone',quantity:1,probability:1.3}}),
    rule('bad-rank',{effect:{currency:'venomstone',quantity:1,rank:0}}),
    rule('bad-levels',{effect:{currency:'venomstone',quantity:1,levels:[310,309]}}),
    rule('no-verification',{verificationStatus:undefined}),rule('no-spend',{effect:{currency:'venomstone'}}),
    rule('unknown-track',{conditions:{tracks:['INVALID']}}),rule('overlap-1',{key:'shared'}),rule('overlap-2',{key:'shared'}),
    rule('duplicate'),rule('duplicate'),rule('pending',{verificationStatus:'pending'}),rule('expired',{reviewDueAt:'2026-11-26T10:00:00Z'}),
    rule('unverified-cost',{category:'upgrade-table',conditions:{eligibility:'unrestricted',discountPolicy:'none'},effect:{currency:'undercoin',track:'hero',levels:[305,308],crestPerStep:20,goldPerStep:0}})];
  const pack=validateSeasonData(season,resourceDefinitions,rows);
  assert.equal(pack.rejected.length,15);
  assert.deepEqual(activeSeasonRules(pack,now).map(x=>x.ruleId),['good']);
});
