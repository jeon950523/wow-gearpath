import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../contracts/snapshot-v1.schema.json' with {type:'json'};
import {parseAddon} from '../src/addon-import.mjs';
import {maxSavedVariablesBytes,readSavedVariables,latestSavedCharacters} from '../src/saved-variables.mjs';
import {parseUpgradeDiagnostic,upgradeSlotCandidates} from '../src/upgrade-diagnostic.mjs';
import {mergeWorldQuestScan} from '../src/world-quests.mjs';
import {diagnose} from '../src/engine.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL('../contracts/examples/'+name+'.json',import.meta.url)));
const full=fixture('addon-0.4.0-generated-full');
const base=fixture('addon-0.4.0-generated-base');
const now=Date.parse(base.observedAt)+2000;
const options={now};
const luaJson=value=>JSON.stringify(JSON.stringify(value));
const legacy=value=>'WowGearPathDB = { ["lastExport"] = '+luaJson(value)+', }';
const character=(snapshot,history=null)=>`{region="kr",realm="azshara",realmDisplayName="아즈샤라",name=${JSON.stringify(snapshot.name)},snapshotJson=${luaJson(snapshot)}${history?',worldQuestSnapshotJson='+luaJson(history):''}}`;
const container=rows=>'WowGearPathDB = { storageVersion=1, characters={'+rows+'} }';
const epoch=Date.parse(full.observedAt)/1000;
const context={patch:'12.1.5',build:70000,regionID:2,level:90,specializationIndex:1,specializationId:253,lootSpecializationId:0,seasonId:'midnight-s2'};
const costs={id:100,cost:0,discounted:false,watermark:null,partialTwoHand:null,accountWide:false,characterMeets:null};
const observation={state:'costsObserved',baseCostState:'unobserved',identityState:'unresolved',patch:context.patch,build:context.build,
  regionID:2,locale:'koKR',observedAt:epoch,itemId:full.equipment[0].itemId,currentRank:3,maxRank:6,itemLevel:315,pvp:false,
  upgradeable:true,watermarkSlot:0,characterWatermark:0,accountWatermark:null,nextRank:4,increment:3,moneyCopper:0,
  failurePresent:null,currencies:[costs],items:[]};
const diagnostic=()=>structuredClone({kind:'wgg-upgrade-diagnostics',schemaVersion:1,diagnosticVersion:'0.2.0',context,
  observationCount:1,captureCount:1,observations:[{captures:1,observation}]});

test('강화 진단은 한 단계, 0/false/null 및 원시 watermark를 그대로 읽는다',()=>{
  const data=parseUpgradeDiagnostic(JSON.stringify(diagnostic()),options);
  assert.deepEqual(data.observations[0].observation,observation);
  const maximum=diagnostic();
  Object.assign(maximum.observations[0].observation,{state:'maxRank',currentRank:6,nextRank:null,increment:null,
    moneyCopper:null,currencies:null,items:null});
  assert.equal(parseUpgradeDiagnostic(JSON.stringify(maximum),options).observations[0].observation.state,'maxRank');
  assert.throws(()=>parseAddon(JSON.stringify(data),options));
});

test('동일 아이템만으로 대응하지 않으며 여러 슬롯이 일치해도 후보만 남긴다',()=>{
  const data=parseUpgradeDiagnostic(JSON.stringify(diagnostic()),options);
  const current=data.observations[0].observation;
  const snapshot=parseAddon(JSON.stringify(full),options);
  assert.deepEqual(upgradeSlotCandidates(data,current,snapshot),[snapshot.equipment[0].slot]);
  const first=snapshot.equipment[0];
  assert.deepEqual(upgradeSlotCandidates(data,current,{...snapshot,equipment:[{...first,rank:2}]}),[]);
  assert.deepEqual(upgradeSlotCandidates(data,current,{...snapshot,equipment:[first,{...first,slot:'OFF_HAND'}]}),[first.slot,'OFF_HAND']);
  assert.deepEqual(upgradeSlotCandidates(data,current,{...snapshot,specializationId:99}),[]);
  assert.deepEqual(upgradeSlotCandidates(data,current,{...snapshot,observedAt:new Date((epoch+901)*1000).toISOString()}),[]);
  assert.equal(diagnose(snapshot,options).growth.plan,null);
});

for(const [label,change] of [
  ['다단계',row=>row.nextRank=5],['기본 가격 추정',row=>row.baseCostState='estimated'],
  ['인스턴스 단정',row=>row.identityState='matched'],['원시 watermark 자료형',row=>row.watermarkSlot='HEAD'],
  ['보호 필드',row=>row.guid='synthetic-private'],['미래',row=>row.observedAt=epoch+1000],
  ['비용 중복',row=>row.currencies.push(costs)],['음수 비용',row=>row.moneyCopper=-1],
]) test('강화 진단 거부 · '+label,()=>{
  const input=diagnostic();change(input.observations[0].observation);
  assert.throws(()=>parseUpgradeDiagnostic(JSON.stringify(input),options),/강화 진단 형식 오류/);
});

