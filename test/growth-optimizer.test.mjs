import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {analyzeGear} from '../src/engine/gear-growth.mjs';
import {optimizeGrowth} from '../src/engine/growth-optimizer.mjs';
import {diagnose} from '../src/engine.mjs';
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {validateSeasonData,validateResourceDefinitions} from '../src/data/validate-season.mjs';
import {season,rulesAt} from '../src/rules.mjs';
import {sample} from '../src/sample.mjs';

const clock=new Date('2026-11-26T12:35:00Z');
const item=(slot,track='hero',extra={})=>({slot,itemId:123,ilvl:300,track,rank:1,...extra});
const snap=(equipment,weaponMode='one-hand')=>({equipment,weaponMode,region:'kr',realm:'azshara',name:'테스트',observedAt:clock.toISOString(),source:'sample'});
const stage=(fromRank,costs)=>({fromRank,costs});
const rule=(track,levels,steps,discountPolicy='none')=>({track,levels,steps,discountPolicy,evidence:'synthetic'});
const zero={gainUnits:0,costs:{},actions:[]};
const option=(gainUnits,costs)=>({gainUnits,costs,actions:[]});
const options=analyses=>analyses.map(row=>row.options);

test('선행 단계·비균일 비용·양손 및 최대 단계 검사',()=>{
  const rules=[rule('hero',[300,301,321],[stage(1,{heroCrest:2,gold:1}),stage(2,{venomstone:2,gold:3})])];
  const two=snap([item('MAIN_HAND')],'two-hand');
  const row=analyzeGear(two,rules)[0];
  assert.equal(row.maxIlvl,321); assert.equal(row.remainingRanks,2);
  assert.deepEqual(row.maxCosts,{heroCrest:2,gold:4,venomstone:2});
  assert.equal(row.options[2].gainUnits,42);
  assert.equal(row.options[2].actions[1].requires,row.options[2].actions[0].actionId);
  assert.equal(analyzeGear(snap([item('MAIN_HAND')],'dual-wield'),rules)[0].options[2].gainUnits,21);
  assert.equal(analyzeGear(snap([item('OFF_HAND')]),rules)[0].options[2].gainUnits,21);
  assert.equal(analyzeGear(snap([item('HEAD','hero',{maxRank:2})]),rules)[0].maxIlvl,301);
  assert.equal(analyzeGear(snap([item('HEAD','hero',{ilvl:302})]),rules)[0].maxIlvl,null);
  const under=optimizeGrowth(options([row]),{heroCrest:2,venomstone:2,gold:3},{current:300,target:302});
  assert.equal(under.status,'unreachable');
  const over=optimizeGrowth(options([row]),{heroCrest:0,venomstone:9,gold:9},{current:300,target:302});
  assert.equal(over.max.actions.length,0);
  const exact=optimizeGrowth(options([row]),{heroCrest:2,venomstone:2,gold:4},{current:300,target:302});
  assert.equal(exact.status,'reachable');
  assert.deepEqual(exact.max.remaining,{heroCrest:0,venomstone:0,gold:0});
  const unknown=optimizeGrowth(options([row]),{heroCrest:null,venomstone:9,gold:9},{current:300,target:302});
  assert.equal(unknown.status,'undetermined');assert.deepEqual(unknown.missing,['heroCrest']);
});

test('할인 미확인 보류, 관측 범위 구분, 장비 보존과 교체 근거',()=>{
  const rules=[rule('hero',[300,306],[stage(1,{heroCrest:20,gold:100})],'observed')];
  const data=snap([item('HEAD'),item('TRINKET_1','hero',{setId:99})]);
  const rows=analyzeGear(data,rules,{replacements:{HEAD:{ilvl:309,verified:true},TRINKET_1:{ilvl:322,verified:true}}});
  assert.equal(rows[0].next.discount,'unknown');
  assert.deepEqual(rows[0].next.baseCosts,{heroCrest:20,gold:100});
  assert.equal(rows[0].decision,'replace');assert.equal(rows[0].options.length,1);
  assert.equal(rows[1].decision,'preserve');assert.equal(rows[1].performance.comparisonRequired,true);
  for(const scope of ['character','warband']){
    const discounts={[rows[0].instanceKey]:{1:{scope,verified:true,observedAt:data.observedAt,costs:{heroCrest:0,gold:50}}}};
    const priced=analyzeGear(data,rules,{discounts})[0];
    assert.equal(priced.next.discount,scope);assert.equal(priced.options.length,2);
    assert.equal(analyzeGear(data,rules,{discounts,excludeSlots:['HEAD']})[0].options.length,1);
  }
  const stale={[rows[0].instanceKey]:{1:{scope:'character',verified:true,observedAt:'2026-11-24T00:00:00Z',costs:{heroCrest:0,gold:50}}}};
  assert.equal(analyzeGear(data,rules,{discounts:stale})[0].next.discount,'unknown');
});

