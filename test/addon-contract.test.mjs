import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAddon,mergeSnapshots,maxImportBytes} from '../src/addon-import.mjs';
import {diagnose} from '../src/engine.mjs';

const fixture = name => readFileSync(new URL(`../contracts/examples/${name}.json`,import.meta.url),'utf8');
const mock=fixture('mock-snapshot'), hunter=fixture('hunter-regression');
const now=new Date('2026-11-26T12:35:00Z');
const parse=raw=>parseAddon(raw,{now});
const mutate=callback=>{const data=JSON.parse(mock);callback(data);return JSON.stringify(data);};

test('애드온 v0.1.1 사냥꾼 회귀와 315 경계를 실제 엔진에서 검증',()=>{
  const ranged=diagnose(parse(hunter),{now});
  assert.equal(ranged.rawAverage,308.6875);
  assert.equal(ranged.groupEligible,false);
  assert.equal(diagnose(parse(mock),{now}).groupEligible,true);
  assert.equal(diagnose(parse(mock),{now,solo:true}).groupEligible,false);
});
test('타 캐릭터 거부, 무효 입력 및 중복 장비 거부',()=>{
  const against=parse(mock);
  assert.throws(()=>parseAddon(mutate(x=>x.name='다른이름'),{now,against}),/다릅니다/);
  assert.throws(()=>parseAddon(mutate(x=>x.realm='other-realm'),{now,against}),/다릅니다/);
  for(const raw of ['{', ' '.repeat(maxImportBytes+1),mutate(x=>x.schemaVersion=2),mutate(x=>x.patch='12.2.0'),mutate(x=>x.equipment[0].slot='INVALID'),mutate(x=>x.equipment[1].slot=x.equipment[0].slot)]) assert.throws(()=>parse(raw));
});
test('재화 null은 수동 0을 유지하고 관측 출처를 보존',()=>{
  const addon=parse(mock);
  const observedAt='2026-11-26T12:30:00Z';
  const base={...addon,source:'blizzard',observedAt,resources:{cofferKey:{source:'manual',observedAt,value:0}}};
  const merged=mergeSnapshots(base,addon);
  assert.deepEqual(merged.resources.cofferKey,base.resources.cofferKey);
  assert.equal(merged.resources.gold.source,'addon');
  assert.equal(merged.fieldSources.equipment.source,'addon');
  assert.deepEqual(mergeSnapshots(base,parse(mock)),merged);
});
test('장비 인스턴스끼리 트랙 합치지 않으며 오래된 스냅샷은 그룹 보류',()=>{
  const addon=parse(hunter),base={...parse(mock),source:'blizzard'};
  base.equipment[0].track='HERO';base.equipment[0].rank=1;
  assert.equal(mergeSnapshots(base,addon,{prefer:'addon'}).equipment[0].track,null);
  assert.equal(mergeSnapshots(base,addon,{prefer:'base'}).equipment[0].track,'HERO');
  const later=new Date('2026-11-28T12:35:00Z');
  const stale=parseAddon(mock,{now:later});
  assert.match(stale.collectionWarnings.join(' '),/24시간/);
  assert.equal(diagnose(stale,{now:later}).groupEligible,false);
});
test('알 수 없는 필드와 민감한 확장은 분석 결과에 포함하지 않음',()=>{
  const result=parse(mutate(x=>{x.client_secret='fixture-secret';x.extensions={BattleTag:'private'};x.equipment[0].token='fixture-token';}));
  assert.doesNotMatch(JSON.stringify(result),/fixture-secret|fixture-token|BattleTag/);
});
