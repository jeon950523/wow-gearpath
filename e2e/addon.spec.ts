import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';

const data=readFileSync(new URL('../contracts/examples/hunter-regression.json',import.meta.url),'utf8');
const details=readFileSync(new URL('../contracts/examples/details-0.2.1.json',import.meta.url),'utf8');
const resourceFixture=readFileSync(new URL('../contracts/examples/resources-0.3.0.json',import.meta.url),'utf8');

test('가상 성장 계획만 경로를 표시하고 골드 보존·슬롯 제외 반영',async ({page})=>{
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'azshara',name:'아즈샤라'}]}}));
  await page.goto('/');
  await expect(page.getByRole('option',{name:'아즈샤라'})).toBeAttached();
  await page.getByRole('button',{name:'샘플 보기'}).click();
  const growth=page.getByRole('region',{name:'장비 성장 계획'});
  await expect(growth.getByText('가상 강화 예제')).toBeVisible();
  await growth.getByLabel('머리 강화에서 제외').check();
  await expect(growth.getByText('사용자가 이 슬롯을 보존하도록 선택했습니다.')).toBeVisible();
  await growth.getByLabel('남겨둘 수량').fill('1000');
  await expect(growth.getByText(/예상 소비 소비 없음/)).toBeVisible();
});

test('ADDON-003A v0.3.0 생성 예제의 재화 출처와 상태 표시',async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-26T12:35:00Z'));
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'azshara',name:'아즈샤라'}]}}));
  await page.goto('/');
  await expect(page.getByRole('option',{name:'아즈샤라'})).toBeAttached();
  await page.getByRole('textbox',{name:'애드온 JSON'}).fill(resourceFixture);
  await page.getByRole('button',{name:'JSON 가져오기'}).click();
  const table=page.getByRole('table',{name:'보유 재화'});
  const keys=table.getByRole('row').filter({hasText:'복원된 금고 열쇠'});
  await expect(keys.getByRole('cell',{name:'0',exact:true})).toBeVisible();
  await expect(keys.getByText(/애드온 · 관측/)).toBeVisible();
  await expect(table.getByRole('row').filter({hasText:'노련가 안개문장'}).getByText(/수집 실패/)).toBeVisible();
  await expect(table.getByRole('row').filter({hasText:'모험가 안개문장'}).getByText(/미수집/)).toBeVisible();
  await expect(table.getByRole('row').filter({hasText:'공허불빛 이회토'}).getByText(/ID 실측 대기/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'레이드 보상 후보 비교'})).toBeVisible();
  const growth=page.getByRole('region',{name:'장비 성장 계획'});
  await growth.getByLabel('목표 평균 아이템 레벨').fill('330');
  await expect(growth.getByText(/목표 330.*도달 가능 여부 미확인/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'레이드 보상 후보 비교'})).toBeVisible();
});

test('실제 생성 v0.2.1 예제의 전문화와 강화 세부 표시',async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-26T12:35:00Z'));
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'azshara',name:'아즈샤라'}]}}));
  await page.goto('/');
  await expect(page.getByRole('option',{name:'아즈샤라'})).toBeAttached();
  await page.getByRole('textbox',{name:'애드온 JSON'}).fill(details);
  await page.getByRole('button',{name:'JSON 가져오기'}).click();
  await expect(page.getByText(/사냥꾼 · 야수 · 90 레벨 · 공격/)).toBeVisible();
  await expect(page.getByText('영웅 3/6',{exact:true})).toBeVisible();
  await expect(page.getByText('미인식 트랙',{exact:true})).toBeVisible();
  await page.getByText('장비 세부 정보',{exact:true}).click();
  await expect(page.getByText('세트 ID 1234')).toBeVisible();
});

test('JSON 붙여넣기와 파일, 실패 시 유지, 삭제 및 스냅샷 미전송',async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-26T12:35:00Z'));
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'azshara',name:'아즈샤라'}]}}));
  const outgoing:string[]=[];
  page.on('request',request=>{if(request.postData()) outgoing.push(request.postData()!);});
  await page.goto('/');
  await page.getByRole('textbox',{name:'애드온 JSON'}).fill(data);
  await page.getByRole('button',{name:'JSON 가져오기'}).click();
  await expect(page.getByText('308.688',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'애드온 JSON'}).fill('{');
  await page.getByRole('button',{name:'JSON 가져오기'}).click();
  await expect(page.getByText(/JSON 형식이 손상/)).toBeVisible();
  await expect(page.getByText('308.688',{exact:true})).toBeVisible();
  await page.getByLabel('JSON 파일').setInputFiles({name:'hunter.json',mimeType:'application/json',buffer:Buffer.from(data)});
  await expect(page.getByText('애드온 데이터를 가져왔습니다.')).toBeVisible();
  expect(outgoing).toEqual([]);
  await page.getByRole('button',{name:'가져온 데이터 삭제'}).click();
  await expect(page.getByText('308.688',{exact:true})).toHaveCount(0);
  await page.getByRole('textbox',{name:'애드온 JSON'}).fill(data);
  await page.getByRole('button',{name:'JSON 가져오기'}).click();
  const fixture=JSON.parse(data);
  await page.route('**/api/character?*',route=>route.fulfill({json:{...fixture,source:'blizzard',resources:{}}}));
  await page.getByRole('combobox',{name:'서버',exact:true}).selectOption('azshara');
  await page.getByRole('textbox',{name:'캐릭터명'}).fill(fixture.name);
  await page.getByRole('button',{name:'검색 및 진단'}).click();
  await expect(page.getByText('최근 검색',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'가져온 데이터 삭제'})).toBeVisible();
});

test('v0.3.2 성운의 공허핵 0과 과거 3513 재수집 경고 표시',async ({page})=>{
  const snapshot=JSON.parse(readFileSync(new URL('../contracts/examples/resources-0.3.2.json',import.meta.url),'utf8'));
  await page.clock.setFixedTime(new Date('2026-11-26T12:35:00Z'));
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'azshara',name:'아즈샤라'}]}}));
  await page.goto('/');
  await expect(page.getByRole('option',{name:'아즈샤라'})).toBeAttached();
  const textbox=page.getByRole('textbox',{name:'애드온 JSON'});
  const importButton=page.getByRole('button',{name:'JSON 가져오기'});
  const table=page.getByRole('table',{name:'보유 재화'});
  const voidcore=table.getByRole('row').filter({hasText:'성운의 공허핵'});
  await textbox.fill(JSON.stringify(snapshot));
  await importButton.click();
  await expect(voidcore.getByRole('cell',{name:'0',exact:true})).toBeVisible();
  await expect(voidcore.getByText(/애드온 · 관측/)).toBeVisible();
  await expect(voidcore.getByText(/한국 12.1.5 실측/)).toBeVisible();
  snapshot.addonVersion='0.3.1';
  Object.assign(snapshot.resources.nebulousVoidcore,{currencyId:3513,value:987});
  await textbox.fill(JSON.stringify(snapshot));
  await importButton.click();
  await expect(voidcore.getByText(/미수집/)).toBeVisible();
  await expect(page.getByText(/성운의 공허핵 잔액을 확인할 수 없습니다/)).toBeVisible();
  await expect(table.getByRole('row').filter({hasText:'지하의 주화'}).getByRole('cell',{name:'42',exact:true})).toBeVisible();
});