test('목표 Pareto 후보, 독립 재화 보존과 우선순위',()=>{
  const groups=[[zero,option(16,{gold:7})],[zero,option(16,{heroCrest:3})]];
  const balances={gold:7,heroCrest:3};
  const first=optimizeGrowth(groups,balances,{current:300,target:301,priority:'gold'});
  assert.equal(first.max.average,302);assert.equal(first.targetPlanCount,2);
  assert.deepEqual(first.targetPlans[0].costs,{heroCrest:3});
  const reserved=optimizeGrowth(groups,balances,{current:300,target:301,reserve:{heroCrest:3}});
  assert.deepEqual(reserved.max.costs,{gold:7});
  assert.equal(reserved.max.remaining.heroCrest,3);
  assert.deepEqual(first,optimizeGrowth(groups,balances,{current:300,target:301,priority:'gold'}));
});

test('한 단계 탐욕 반례 및 작은 문제의 완전탐색 대조',t=>{
  const rules=[rule('hero',[300,301,321],[stage(1,{heroCrest:2}),stage(2,{heroCrest:2})]),rule('myth',[300,308],[stage(1,{heroCrest:4})])];
  const rows=analyzeGear(snap([item('HEAD'),item('CHEST','myth')]),rules);
  const dpStart=performance.now();
  const result=optimizeGrowth(options(rows),{heroCrest:4},{current:300,target:301});
  const dpMs=performance.now()-dpStart;
  const start=performance.now();
  let available=4, greedyGain=0, comparisons=0;
  const positions=[0,0];
  while(available>0){
    const next=rows.flatMap((row,index)=>{
      const action=row.options[positions[index]+1]?.actions.at(-1);
      comparisons++;
      return action && action.costs.heroCrest<=available?[{action,index}]:[];
    }).sort((a,b)=>b.action.gainUnits/b.action.costs.heroCrest-a.action.gainUnits/a.action.costs.heroCrest)[0];
    if(!next)break;
    positions[next.index]++;
    available-=next.action.costs.heroCrest;
    greedyGain+=next.action.gainUnits;
  }
  const greedyMs=performance.now()-start;
  assert.equal(result.max.average,301.3125);
  assert.equal(greedyGain,8);assert.ok(result.max.average>300+greedyGain/16);
  assert.ok(greedyMs>=0&&comparisons===2);
  t.diagnostic(`greedyMs=${greedyMs.toFixed(3)} greedyCandidates=${comparisons} optimizerMs=${dpMs.toFixed(3)} transitions=${result.transitions}`);
  for(let seed=0;seed<15;seed++){
    const groups=Array.from({length:4},(_,i)=>[zero,...Array.from({length:3},(_,j)=>option(1+(seed+i*7+j*4)%17,{gold:1+(seed+j+i)%6,heroCrest:1+(seed+2*j+i)%5}))]);
    const wallet={gold:9,heroCrest:7};
    let best=0;
    function brute(i,gain,gold,crest){
      if(gold>wallet.gold||crest>wallet.heroCrest)return;
      if(i===groups.length){best=Math.max(best,gain);return;}
      for(const row of groups[i])brute(i+1,gain+row.gainUnits,gold+(row.costs.gold??0),crest+(row.costs.heroCrest??0));
    }
    brute(0,0,0,0);
    const solved=optimizeGrowth(groups,wallet,{current:300});
    assert.equal(solved.limited,false);assert.equal(solved.max.average,300+best/16);
  }
});

