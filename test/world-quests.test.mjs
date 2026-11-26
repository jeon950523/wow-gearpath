import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {parseAddon,mergeSnapshots,maxImportBytes} from '../src/addon-import.mjs';
import {diagnose,validate} from '../src/engine.mjs';
import {mergeWorldQuestScan,worldQuestTtl} from '../src/world-quests.mjs';
import schema from '../contracts/snapshot-v1.schema.json' with {type:'json'};

const ajv=new Ajv2020({strict:false});
addFormats(ajv);
const validateSchema=ajv.compile(schema);
const now=Date.parse('2026-11-26T12:35:00Z');
const raw=readFileSync(new URL('../contracts/examples/world-quests-004h-synthetic.json',import.meta.url),'utf8');
const fixture=()=>JSON.parse(raw);
const parse=value=>parseAddon(JSON.stringify(value),{now});
const analyze=(snapshot,options={})=>diagnose(snapshot,{now,...options});
const row=(data,index=0)=>data.worldQuests.rows[index];

test('표준 스키마와 웹 경로에서 ADDON-004H 합성 스냅샷·기존 재화 검증',()=>{
  const input=fixture();
  assert.ok(validateSchema(input),JSON.stringify(validateSchema.errors));
  const merged=validate(mergeSnapshots(null,parse(input)),{now});
  assert.deepEqual(merged.worldQuests,input.worldQuests);
  const result=analyze(merged);
  assert.deepEqual(result.worldQuests.totals,{goldCopper:123456,itemCount:1,currencies:[]});
  assert.equal(result.worldQuests.rows[3].row.cached.gold.value,4567);
  assert.equal(result.worldQuests.rows[3].row.cached.gold.observedAt,'2026-11-26T12:30:00Z');
  assert.equal(result.worldQuests.rows[2].active,false);
  assert.equal(result.groupEligible,true);
  assert.equal(analyze(merged,{solo:true}).groupEligible,false);
  const legacy=fixture();
  delete legacy.worldQuests;
  assert.ok(validateSchema(legacy),JSON.stringify(validateSchema.errors));
  assert.equal(analyze(parse(legacy)).worldQuests,null);
  assert.deepEqual(result.remaining,analyze(parse(legacy)).remaining);
  assert.deepEqual(result.growth,analyze(parse(legacy)).growth);
  assert.equal(merged.resources.nebulousVoidcore.currencyId,3418);
});

test('빈 스캔, 모듈 생략, 확인된 0과 미확인 0의 의미를 보존',()=>{
  const input=fixture();
  const empty=fixture();
  empty.worldQuests.rows=[];
  empty.worldQuests.state='uncollected';
  assert.equal(analyze(parse(empty)).worldQuests.rows.length,0);
  const first=row(input), ambiguous=row(input,2);
  ambiguous.expiresAt=first.expiresAt;
  ambiguous.expiryObservedAt=first.expiryObservedAt;
  ambiguous.currencies.rows[0].quantity=0;
  const result=analyze(parse(input));
  assert.equal(result.worldQuests.rows[2].locationUsable,false);
  assert.equal(result.worldQuests.rows[2].active,true);
  assert.equal(result.worldQuests.rows[2].row.gold.state,'zeroUnverified');
  assert.equal(result.worldQuests.rows[2].row.gold.value,null);
  assert.equal(result.worldQuests.totals.currencies[0].quantity,0);
});

test('스캔 시각·공통 컨텍스트와 독립 TTL로 추천과 만료를 제한',()=>{
  const input=fixture();
  row(input).expiresAt='2026-11-26T12:35:01Z';
  const snapshot=parse(input);
  assert.equal(analyze(snapshot).worldQuests.nextRefresh,now+1000);
  assert.equal(analyze(snapshot,{now:now+1000}).worldQuests.totals.goldCopper,null);
  assert.equal(analyze(snapshot,{now:Date.parse(input.worldQuests.observedAt)+worldQuestTtl}).worldQuests.historical,true);
  for(const mode of ['unknown','completed','context','patch']){
    const variant=fixture();
    if(mode==='unknown') Object.assign(row(variant,3),{activeUnverified:true,completed:null,cached:undefined});
    if(mode==='completed') Object.assign(row(variant,3),{completed:true,cached:undefined});
    if(mode==='context') {variant.worldQuests.context=null;delete row(variant,3).cached;}
    if(mode==='patch') delete variant.patch;
    assert.equal(analyze(parse(variant)).worldQuests.rows[3].active,false);
  }
});

