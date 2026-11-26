import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../contracts/snapshot-v1.schema.json' with {type:'json'};
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {diagnose,validate} from '../src/engine.mjs';
import {worldQuestTtl,mergeWorldQuestScan} from '../src/world-quests.mjs';

const ajv=new Ajv2020({strict:false});
addFormats(ajv);
const checkSchema=ajv.compile(schema);
const load=name=>readFileSync(new URL('../contracts/examples/'+name+'.json',import.meta.url),'utf8');
const full=load('addon-0.4.0-generated-full'), base=load('addon-0.4.0-generated-base');
const scanned=JSON.parse(full);
const now=Date.parse(scanned.observedAt)+2000;

test('운영 TOC 모의 생성 v0.4.0 전체를 정본 스키마부터 웹 진단까지 검증',()=>{
  assert.ok(checkSchema(scanned),JSON.stringify(checkSchema.errors));
  const snapshot=validate(mergeSnapshots(null,parseAddon(full,{now})),{now});
  const out=diagnose(snapshot,{now});
  assert.equal(snapshot.addonVersion,'0.4.0');
  assert.equal(out.rawAverage,315);
  assert.equal(snapshot.equipment.length,15);
  assert.equal(snapshot.equipment.every(item=>item.track==='hero' && item.rank===3 && item.maxRank===6),true);
  assert.equal(Object.keys(snapshot.resources).length,12);
  assert.equal(snapshot.resources.nebulousVoidcore.currencyId,3418);
  assert.equal(out.remaining.nebulousVoidcore,0);
  assert.equal(snapshot.resources.gold.value,1234);
  assert.equal(out.remaining.gold,1234);
  assert.equal(out.worldQuests.scan.maps.length,22);
  assert.deepEqual(out.worldQuests.scan,scanned.worldQuests);
  assert.equal(out.worldQuests.totals.goldCopper,12345);
  assert.equal(out.worldQuests.totals.itemCount,1);
  assert.equal(out.worldQuests.totals.currencies[0].quantity,0);
  assert.equal(out.groupEligible,true);
  assert.equal(diagnose(snapshot,{now,solo:true}).groupEligible,false);
  assert.equal(out.growth.plan,null);
});

test('모의 기본 export와 이전 버전의 전체 스키마 수신 및 과거 전역퀘 보존',()=>{
  for (const [raw,version] of [[base,'0.4.0'],[load('resources-0.3.2'),'0.3.2'],[load('details-0.2.1'),'0.2.1']]) {
    const input=JSON.parse(raw);
    assert.ok(checkSchema(input),JSON.stringify(checkSchema.errors));
    const time=Date.parse(input.observedAt)+2000;
    const snapshot=validate(mergeSnapshots(null,parseAddon(raw,{now:time})),{now:time});
    assert.equal(snapshot.addonVersion,version);
    assert.equal(diagnose(snapshot,{now:time}).worldQuests,null);
  }
  const previous=parseAddon(full,{now});
  const basic=parseAddon(base,{now});
  const historical=mergeWorldQuestScan(previous,basic);
  assert.equal(historical.worldQuests.observedAt,previous.worldQuests.observedAt);
  assert.equal(diagnose(historical,{now}).worldQuests.historical,true);
  assert.equal(diagnose(historical,{now}).worldQuests.totals.goldCopper,null);
});

test('생성 JSON의 원래 시각으로 TTL 경계를 검증한다',()=>{
  const at=Date.parse(scanned.worldQuests.observedAt);
  const snapshot=parseAddon(full,{now});
  assert.equal(diagnose(snapshot,{now:at+worldQuestTtl-1}).worldQuests.historical,false);
  const stale=diagnose(snapshot,{now:at+worldQuestTtl});
  assert.equal(stale.worldQuests.historical,true);
  assert.equal(stale.worldQuests.totals.goldCopper,null);
  assert.equal(stale.remaining.gold,1234);
  assert.equal(stale.worldQuests.scan.observedAt,scanned.worldQuests.observedAt);
});
