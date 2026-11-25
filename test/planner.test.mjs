import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnose,SLOTS} from '../src/engine.mjs';
import {sample} from '../src/sample.mjs';
import {normalize,createBlizzardClient} from '../src/blizzard.mjs';
import {renderReport} from '../src/report.mjs';

const now='2026-11-26T10:00:00+09:00';
const run=(p,options={})=>diagnose(p,{now,...options});
function atLevel(n) {const p=sample();p.equipment.forEach(x=>{x.ilvl=n;x.track=null;x.rank=null;});return p;}
test('315 정확한 경계에서 그룹 후보 추가, 솔플 후보 유지',()=>{
  for(const n of [314,314.999,315,316]) {
    const r=run(atLevel(n));assert.equal(r.groupEligible,n>=315);
    assert.equal(r.activities.filter(x=>x.kind==='group').length,n>=315?2:0);
    assert.ok(r.activities.some(x=>x.id==='delves'));
  }
});
test('양손 무기 가중치 2, 셔츠/겉옷 제외 모델',()=>{
  const p=atLevel(300);p.equipment.find(x=>x.slot==='MAIN_HAND').ilvl=320;
  assert.equal(run(p).rawAverage,302.5);
});
test('보조 장비는 별도 가중치',()=>{
  const p=atLevel(300);p.weaponMode='dual-wield';p.equipment.push({slot:'OFF_HAND',itemId:777,ilvl:316});
  assert.equal(run(p).rawAverage,301);
});
test('누락 슬롯 / 미확인 무기 방식은 315 판정 보류',()=>{
  let p=atLevel(320);p.equipment.pop();assert.equal(run(p).rawAverage,null);
  p=atLevel(320);p.weaponMode='unknown';assert.equal(run(p).groupEligible,false);
});
test('양손과 보조장비가 충돌하면 평균 보류',()=>{
  const p=atLevel(320);p.equipment.push({slot:'OFF_HAND',itemId:7,ilvl:320});assert.equal(run(p).rawAverage,null);
});
test('가방 포함 API 평균은 315 판정에 사용하지 않음',()=>{
  const p=atLevel(310);p.reportedEquippedAverage=330;assert.equal(run(p).groupEligible,false);
});
test('미입력 재화와 0개 구분',()=>{
  const p=sample();p.resources.cofferKey.value=null;
  assert.equal(run(p).activities.find(x=>x.id==='bountiful').title,'풍요로운 구렁 열쇠 수량 입력');
  p.resources.cofferKey.value=0;
  assert.equal(run(p).activities.find(x=>x.id==='bountiful').title,'열쇠 획득 경로 확인');
});
test('오래된 재화는 소비하지 않음',()=>{
  const p=sample();p.resources.demoCrest.observedAt='2026-11-20T00:00:00Z';assert.equal(run(p,{demo:true}).upgrades.length,0);
});
test('오래된 장비와 미래 시각은 그룹 추천 보류',()=>{
  for(const at of ['2026-11-20T00:00:00Z','2026-11-28T00:00:00Z']) {const p=atLevel(320);p.observedAt=at;assert.equal(run(p).groupEligible,false);}
});
test('이전 시즌과 규칙 유효기간 경과는 시즌 추천 보류',()=>{
  const p=atLevel(320);p.seasonId='midnight-s1';assert.equal(run(p).activities.length,1);
  assert.equal(run(atLevel(320),{now:'2026-12-04T00:00:00Z'}).groupEligible,false);
});
test('실제 모드에는 가상 강화표 사용하지 않음',()=>assert.equal(run(sample()).upgrades.length,0));
test('샘플 외 출처에 데모 소비 계산 금지',()=>{const p=sample();p.source='manual';assert.throws(()=>run(p,{demo:true}));});
test('공유 예산 초과 없이 차감, 입력 불변',()=>{
  const p=sample(),copy=structuredClone(p),r=run(p,{demo:true});
  assert.equal(r.upgrades.length,3);assert.equal(r.remaining.demoCrest,0);assert.equal(r.remaining.gold,700);assert.deepEqual(p,copy);
});
test('골드 제한을 함께 적용',()=>{
  const p=sample();p.resources.gold.value=99;assert.equal(run(p,{demo:true}).upgrades.length,0);
});
test('트랙 단계와 아이템 레벨 불일치 강화 제외',()=>{
  const p=sample();p.equipment.forEach(x=>x.ilvl=309);assert.equal(run(p,{demo:true}).upgrades.length,0);
});
test('단계 상한 이후 강화 없음',()=>{
  const p=sample();p.equipment.forEach(x=>{x.rank=6;x.ilvl=324;});assert.equal(run(p,{demo:true}).upgrades.length,0);
});
test('11단/해금/열쇠 모두 있을 때만 맹독석 조건부 후보',()=>{
  const p=sample();p.progress.maxDelveTier=11;p.progress.venomstoneUnlocked=true;assert.ok(run(p).activities.some(x=>x.id==='venomstone'));
  p.resources.cofferKey.value=0;assert.ok(!run(p).activities.some(x=>x.id==='venomstone'));
});
test('오래된 해금 진행으로 추가 추천 금지',()=>{
  const p=sample();p.progress.maxDelveTier=11;p.progress.venomstoneUnlocked=true;p.progress.observedAt='2026-11-20T00:00:00Z';assert.ok(!run(p).activities.some(x=>x.id==='venomstone'));
});
test('중복 슬롯 / 음수 재화 / 잘못된 버전 / NaN 거부',()=>{
  const variants=[p=>p.equipment.push(p.equipment[0]),p=>p.resources.gold.value=-1,p=>p.schemaVersion=2,p=>p.equipment[0].ilvl=NaN,p=>p.progress.maxDelveTier=12];
  for(const mutate of variants){const p=sample();mutate(p);assert.throws(()=>run(p));}
});
test('HTML 사용자 입력은 실행되지 않도록 escape',()=>{
  const p=sample();p.name='<script>alert(1)</script>';const html=renderReport(run(p));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});

