// Provisional adapter: live KR contract verification is pending credentials.
export function createBlizzardClient({clientId, clientSecret, fetchImpl=fetch}={}) {
  let token, expiresAt=0;
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
    const data=await request('https://oauth.battle.net/token',{
      method:'POST', headers:{Authorization:'Basic '+Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',
    });
    if (typeof data.access_token!=='string' || !Number.isFinite(data.expires_in) || data.expires_in<=0) throw new Error('OAuth 응답 형식 오류.');
    token=data.access_token; expiresAt=Date.now()+Math.max(0,data.expires_in-60)*1000;
    return token;
  }
  return {
    async character(realm,name) {
      if (typeof realm!=='string' || !realm.trim() || typeof name!=='string' || !name.trim()) throw new Error('서버 slug와 캐릭터명이 필요합니다.');
      const auth=await accessToken();
      const base=`https://kr.api.blizzard.com/profile/wow/character/${encodeURIComponent(realm.trim().toLowerCase())}/${encodeURIComponent(name.trim().toLowerCase())}`;
      const query='?namespace=profile-kr&locale=ko_KR';
      const headers={Authorization:`Bearer ${auth}`};
      const [profile,equipment]=await Promise.all([request(base+query,{headers}),request(base+'/equipment'+query,{headers})]);
      return normalize(profile,equipment,{realm,name,observedAt:new Date().toISOString()});
    },
  };
}

export function normalize(profile,equipment,{realm,name,observedAt}) {
  if (!Array.isArray(equipment?.equipped_items) || !Number.isInteger(profile?.id) || equipment.character?.id !== profile.id) throw new Error('캐릭터 장비 응답이 불완전하거나 식별자가 다릅니다.');
  // Fetch time is not last-login time. Use last_login_timestamp for conservatism.
  if (!Number.isFinite(profile.last_login_timestamp)) throw new Error('최근 로그인 시각이 없어 장비 신선도를 검증할 수 없습니다.');
  const equipmentAt = new Date(Math.min(Date.parse(observedAt),profile.last_login_timestamp)).toISOString();
  const items=equipment.equipped_items.filter(x=>!['SHIRT','TABARD'].includes(x.slot?.type)).map(x=>({
    slot:x.slot?.type,itemId:x.item?.id,name:x.name ?? '',ilvl:x.level?.value,
    track:null,rank:null,inventoryType:x.inventory_type?.type ?? null,
  }));
  const twoHand=items.find(x=>x.slot==='MAIN_HAND')?.inventoryType==='TWOHWEAPON';
  return {schemaVersion:1,region:'kr',realm,name:profile.name ?? name,seasonId:'midnight-s2',source:'blizzard',
    fetchedAt:observedAt,observedAt:equipmentAt,weaponMode:twoHand?'two-hand':items.some(x=>x.slot==='OFF_HAND')?'one-hand':'unknown',
    reportedEquippedAverage:profile.equipped_item_level ?? null,equipment:items,resources:{},progress:null};
}