test('legacy Lua의 원래 출처, 관측 시간, 0과 표준 스키마를 보존한다',()=>{
  const raw=legacy(full).replace('테스트','\\237\\133\\140스트');
  const [entry]=readSavedVariables('\uFEFF-- Synthetic\r\n'+raw,options);
  const snapshot=JSON.parse(entry.json);
  const ajv=new Ajv2020({strict:false});addFormats(ajv);
  const check=ajv.compile(schema);
  assert.ok(check(snapshot),JSON.stringify(check.errors));
  assert.equal(snapshot.source,'addon');
  assert.equal(snapshot.name,full.name);
  assert.equal(snapshot.observedAt,full.observedAt);
  assert.deepEqual(snapshot.worldQuests,full.worldQuests);
  assert.equal(snapshot.resources.nebulousVoidcore.value,0);
  assert.ok(snapshot.equipment.every(item=>!Object.hasOwn(item,'itemLink')));
});

test('v1 다중 캐릭터, legacy 중복, 과거 전체 전역퀘의 격리',()=>{
  const other={...base,name:'보조캐릭터'};
  const raw=container(`[1]=${character(base,full)},[2]=${character(other)}`).replace(/ }$/,`, lastExport=${luaJson(full)} }`);
  const entries=readSavedVariables(raw,options);
  assert.deepEqual(entries.map(row=>row.name),[base.name,other.name]);
  assert.equal(entries[0].observedAt,base.observedAt);
  const latest=parseAddon(entries[0].json,options);
  const history=parseAddon(entries[0].historyJson,options);
  assert.equal(latest.worldQuests,undefined);
  const result=diagnose(mergeWorldQuestScan(history,latest),options);
  assert.equal(result.worldQuests.historical,true);
  assert.equal(result.worldQuests.totals.goldCopper,null);
  assert.equal(result.worldQuests.scan.observedAt,full.worldQuests.observedAt);
  assert.equal(latestSavedCharacters([entries[0],...readSavedVariables(legacy(full),options)]).length,1);
});

test('강화 저장 파일은 운영 스냅샷으로 승격하지 않는다',()=>{
  const raw=`WowGearPathUpgradeDB = {storageVersion=1,characters={{region='kr',realmDisplayName='아즈샤라',name='테스트',upgradeJson=${luaJson(diagnostic())}}}}`;
  const [saved]=readSavedVariables(raw,options);
  assert.equal(saved.kind,'upgrade');
  assert.deepEqual(parseUpgradeDiagnostic(saved.json,options),diagnostic());
  assert.throws(()=>parseAddon(saved.json,options));
});

for(const [label,raw] of [
  ['함수', 'WowGearPathDB={lastExport=os.execute("test")}'],
  ['후행 코드',legacy(full)+'; return true'],
  ['중복 키','WowGearPathDB={lastExport="a",["lastExport"]="b"}'],
  ['프로토타입','WowGearPathDB={["__proto__"]={}}'],
  ['깊이','WowGearPathDB={a='+('{a='.repeat(35))+'0'+('}'.repeat(36))],
  ['항목 수','WowGearPathDB={'+('true,'.repeat(10001))+'}'],
  ['미래 버전',container('').replace('Version=1','Version=2')],
  ['희소 배열',container('[2]='+character(base))],
  ['문자열 배열 키',container('["1"]='+character(base))],
  ['긴 Lua 주석', '--[='+('='.repeat(50))+'[\n'+legacy(full)],
  ['중복 캐릭터',container(character(base)+','+character(base))],
  ['장비 캐릭터 충돌',container(character(base).replace('name="테스트"','name="다른캐릭터"'))],
  ['다른 캐릭터 전역퀘',container(character(base,{...full,name:'다른캐릭터'}))],
  ['전역퀘 시각 역행',container(character(base,{...full,observedAt:new Date(now).toISOString()}))],
  ['파일 크기',' '.repeat(maxSavedVariablesBytes+1)],
  ['손상된 이스케이프','WowGearPathDB={lastExport="\\999"}'],
]) test('SavedVariables 거부 · '+label,()=>assert.throws(()=>readSavedVariables(raw,options)));

test('저장 JSON의 개별 상한과 총합을 각각 제한한다',()=>{
  assert.throws(()=>readSavedVariables(legacy({...base,padding:'a'.repeat(262144)}),options));
  const names=['가나다','나다라','다라마','라마바','마바사','바사아','사아자','아자차','자차카'];
  const rows=names.map(name=>character({...base,name,padding:'a'.repeat(240000)}));
  assert.ok(readSavedVariables(container(rows.slice(0,8).join(',')),options).length===8);
  assert.throws(()=>readSavedVariables(container(rows.join(',')),options));
});