test('탐색 한도와 고정 규모 성능 증적',t=>{
  const groups=Array.from({length:16},(_,i)=>[zero,...Array.from({length:19},(_,j)=>option(j+1,{['c'+(i%8)]:j+1,gold:(j+1)*(i+1)}))]);
  const wallet={gold:1000,...Object.fromEntries(Array.from({length:8},(_,i)=>['c'+i,40]))};
  const start=performance.now();
  const result=optimizeGrowth(groups,wallet,{current:300,target:500});
  const ms=performance.now()-start;
  t.diagnostic(`elapsedMs=${ms.toFixed(2)} transitions=${result.transitions} peakStates=${result.peakStates}`);
  assert.equal(result.limited,true);assert.equal(result.status,'undetermined');
  assert.ok(result.transitions<=24000 && result.peakStates<=256 && ms<5000);
  assert.ok(Object.entries(result.max.remaining).every(([,value])=>value>=0));
});

test('운영과 가상 분리, 목표와 315 경계, 최신 애드온 생성 fixture',()=>{
  const raw=readFileSync(new URL('../contracts/examples/resources-0.3.0.json',import.meta.url),'utf8');
  const imported=mergeSnapshots(null,parseAddon(raw,{now:clock}));
  assert.equal(imported.addonVersion,'0.3.0');assert.equal(Object.keys(imported.resources).length,9);
  const live=diagnose(imported,{now:clock,target:330});
  assert.equal(live.groupEligible,true);assert.equal(live.growth.status,'undetermined');assert.equal(live.growth.plan,null);
  assert.equal(diagnose(imported,{now:clock,target:300,solo:true}).groupEligible,false);
  assert.equal(diagnose(imported,{now:new Date('2026-12-04T00:00:00Z')}).growth.plan,null);
  const demo=sample();demo.resources.demoCrest.observedAt='2026-11-24T00:00:00Z';
  const old=diagnose(demo,{now:clock,demo:true});
  assert.equal(old.upgrades.length,0);assert.ok(old.growth.plan.missing.includes('demoCrest'));
});

test('재화 충돌 및 단계·할인 규칙 오류 격리',()=>{
  const currencies=[{key:'gold',kind:'money',id:null,spendingStatus:'verified'},{key:'heroCrest',kind:'currency',id:1,spendingStatus:'verified'}];
  assert.deepEqual(validateResourceDefinitions([...currencies,{key:'other',kind:'currency',id:1},{key:'bad',kind:'item',id:null}]).accepted,[currencies[0]]);
  const row={...rulesAt(clock).byId.get('venomstone-upgrade'),ruleId:'steps',key:'steps',category:'upgrade-table',
    conditions:{eligibility:'unrestricted',discountPolicy:'observed'},
    effect:{track:'hero',levels:[300,305,309],maxRank:3,steps:[stage(1,{heroCrest:10}),stage(2,{gold:40})]}};
  assert.equal(validateSeasonData(season,currencies,[row]).accepted.length,1);
  for(const change of [x=>x.effect.steps.pop(),x=>x.effect.steps[0].costs.heroCrest=-1,x=>x.effect.steps[0].fromRank=2,x=>x.effect.maxRank=2,x=>x.conditions.discountPolicy='always-free']){
    const copy=structuredClone(row);change(copy);assert.equal(validateSeasonData(season,currencies,[copy]).rejected.length,1);
  }
});

test('전이 한도를 정확히 소진한 경우와 실행 가능한 일부 경로를 구별',()=>{
  const skip={gainUnits:0,costs:{},actions:[]};
  const first={gainUnits:16,costs:{gold:2,crest:1},actions:['first']};
  const second={gainUnits:16,costs:{gold:2,crest:1},actions:['second']};
  const balances={gold:4,crest:2};
  const groups=[[skip,first],[skip,second]];
  const exact=optimizeGrowth(groups,balances,{current:313,target:315,maxTransitions:6});
  assert.equal(exact.limited,false);
  assert.equal(exact.status,'reachable');
  assert.deepEqual(exact.max.actions,['first','second']);
  const partial=optimizeGrowth(groups,balances,{current:313,target:315,maxTransitions:5});
  assert.equal(partial.limited,true);
  assert.equal(partial.status,'undetermined');
  assert.equal(partial.max.actions.length,1);
  assert.deepEqual(partial.max.remaining,{gold:2,crest:1});
});
