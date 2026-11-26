import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {splitCopper,buildWeeklyActivities} from '../src/activity-dashboard.mjs';
import {parseAddon,mergeSnapshots} from '../src/addon-import.mjs';
import {diagnose} from '../src/engine.mjs';

test('코퍼는 정확한 정수 단위로 나누고 실제 0과 미확인을 구분한다',()=>{
  assert.deepEqual(splitCopper(123456),{gold:12,silver:34,copper:56});
  assert.deepEqual(splitCopper(0),{gold:0,silver:0,copper:0});
  assert.deepEqual(splitCopper(10000),{gold:1,silver:0,copper:0});
  assert.deepEqual(splitCopper(Number.MAX_SAFE_INTEGER),{gold:900719925474,silver:9,copper:91});
  for(const invalid of [null,-1,0.5,Number.MAX_SAFE_INTEGER+1]) assert.equal(splitCopper(invalid),null);
});

const now=new Date('2026-11-26T12:35:00Z');
const raw=readFileSync(new URL('../contracts/examples/world-quests-004h-synthetic.json',import.meta.url),'utf8');

test('주간 관측 0을 보존하되 수집하지 않은 진행을 완료나 미완료로 추정하지 않는다',()=>{
  const input=JSON.parse(raw);
  input.progress={vaultWorld:0,source:'addon',observedAt:input.observedAt};
  const snapshot=mergeSnapshots(null,parseAddon(JSON.stringify(input),{now}));
  const result=diagnose(snapshot,{now,solo:true});
  const weekly=buildWeeklyActivities(snapshot,result);
  assert.equal(weekly.length,9);
  assert.deepEqual(weekly[0].evidence,[{label:'야외·구렁',value:0,source:'addon',observedAt:input.observedAt}]);
  assert.equal(weekly[0].status,'partial');
  assert.ok(weekly.slice(1).every(row=>row.status==='uncollected'));
  assert.equal(weekly.find(row=>row.id==='raid').recommendation,null);
  assert.equal(weekly.find(row=>row.id==='mythic').recommendation,null);
  assert.notEqual(result.worldQuests.totals.goldCopper,result.remaining.gold);
  assert.equal(result.growth.plan,null);
  assert.ok(result.gearAnalysis.every(row=>row.performance.status==='unmeasured'));
});

test('기존 CLI diagnose 엔트리에서 익명 사냥꾼 평균 회귀',context=>{
  const scratch=mkdtempSync(join(tmpdir(),'gearpath-task-006-'));
  context.after(()=>rmSync(scratch,{recursive:true,force:true}));
  const output=execFileSync(process.execPath,['src/cli.mjs','diagnose','contracts/examples/hunter-regression.json',join(scratch,'report.html')],{encoding:'utf8'});
  const report=JSON.parse(output);
  assert.equal(report.average,308.6875);
  assert.equal(report.groupEligible,false);
  assert.equal(report.upgradeSteps,0);
});
