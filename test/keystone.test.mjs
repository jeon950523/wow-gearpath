import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnose} from '../src/engine.mjs';
import {sample} from '../src/sample.mjs';
test('보유 쐐기는 315 이상일 때 후보 이유에만 표시',()=>{
  const p=sample();p.equipment.forEach(x=>x.ilvl=315);
  p.keystone={dungeon:'테스트 던전',level:10,source:'manual',observedAt:p.observedAt};
  const r=diagnose(p,{now:'2026-11-26T10:00:00+09:00'});
  assert.match(r.activities.find(x=>x.id==='mythic').reason,/테스트 던전 \+10/);
  p.equipment.forEach(x=>x.ilvl=314);
  assert.ok(!diagnose(p,{now:'2026-11-26T10:00:00+09:00'}).activities.some(x=>x.id==='mythic'));
});