test('모듈 시각 기준 원자 교체, 동시각 충돌, 오래된 입력, 전문화 변경 및 이전 버전',()=>{
  const input=fixture(), old=parse(input);
  assert.equal(mergeWorldQuestScan(old,parse(fixture())).worldQuestConflict,undefined);
  const later=fixture();
  later.observedAt='2026-11-26T12:35:02Z';
  later.worldQuests.observedAt=later.observedAt;
  later.worldQuests.rows=[row(later,1)];
  const latest=parse(later);
  assert.equal(mergeSnapshots(old,latest,{prefer:'base'}).worldQuests.rows.length,1);
  assert.equal(analyze(mergeSnapshots(old,latest,{prefer:'base'}),{now:now+2000}).worldQuests.rows.length,1);
  assert.deepEqual(mergeSnapshots(latest,old).worldQuests,latest.worldQuests);
  const divergent=fixture();
  row(divergent).title='서로 다른 목록';
  const conflicting=mergeSnapshots(old,parse(divergent));
  assert.deepEqual(conflicting.worldQuests,old.worldQuests);
  assert.equal(analyze(conflicting).worldQuests.conflict,true);
  assert.equal(analyze(conflicting).worldQuests.totals.goldCopper,null);
  const legacy=fixture();
  delete legacy.worldQuests;
  legacy.observedAt=later.observedAt;
  const retained=mergeWorldQuestScan(old,parse(legacy));
  assert.equal(retained.worldQuests,old.worldQuests);
  assert.equal(analyze(retained).worldQuests.historical,true);
  const newerOtherContext=fixture();
  newerOtherContext.observedAt=later.observedAt;
  newerOtherContext.worldQuests.context.specializationIndex=2;
  assert.equal(mergeWorldQuestScan(old,parse(newerOtherContext)).worldQuestHistory,true);
  const wrongCharacter={...latest,name:'다른이'};
  assert.throws(()=>mergeSnapshots(old,wrongCharacter));
});

const invalid=[
  ['보호 필드',x=>row(x).guid='synthetic-private',true],
  ['그룹 외부 필드',x=>row(x).gold.secret='synthetic-private',true],
  ['모듈 외부 필드',x=>x.worldQuests.accountId='synthetic-private',true],
  ['중복 퀘스트',x=>x.worldQuests.rows.push(row(x)),false],
  ['중복 지도',x=>x.worldQuests.maps.push(x.worldQuests.maps[0]),false],
  ['후보 중복',x=>row(x).mapCandidates=[2444,2444],true],
  ['선택 보상 초과',x=>row(x,1).choices.rows=Array(21).fill(row(x,1).choices.rows[0]),true],
  ['정수 초과',x=>row(x).gold.value=Number.MAX_SAFE_INTEGER+1,true],
  ['표시 골드 합계 초과',x=>{row(x).gold.value=Number.MAX_SAFE_INTEGER;row(x,1).gold=structuredClone(row(x).gold);},false],
  ['음수 화폐',x=>row(x,2).currencies.rows[0].quantity=-1,true],
  ['골드 0',x=>row(x).gold.value=0,true],
  ['관측 골드 null',x=>row(x).gold.value=null,true],
  ['상태 불일치',x=>row(x).ready=false,false],
  ['완료 미확인',x=>row(x).completed=null,true],
  ['아이템 개수 불일치',x=>row(x,1).items.count=2,false],
  ['스캔 출처 오류',x=>row(x).scanMaps=[999],false],
  ['모호 위치에 지도 사용',x=>row(x,2).mapId=2444,true],
  ['만료 쌍 오류',x=>row(x).expiryObservedAt=null,true],
  ['관측 전에 만료',x=>row(x).expiresAt='2026-11-26T12:00:00Z',false],
  ['실재하지 않는 날짜',x=>row(x).gold.observedAt='2026-02-30T12:34:56Z',false],
  ['미래 스캔',x=>x.worldQuests.observedAt='2026-11-27T12:00:00Z',false],
  ['캐시 시간 오류',x=>row(x,3).cached.gold.observedAt='2026-11-26T13:00:00Z',false],
  ['캐시 문맥 누락',x=>x.worldQuests.context=null,false],
];
for(const [name,mutate,schemaRejects] of invalid) test('전역퀘 거부 · '+name,()=>{
  const input=fixture();
  mutate(input);
  if(schemaRejects) assert.equal(validateSchema(input),false);
  assert.throws(()=>parse(input),/전역퀘 데이터 오류/);
});

test('256 KiB는 문자열 길이가 아닌 UTF-8 크기로 판정',()=>{
  assert.throws(()=>parseAddon(raw+'가'.repeat(Math.floor(maxImportBytes/3)),{now}),/256 KiB/);
});
