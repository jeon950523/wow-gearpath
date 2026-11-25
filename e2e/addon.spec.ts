import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';

const data=readFileSync(new URL('../contracts/examples/hunter-regression.json',import.meta.url),'utf8');

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
