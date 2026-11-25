// Provisional adapter: the KR wire format is checked independently of connection setup.
/** @param {{clientId?: string, clientSecret?: string, fetchImpl?: typeof fetch}} [options] */
export function createBlizzardClient({clientId, clientSecret, fetchImpl=fetch}={}) {
  let token, expiresAt=0;
  let tokenRequest;
  async function request(url, options={}) {
    let response;
    try { response=await fetchImpl(url,{...options, redirect:'error', signal:AbortSignal.timeout(12000)}); }
    catch { throw new Error('Blizzard 연결 실패 또는 시간 초과.'); }
    if (!response.ok) {
      const message = {401:'인증 실패',403:'접근 불가 또는 비공개',404:'캐릭터를 찾을 수 없음',429:'호출 한도 초과. 잠시 후 재시도'}[response.status] ?? '외부 서비스 오류';
      // Do not echo response bodies, request headers, or credentials.
      throw new Error(`Blizzard ${response.status}: ${message}`);
    }
    try { return await response.json(); } catch { throw new Error('Blizzard 응답 형식 오류.'); }
  }
  async function accessToken() {
    if (!clientId || !clientSecret) throw new Error('BLIZZARD_CLIENT_ID와 BLIZZARD_CLIENT_SECRET 환경 변수가 필요합니다.');
    if (token && Date.now()<expiresAt) return token;
    if (tokenRequest) return tokenRequest;
    tokenRequest = request('https://oauth.battle.net/token',{
      method:'POST', headers:{Authorization:'Basic '+Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',
    }).then(data => {
      if (typeof data.access_token!=='string' || !Number.isFinite(data.expires_in) || data.expires_in<=0) throw new Error('OAuth 응답 형식 오류.');
      token=data.access_token;
      expiresAt=Date.now()+Math.max(0,data.expires_in-60)*1000;
      return token;
    }).finally(() => { tokenRequest=undefined; });
    return tokenRequest;
  }
  async function get(path, namespace) {
    const auth=await accessToken();
    return request(`https://kr.api.blizzard.com${path}?namespace=${namespace}&locale=ko_KR`,{headers:{Authorization:`Bearer ${auth}`}});
  }
  const iconCache=new Map();
  function icon(id) {
    if (!Number.isSafeInteger(id) || id < 1) return Promise.resolve(null);
    const stored=iconCache.get(id);
    if (stored && stored.expires>Date.now()) return stored.promise;
    if (iconCache.size >= 512) iconCache.delete(iconCache.keys().next().value);
    const promise=get(`/data/wow/media/item/${id}`,'static-kr').then(data => {
      const value=Array.isArray(data?.assets) ? data.assets.find(x=>x.key==='icon')?.value : null;
      return typeof value==='string' && /^https:\/\/render\.worldofwarcraft\.com\//.test(value) ? value : null;
    }).catch(() => { iconCache.delete(id); return null; });
    iconCache.set(id,{promise,expires:Date.now()+86400000});
    return promise;
  }
  return {
    /** @returns {Promise<Array<{slug:string,name:string}>>} */
    async realms() {
      const data=await get('/data/wow/realm/index','dynamic-kr');
      if (!Array.isArray(data?.realms)) throw new Error('Blizzard 서버 목록 형식 오류.');
      const rows=data.realms.filter(x=>typeof x?.slug==='string' && typeof x?.name==='string');
      if (!rows.length) throw new Error('Blizzard 서버 목록이 비어 있습니다.');
      return rows.map(({slug,name})=>({slug,name})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    },
    async character(realm,name,{media=false}={}) {
      if (typeof realm!=='string' || !realm.trim() || typeof name!=='string' || !name.trim()) throw new Error('서버 slug와 캐릭터명이 필요합니다.');
      const auth=await accessToken();
      const base=`https://kr.api.blizzard.com/profile/wow/character/${encodeURIComponent(realm.trim().toLowerCase())}/${encodeURIComponent(name.trim().toLowerCase())}`;
      const query='?namespace=profile-kr&locale=ko_KR';
      const headers={Authorization:`Bearer ${auth}`};
      const [profile,equipment]=await Promise.all([request(base+query,{headers}),request(base+'/equipment'+query,{headers})]);
      const result=normalize(profile,equipment,{realm,name,observedAt:new Date().toISOString()});
      if (media) await Promise.all(result.equipment.map(async item => { item.icon = await icon(item.itemId); }));
      return result;
    },
  };
}

export function normalize(profile,equipment,{realm,name,observedAt}) {
  if (!Array.isArray(equipment?.equipped_items) || !Number.isInteger(profile?.id) || equipment.character?.id !== profile.id) throw new Error('캐릭터 장비 응답이 불완전하거나 식별자가 다릅니다.');
  // Fetch time is not last-login time. Use last_login_timestamp for conservatism.
  const login = profile.last_login_timestamp;
  const equipmentAt = Number.isFinite(login) && login>0 && login<=Date.parse(observedAt)
    ? new Date(login).toISOString() : '1970-01-01T00:00:00.000Z';
  const items=equipment.equipped_items.filter(x=>!['SHIRT','TABARD'].includes(x.slot?.type)).map(x=>({
    slot:x.slot?.type,itemId:x.item?.id,name:x.name ?? '',ilvl:x.level?.value,
    track:null,rank:null,inventoryType:x.inventory_type?.type ?? null,
    quality:typeof x.quality?.type==='string' ? x.quality.type : null,icon:null,
  }));
  const twoHand=items.find(x=>x.slot==='MAIN_HAND')?.inventoryType==='TWOHWEAPON';
  if (items.some(x=>!Number.isSafeInteger(x.itemId) || x.itemId<1 || !Number.isFinite(x.ilvl) || typeof x.slot!=='string')) throw new Error('Blizzard 장비 필드 형식 오류.');
  const offHand=items.find(x=>x.slot==='OFF_HAND');
  return {schemaVersion:1,region:'kr',realm,name:typeof profile.name==='string'?profile.name:name,seasonId:'midnight-s2',source:'blizzard',
    profile:{race:profile.race?.name ?? null, className:profile.character_class?.name ?? null,
      specialization:profile.active_spec?.name ?? null, level:Number.isInteger(profile.level)?profile.level:null},
    fetchedAt:observedAt,observedAt:equipmentAt,weaponMode:offHand?(twoHand || ['WEAPON','WEAPONOFFHAND','TWOHWEAPON'].includes(offHand.inventoryType)?'dual-wield':'one-hand'):twoHand?'two-hand':'unknown',
    reportedEquippedAverage:profile.equipped_item_level ?? null,equipment:items,resources:{},progress:null};
}
