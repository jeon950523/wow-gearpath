import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {diagnose} from '../src/engine.mjs';
const now=new Date('2026-11-26T12:35:00Z');
const fixture=name=>JSON.parse(readFileSync(new URL('../contracts/examples/'+name+'.json',import.meta.url)));
const parse=data=>parseAddon(JSON.stringify(data),{now});

test('양쪽 버전의 생성 fixture와 인게임 기록 기반 회귀',()=>{
  for(const [name,value] of [['hunter-regression',308.6875],['hunter-310.5-reconstructed',310.5],['details-0.2.0',315],['details-0.2.1',315]]){
    const original=fixture(name), result=mergeSnapshots(null,parse(original));
    assert.equal(diagnose(result,{now}).rawAverage,value,name);
    for(const key of ['classFile','classId','className','level','specializationId','specializationName','role']) if(key in original) assert.deepEqual(result[key],original[key]);
    for(const key of ['maxRank','setId','bonusIds','upgradeStatus','upgradeText']) if(key in original.equipment[0]) assert.deepEqual(result.equipment[0][key],original.equipment[0][key]);
  }
  const dual=fixture('details-0.2.1');
  dual.weaponMode='dual-wield';dual.equipment.push({slot:'OFF_HAND',itemId:999,ilvl:299});
  assert.equal(diagnose(parse(dual),{now}).rawAverage,314);
});
test('같은 장비의 API 미디어만 남기고 다른 인스턴스로 강화 정보를 복제하지 않음',()=>{
  const input=fixture('details-0.2.1');
  const addon=parse(input);
  const api={...addon,source:'blizzard',equipment:addon.equipment.map(item=>({...item,rank:null,track:null,icon:'https://render.worldofwarcraft.com/gear.jpg'}))};
  assert.equal(mergeSnapshots(api,addon).equipment[0].icon,api.equipment[0].icon);
  api.equipment[0].bonusIds=[999];
  assert.equal(mergeSnapshots(api,addon).equipment[0].icon,undefined);
  assert.equal(mergeSnapshots(api,addon,{prefer:'base'}).equipment[0].rank,null);
  assert.equal(mergeSnapshots(api,addon).profile.specialization,'야수');
});
test('기존 병합을 다시 병합해도 개별 시각과 false/0 보존',()=>{
  const data=fixture('details-0.2.1'), old='2026-11-22T00:00:00Z';
  data.progress={observedAt:data.observedAt,source:'addon',maxDelveTier:11,venomstoneUnlocked:true,vaultWorld:0};
  data.fieldSources={progress:{maxDelveTier:{source:'addon',observedAt:old},venomstoneUnlocked:{source:'addon',observedAt:old}}};
  data.resources.cofferKey.value=1;
  const addon=parse(data);
  const base={...addon,source:'blizzard',progress:{source:'manual',observedAt:'2026-11-26T12:00:00Z',venomstoneUnlocked:false},fieldSources:{}};
  const merged=mergeSnapshots(mergeSnapshots(base,addon),addon);
  assert.equal(merged.progress.venomstoneUnlocked,false);
  assert.equal(merged.progress.vaultWorld,0);
  assert.equal(merged.fieldSources.progress.maxDelveTier.observedAt,old);
  assert.equal(diagnose(merged,{now}).activities.some(x=>x.id==='venomstone'),false);
});
test('잘못된 선택 필드 거부 및 알 수 없는 민감 필드 제외',()=>{
  for(const change of [x=>x.classId='3',x=>x.role='UNKNOWN',x=>x.equipment[0].maxRank=1,x=>x.equipment[0].bonusIds=['1'],x=>x.equipment[0].upgradeStatus='pending']) {
    const data=fixture('details-0.2.1');change(data);assert.throws(()=>parse(data));
  }
  const input=fixture('details-0.2.1');input.battleTag='sensitive-tag';input.equipment[0].token='sensitive-token';
  assert.doesNotMatch(JSON.stringify(parse(input)),/sensitive-|battleTag/);
  for(const state of ['not-observed','ambiguous']){
    input.equipment[1].upgradeStatus=state;
    assert.equal(parse(input).equipment[1].upgradeStatus,state);
  }
});