const apiEquipment={character:{id:1},equipped_items:[{slot:{type:'MAIN_HAND'},item:{id:123},name:'무기',level:{value:315},inventory_type:{type:'TWOHWEAPON'}},{slot:{type:'TABARD'},item:{id:3},level:{value:1}}]};
test('API 어댑터: 보유 재화와 트랙 추정 금지, 로그인 시각 보존',()=>{
  const p=normalize({id:1,name:'테스트',last_login_timestamp:Date.parse('2026-11-20T00:00:00Z')},apiEquipment,{realm:'azshara',name:'테스트',observedAt:now});
  assert.equal(p.equipment.length,1);assert.equal(p.weaponMode,'two-hand');assert.equal(p.equipment[0].track,null);assert.deepEqual(p.resources,{});assert.equal(p.observedAt,'2026-11-20T00:00:00.000Z');
});
test('잘못된 캐릭터 식별자 거부',()=>assert.throws(()=>normalize({id:2},apiEquipment,{observedAt:now})));
test('비밀키 없을 때 네트워크 호출 안 함',async()=>{
  const c=createBlizzardClient({fetchImpl:()=>{throw new Error('should not call');}});await assert.rejects(c.character('azshara','테스트'),/환경 변수/);
});
test('OAuth 캐시, KR namespace, 한글 인코딩 및 Authorization 헤더',async()=>{
  const calls=[];const c=createBlizzardClient({clientId:'fake',clientSecret:'fake',fetchImpl:async(url,opts)=>{
    calls.push({url,opts});return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'fake-token',expires_in:3600}:url.includes('/equipment?')?apiEquipment:{id:1,name:'테스트',last_login_timestamp:Date.now()}};
  }});
  await c.character('azshara','테스트');await c.character('azshara','테스트');
  assert.equal(calls.filter(x=>x.url.endsWith('/token')).length,1);
  for(const call of calls.filter(x=>!x.url.endsWith('/token'))) {assert.ok(call.url.includes('namespace=profile-kr'));assert.ok(call.url.includes('%ED%85%8C'));assert.equal(call.opts.headers.Authorization,'Bearer fake-token');assert.ok(!call.url.includes('fake-token'));}
});
for(const status of [401,403,404,429,500]) test(`API ${status} 안전한 오류 처리`,async()=>{
  const c=createBlizzardClient({clientId:'fake',clientSecret:'secret',fetchImpl:async()=>({ok:false,status,json:async()=>({secret:'secret'})})});
  await assert.rejects(c.character('azshara','테스트'),e=>e.message.includes(String(status))&&!e.message.includes('secret'));
});
test('네트워크 실패는 내부 요청 노출 없이 표시',async()=>{
  const c=createBlizzardClient({clientId:'fake',clientSecret:'secret',fetchImpl:async()=>{throw new Error('secret');}});await assert.rejects(c.character('azshara','테스트'),/연결 실패/);
});
