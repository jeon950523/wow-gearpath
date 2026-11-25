import {expect,test} from '@playwright/test';
import {sample} from '../src/sample.mjs';

test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-26T10:00:00+09:00'));
  await page.route('**/api/realms',route=>route.fulfill({json:{realms:[{slug:'test-realm',name:'테스트 서버'}]}}));
});

test('서버 검색과 장비 화면, 315 경계, 재화 수동 입력 및 최근 검색',async ({page})=>{
  await page.route('**/api/character?*',route=>{
    const query = new URL(route.request().url()).searchParams;
    const fixture = sample(), now = '2026-11-26T10:00:00+09:00';
    const ilvl = query.get('name') === '경계미만' ? 314.99 : 315;
    return route.fulfill({json:{...fixture,realm:'test-realm',name:query.get('name'),observedAt:now,fetchedAt:now,
      profile:{race:'인간',className:'전사',specialization:'무기',level:90},
      equipment:fixture.equipment.map(item=>({...item,ilvl,track:null,rank:null})),resources:{},progress:null}});
  });
  await page.goto('/');
  await page.getByRole('combobox',{name:'서버',exact:true}).selectOption('test-realm');
  const name = page.getByLabel('캐릭터명');
  await name.fill('경계미만');
  await page.getByRole('button',{name:'검색 및 진단'}).click();
  await expect(page.getByText('314.990',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'레이드 보상 후보 비교'})).toHaveCount(0);
  await name.fill('경계도달');
  await page.getByRole('button',{name:'검색 및 진단'}).click();
  await expect(page.getByText('315.000',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'레이드 보상 후보 비교'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'풍요로운 구렁 열쇠 수량 입력'})).toBeVisible();
  await page.getByLabel('복원된 금고 열쇠').fill('0');
  await page.getByRole('button',{name:'진단에 반영'}).click();
  await expect(page.getByRole('heading',{name:'열쇠 획득 경로 확인'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'경계도달 · 테스트 서버'})).toBeVisible();
});

test('404 안내와 샘플 탐색',async ({page})=>{
  await page.route('**/api/character?*',route=>route.fulfill({status:404,json:{error:'캐릭터를 찾을 수 없습니다.'}}));
  await page.goto('/');
  await page.getByRole('combobox',{name:'서버',exact:true}).selectOption('test-realm');
  await page.getByLabel('캐릭터명').fill('없는캐릭터');
  await page.getByRole('button',{name:'검색 및 진단'}).click();
  await expect(page.getByRole('alert').filter({hasText:'캐릭터를 찾을 수 없습니다.'})).toBeVisible();
  await page.getByRole('button',{name:'샘플 보기'}).click();
  await expect(page.getByRole('heading',{name:'샘플모험가'})).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});

test('실제 로컬 서버 경로가 잘못된 입력을 먼저 거부',async ({request})=>{
  const response = await request.get('/api/character?realm=kr&name=12345');
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({error:'한국 리테일 서버와 캐릭터명을 확인하세요.'});
});
