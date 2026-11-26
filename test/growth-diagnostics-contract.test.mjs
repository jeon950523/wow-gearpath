import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseGrowthDiagnostic,validateGrowthDiagnosticsStorage} from '../src/growth-diagnostics-contract.mjs';

const fixture=name=>JSON.parse(readFileSync(new URL('../contracts/examples/'+name+'-v1-synthetic.json',import.meta.url)));
const merchant=()=>fixture('merchant-diagnostics');
const craft=()=>fixture('craft-diagnostics');
const storage=()=>fixture('growth-diagnostics-storage');
const options={now:1795752000000};
const parse=(kind,data)=>parseGrowthDiagnostic(kind,JSON.stringify(data),options);

test('상인 원시 0과 부분 교환값, 상품 인덱스를 각각 보존한다',()=>{
  const data=merchant();
  assert.deepEqual(parse('merchant',data),data);
  assert.equal(data.rows[0].priceCopper,0);
  assert.equal(data.rows[1].priceCopper,null);
  assert.equal(data.rows[0].itemID,data.rows[1].itemID);
});
test('제작 미리보기와 미확인 실제 비용 및 소비가 독립적이다',()=>{
  const data=craft();
  assert.deepEqual(parse('craft',data),data);
  assert.equal(data.draft.tipCopper,0);
  assert.equal(data.draft.postingFeeCopper,null);
  assert.equal(data.inventory.balances[0].owned,0);
  assert.equal(data.actualShortfall,'unverified');
  const schematic={
    ...data,source:'recipeSchematic',schematic:{recipeType:null,schematicItemID:null,schematicProductQuality:null,
      rawRecipeItemLevel:null,supportsQualities:null,slots:[]},
  };
  for(const key of ['allocations','draft','preview','inventory','catalog']) delete schematic[key];
  assert.deepEqual(parse('craft',schematic),schematic);
});
test('캐릭터 및 종류를 분리하고 같은 초의 다른 JSON과 과거 시각을 보존한다',()=>{
  const data=storage();
  data.characters[0].merchant.push(JSON.stringify({...merchant(),mapID:999}));
  assert.deepEqual(validateGrowthDiagnosticsStorage(data,options),data);
  assert.notEqual(JSON.parse(data.characters[1].craft[0]).observedAt,JSON.parse(data.characters[0].craft[0]).observedAt);
});
for(const [kind,label,mutate] of [
  ['merchant','부분 교환비를 확정',x=>x.rows[0].costState='observed'],
  ['merchant','가격 누락을 무료로 처리',x=>x.actualCost='free'],
  ['merchant','상품 번호 중복',x=>x.rows[1].index=1],
  ['merchant','원시 링크',x=>x.rows[0].itemLink='synthetic-private'],
  ['merchant','미리보기 레벨을 실제로 처리',x=>x.rows[1].previewLevel=true],
  ['merchant','미래 시각',x=>x.observedAt++],
  ['craft','자격 확정',x=>x.eligibility=true],
  ['craft','재료 효과 확정',x=>x.effectValidation='verified'],
  ['craft','예측을 실제 결과로 처리',x=>x.result='guaranteed'],
  ['craft','합산 부족량 추가',x=>x.inventory.totalShortfall=2],
  ['craft','보유량 미관측을 0으로 처리',x=>x.inventory.balances[0].state='unknown'],
  ['craft','잘못된 비용 단위',x=>x.draft.tipCopper=-1],
  ['craft','제작과 주문 혼동',x=>x.source='personalCraft'],
  ['craft','후보 재료 참조 범위 밖',x=>x.catalog.hints[0].catalogRef='allocation:2'],
  ['craft','같은 재료에 이중 ID',x=>x.allocations[0].currencyID=9001],
  ['craft','원시 주문 번호',x=>x.draft.orderID=100],
]) test(kind+' 거부 · '+label,()=>{
  const input=(kind==='merchant'?merchant:craft)();
  mutate(input);
  assert.throws(()=>parse(kind,input),/관측 계약 오류/);
});

for(const [label,mutate] of [
  ['미지원 저장 버전',x=>x.storageVersion=2],
  ['기존 운영 저장 필드',x=>x.lastExport='{}'],
  ['빈 캐릭터 행',x=>{x.characters[1].craft=[];}],
  ['동일 원문 중복',x=>x.characters[0].merchant.push(x.characters[0].merchant[0])],
  ['캐릭터 대소문자 충돌',x=>{x.characters[0].name='Sample';x.characters[1].name='sample';}],
  ['종류 교차',x=>x.characters[0].merchant.push(JSON.stringify(craft()))],
  ['시간 역전',x=>x.characters[0].merchant.push(JSON.stringify({...merchant(),observedAt:1795751999}))],
  ['종류별 상한',x=>x.characters[0].merchant=Array(9).fill('{}')],
  ['UTF-8 신원 바이트 상한',x=>x.characters[0].name='가'.repeat(43)],
]) test('저장 거부 · '+label,()=>{
  const input=storage();mutate(input);
  assert.throws(()=>validateGrowthDiagnosticsStorage(input,options),/관측 계약 오류/);
});

test('UTF-8 관측 및 컨테이너 상한은 문자 수와 별도로 적용한다',()=>{
  const raw=JSON.stringify(craft());
  const atLimit=raw+' '.repeat(262144-Buffer.byteLength(raw));
  assert.deepEqual(parseGrowthDiagnostic('craft',atLimit,options),craft());
  assert.throws(()=>parseGrowthDiagnostic('craft',atLimit+' ',options),/크기/);
  const data=storage();
  data.characters[0].craft=Array.from({length:8},(_,i)=>{
    const row=JSON.stringify({...craft(),recipeID:i+1});
    return row+' '.repeat(262144-Buffer.byteLength(row));
  });
  assert.throws(()=>validateGrowthDiagnosticsStorage(data,options),/저장 용량/);
});

test('신규 저장 루트는 기존 브라우저 가져오기에서 계속 미지원이다',async()=>{
  const {readSavedVariables}=await import('../src/saved-variables.mjs');
  const raw=readFileSync(new URL('../contracts/examples/growth-diagnostics-storage-v1-synthetic.lua',import.meta.url),'utf8');
  assert.throws(()=>readSavedVariables(raw,options),/SavedVariables Lua 데이터 형식/);
});
