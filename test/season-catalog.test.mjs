import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {catalogApplies,compareMerchantCandidate,seasonCatalog} from '../src/season-catalog.mjs';
import {stageGrowthObservations,stageUpgradeComparison} from '../src/season-observation-staging.mjs';

const now=Date.parse('2026-11-28T09:00:00Z');
const character={name:'합성하나',realmDisplayName:'합성서버',region:'kr',patch:'12.1.5',seasonId:'midnight-s2',specializationId:253,lootSpecializationId:0};
const fixture=name=>JSON.parse(readFileSync(new URL('../contracts/examples/'+name+'.json',import.meta.url)));
test('웹 시즌 팩의 출처, 난이도, typed 재료 및 현재 판매와 분리된 후보',()=>{
  assert.ok(catalogApplies({...character,now}));
  for(const changes of [{patch:'12.1.7'},{region:'us'},{seasonId:'midnight-s1'},{now:Date.parse(seasonCatalog.reviewDueAt)}]){
    assert.equal(catalogApplies({...character,now,...changes}),false);
  }
  assert.deepEqual(seasonCatalog.delveRewards.tiers.map(row=>row.tier),Array.from({length:11},(_,i)=>i+1));
  assert.equal(seasonCatalog.delveRewards.tiers[7].vault,305);
  for(const row of [...seasonCatalog.vendors,...seasonCatalog.recipes]){
    for(const key of row.sources) assert.ok(seasonCatalog.sources[key].url.startsWith('https://'));
  }
  for(const row of seasonCatalog.vendors){
    assert.ok(!Object.hasOwn(row,'available'));
    assert.ok(!Object.hasOwn(row,'eligible'));
  }
  assert.equal(seasonCatalog.vendors.find(row=>row.id==='zahran-champion').cost.quantity,null);
  const mith=seasonCatalog.vendors.find(row=>row.id==='kindojan-myth');
  assert.equal(mith.track,'신화 2/6');
  assert.equal(mith.itemLevel,null);
  assert.equal(mith.cost.kind,null);
  const [recipe]=seasonCatalog.recipes;
  assert.ok(recipe.baseMaterials.every(item=>item.kind==='item' && item.id>0 && item.quantity>0));
});

test('상인 미수집, 실패한 대조 및 다른 특성·캐릭터를 구별한다',()=>{
  const sample=fixture('merchant-diagnostics-v1-synthetic');
  Object.assign(sample,{observedAt:now/1000,build:70961,mapID:1,filter:0});
  const offer={npcID:sample.npcID,mapID:1,filter:0,specID:253,lootSpecID:0,itemID:1002,itemLevel:300,priceCopper:20,costs:[]};
  sample.rows[1].priceCopper=20;
  const history={...character,merchant:[sample]};
  const verify=(overrides={})=>compareMerchantCandidate({offer,history,character,now,...overrides});
  assert.equal(verify({history:null}),'uncollected');
  assert.equal(verify({history:{...history,merchant:[]}}),'uncollected');
  assert.equal(verify(),'corroborated');
  assert.equal(verify({offer:{...offer,priceCopper:0}}),'conflict');
  assert.equal(verify({character:{...character,name:'합성둘'}}),'unverified');
  assert.equal(verify({character:{...character,lootSpecializationId:1}}),'unverified');
  assert.equal(verify({now:now+15*60*1000}),'unverified');
  assert.equal(verify({history:{...history,merchant:[sample,structuredClone(sample)]}}),'unverified');
  assert.equal(verify({offer:{...offer,itemLevel:null}}),'unverified');
});

test('익명 제작 관측은 타 캐릭터와 결합하지 않고 미수집·0·null을 보존한다',()=>{
  const db=fixture('growth-diagnostics-storage-v1-synthetic');
  const raw=JSON.parse(db.characters[0].craft[0]);
  raw.recipeID=1230062;
  raw.inventory.slotState='unknown';
  raw.inventory.requirements=[];
  db.characters[0].craft=[JSON.stringify(raw)];
  db.characters[0].merchant=[];
  const selected=stageGrowthObservations(db,character,{now});
  assert.deepEqual(selected.merchant,[]);
  assert.equal(selected.craft[0].inventory.slotState,'unknown');
  assert.equal(selected.craft[0].draft.tipCopper,0);
  assert.equal(selected.craft[0].draft.postingFeeCopper,null);
  assert.equal(selected.craft[0].consumption,'unverified');
  assert.equal(stageGrowthObservations(db,{...character,name:'합성셋'},{now}),null);
  assert.equal(stageUpgradeComparison({kind:'upgrade',name:'별도이름',json:'{}'},character,{now}),null);
});

test('합성 성장 Lua를 비실행으로 읽고 캐릭터별 과거 관측을 준비한다',async()=>{
  const {stageGrowthSavedVariables}=await import('../src/season-observation-staging.mjs');
  const raw=readFileSync(new URL('../contracts/examples/growth-diagnostics-storage-v1-synthetic.lua',import.meta.url),'utf8');
  const selected=stageGrowthSavedVariables(raw,{...character,name:'합성둘'},{now});
  assert.equal(selected.merchant.length,0);
  assert.equal(selected.craft[0].observedAt,1795748400);
  assert.throws(()=>stageGrowthSavedVariables(raw+'; return true',character,{now}));
  assert.throws(()=>stageGrowthSavedVariables(raw.replace('["characters"] = {','["characters"] = { [3]='),character,{now}));
});
