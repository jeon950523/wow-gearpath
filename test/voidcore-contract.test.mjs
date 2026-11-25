import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {diagnose,validate} from '../src/engine.mjs';

const now=new Date('2026-11-26T12:35:00Z');
const fixture=name=>JSON.parse(readFileSync(new URL('../contracts/examples/'+name+'.json',import.meta.url)));
const parse=snapshot=>parseAddon(JSON.stringify(snapshot),{now});
const input=()=>fixture('resources-0.3.2');
const row=(snapshot)=>snapshot.resources.nebulousVoidcore;

test('v0.3.2 애드온 생성 예제의 12종 재화와 315 경계를 웹 엔진에서 검증',()=>{
  const original=input(), merged=validate(mergeSnapshots(null,parse(original)));
  assert.equal(merged.addonVersion,'0.3.2');
  assert.equal(merged.patch,'12.1.5');
  assert.equal(Object.keys(merged.resources).length,12);
  assert.deepEqual(merged.resources,original.resources);
  const output=diagnose(merged,{now});
  assert.equal(output.remaining.nebulousVoidcore,0);
  assert.equal(output.rawAverage,315);
  assert.equal(output.groupEligible,true);
  assert.equal(diagnose(merged,{now,solo:true}).groupEligible,false);
  assert.deepEqual(output.upgrades,[]);
});

test('3418 양수, 0, 미수집 및 실패와 오래된 관측값을 구별',()=>{
  for(const [value,state] of [[5,'observed'],[0,'observed'],[null,'uncollected'],[null,'failed']]){
    const snapshot=input();
    Object.assign(row(snapshot),{value,state});
    const merged=validate(mergeSnapshots(null,parse(snapshot)));
    assert.deepEqual(row(merged),row(snapshot));
    assert.equal(diagnose(merged,{now}).remaining.nebulousVoidcore,value);
    assert.equal(diagnose(merged,{now:new Date(+now+86400001)}).remaining.nebulousVoidcore,null);
  }
});

test('3513 또는 ID 없는 관측값은 격리하고 기존 장비와 다른 재화는 유지',()=>{
  for(const [id,value,state] of [[3513,9,'observed'],[3513,null,'uncollected'],[undefined,0,'observed']]){
    const snapshot=input();
    snapshot.addonVersion='0.3.1';
    Object.assign(row(snapshot),{currencyId:id,value,state});
    assert.throws(()=>validate(snapshot),/화폐 ID/);
    const merged=validate(mergeSnapshots(null,parse(snapshot)));
    assert.equal(row(merged).value,null);
    assert.equal(row(merged).state,'uncollected');
    assert.equal(row(merged).currencyId,undefined);
    assert.equal(merged.equipment.length,15);
    assert.deepEqual(merged.resources.undercoin,snapshot.resources.undercoin);
    assert.ok(merged.collectionWarnings.some(warning=>warning.includes('다시 수집')));
  }
  for(const id of [3513,9999,'3418']){
    const snapshot=input();
    row(snapshot).currencyId=id;
    assert.throws(()=>parse(snapshot),/currencyId/);
    assert.throws(()=>validate(snapshot),/화폐 ID/);
  }
});

test('병합에서 과거 3513, 수동 메모, 신규 3418 및 전투부대 잔액을 분리',()=>{
  const old=input();
  old.addonVersion='0.3.1';
  Object.assign(row(old),{value:20,currencyId:3513,observedAt:'2026-11-26T12:00:00Z'});
  const newer=input();
  Object.assign(row(newer),{value:null,state:'uncollected'});
  const unknown=mergeSnapshots(old,parse(newer));
  assert.deepEqual(row(unknown),row(newer));
  Object.assign(row(newer),{value:4,state:'observed',scope:'warband'});
  assert.deepEqual(row(mergeSnapshots(old,parse(newer))),row(newer));
  const olderCanonical=parse(newer);
  Object.assign(row(olderCanonical),{value:3,observedAt:'2026-11-26T11:00:00Z'});
  assert.equal(row(mergeSnapshots(olderCanonical,parse(newer))).value,4);
  const manual={...parse(newer),resources:{nebulousVoidcore:{value:7,source:'manual',observedAt:old.observedAt}}};
  const retained=mergeSnapshots(manual,parse(old));
  assert.deepEqual(row(retained),row(manual));
  assert.equal(diagnose(retained,{now}).remaining.nebulousVoidcore,null);
});

test('익명 사냥꾼 재구성 장비와 합성 0.3.2 재화의 310.5 통합 회귀',()=>{
  const hunter=fixture('hunter-310.5-reconstructed');
  const synthesized=input();
  const merged=validate(mergeSnapshots(null,parse({...hunter,addonVersion:synthesized.addonVersion,
    patch:synthesized.patch,resources:synthesized.resources})));
  const output=diagnose(merged,{now});
  assert.equal(output.rawAverage,310.5);
  assert.equal(output.groupEligible,false);
  assert.equal(merged.equipment.length,15);
  assert.equal(row(merged).currencyId,3418);
});
