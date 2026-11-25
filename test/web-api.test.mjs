import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlizzardClient,normalize} from '../src/blizzard.mjs';

const ok = body => ({ok:true, json:async()=>body});

test('동시 서버 목록 요청에서 OAuth 발급을 공유하고 만료 후 갱신',async ()=>{
  let calls = 0;
  const client=createBlizzardClient({clientId:'fixture-client',clientSecret:'fixture-secret',fetchImpl:async (url,options)=>{
    assert.equal(options.redirect,'error');
    assert.ok(options.signal instanceof AbortSignal);
    if(url.endsWith('/token')) {
      calls++;
      return ok({access_token:'fixture-token',expires_in:30});
    }
    assert.match(url,/namespace=dynamic-kr&locale=ko_KR/);
    return ok({realms:[{slug:'fixture-realm',name:'가상 서버'}]});
  }});
  const values=await Promise.all([client.realms(),client.realms()]);
  assert.deepEqual(values[0],values[1]);
  assert.equal(calls,1);
  await client.realms();
  assert.equal(calls,2);
});

test('KR 캐릭터 장비와 안전한 아이템 미디어만 반환',async ()=>{
  const profile={id:1,name:'테스트',race:{name:'인간'},active_spec:{name:'무기'},character_class:{name:'전사'},level:90,last_login_timestamp:Date.now()};
  const items={character:{id:1},equipped_items:[
    {slot:{type:'MAIN_HAND'},item:{id:1},level:{value:315},inventory_type:{type:'TWOHWEAPON'},quality:{type:'EPIC'}},
    {slot:{type:'OFF_HAND'},item:{id:2},level:{value:313},inventory_type:{type:'TWOHWEAPON'}},
  ]};
  const client=createBlizzardClient({clientId:'fixture-client',clientSecret:'fixture-secret',fetchImpl:async url=>{
    if(url.endsWith('/token')) return ok({access_token:'fixture-token',expires_in:3600});
    if(url.includes('/equipment?')) return ok(items);
    if(url.includes('/media/item/1?')) return ok({assets:[{key:'icon',value:'https://render.worldofwarcraft.com/kr/icons/example.jpg'}]});
    if(url.includes('/media/item/2?')) return ok({assets:[{key:'icon',value:'https://example.test/icon.jpg'}]});
    return ok(profile);
  }});
  const result=await client.character('fixture-realm','테스트',{media:true});
  assert.equal(result.weaponMode,'dual-wield');
  assert.equal(result.profile.specialization,'무기');
  assert.equal(result.equipment[0].quality,'EPIC');
  assert.match(result.equipment[0].icon,/render.worldofwarcraft.com/);
  assert.equal(result.equipment[1].icon,null);
  assert.doesNotMatch(JSON.stringify(result),/fixture-(token|secret)/);
  assert.throws(()=>normalize(profile,{...items,equipped_items:[{}]},{realm:'fixture-realm',name:'테스트',observedAt:new Date().toISOString()}),/필드/);
});
