'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {mergeWorldQuestScan} from '../src/world-quests.mjs';
import {WorldQuestPanel} from './world-quest-panel';
import {diagnose} from '../src/engine.mjs';
import {sample} from '../src/sample.mjs';
import {season,resourceDefinitions as runtimeResources} from '../src/rules.mjs';
import {parseAddon,mergeSnapshots,maxImportBytes,type AddonEquipmentDetails} from '../src/addon-import.mjs';

type Snapshot = Parameters<typeof diagnose>[0];
type Realm = {slug: string; name: string};
type Search = {realm: string; name: string};
type Gear = AddonEquipmentDetails & {slot:string; name?:string; itemId:number; ilvl:number; icon?:string|null; quality?:string|null; track?:string|null; rank?:number|null};
type GrowthAction = {actionId:string;slot:string;from:number;to:number;averageGain:number;costs:Record<string,number>;discount:string};
type GrowthSlot = {slot:string;ilvl:number;maxIlvl:number|null;rank:number|null;maxRank:number|null;source:string;observedAt:string;next:GrowthAction|null;maxCosts:Record<string,number>|null;decision:string;reason:string};
const resourceDefinitions: Array<{key:string;label:string;use:string;collection:string;identityStatus?:string}>=runtimeResources;

const slots: Record<string,string> = {
  HEAD:'머리',NECK:'목',SHOULDER:'어깨',BACK:'등',CHEST:'가슴',WRIST:'손목',HANDS:'손',WAIST:'허리',
  LEGS:'다리',FEET:'발',FINGER_1:'반지 1',FINGER_2:'반지 2',TRINKET_1:'장신구 1',TRINKET_2:'장신구 2',MAIN_HAND:'주 무기',OFF_HAND:'보조 무기',
};
const qualities: Record<string,string> = {POOR:'하급',COMMON:'일반',UNCOMMON:'고급',RARE:'희귀',EPIC:'영웅',LEGENDARY:'전설',ARTIFACT:'유물'};
const tracks: Record<string,string> = {explorer:'탐험가',adventurer:'모험가',veteran:'노련가',champion:'챔피언',hero:'영웅',myth:'신화'};
const roles: Record<string,string> = {TANK:'방어',HEALER:'치유',DAMAGER:'공격'};
const balanceStates: Record<string,string> = {observed:'관측',failed:'수집 실패',locked:'미해금',incomplete:'불완전',uncollected:'미수집'};
const scopeNames: Record<string,string> = {character:'캐릭터',warband:'전투부대',unknown:'범위 미확인'};
const decisions:Record<string,string>={upgrade:'강화 비교',replace:'교체 비교',preserve:'보존',hold:'판단 보류'};
const goalStatuses:Record<string,string>={'already-met':'현재 장비로 달성',reachable:'확인된 강화로 도달',unreachable:'확인된 강화와 예산으로 부족',undetermined:'도달 가능 여부 미확인'};
const costLabel=(key:string)=>resourceDefinitions.find(x=>x.key===key)?.label??(key==='demoCrest'?'가상 문장':key);
const costText=(costs?:Record<string,number|null>|null)=>costs ? Object.entries(costs).map(([key,value])=>`${costLabel(key)} ${value??'미확인'}`).join(' · ') || '소비 없음':'미확인';
const progressFields = [['maxDelveTier','최고 해금 구렁 단계',11],['stableTier','안정적으로 완료할 구렁 단계',11],
  ['vaultWorld','야외/구렁 금고 진행 횟수',99],['vaultDungeon','던전 금고 진행 횟수',99],['vaultRaid','레이드 금고 진행 횟수',99]] as const;

function presentTime(value?:string) {
  return value ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(value)) : '—';
}

export default function Planner() {
  const [realmList, setRealms] = useState<Realm[]>([]);
  const [realmError, setRealmError] = useState('');
  const [realmAttempt, retryRealms] = useState(0);
  const [realm, setRealm] = useState('');
  const [name, setName] = useState('');
  const [recent, setRecent] = useState<Search[]>([]);
  const [base, setSnapshot] = useState<Snapshot|null>(null);
  const [addon, setAddon] = useState<Snapshot|null>(null);
  const [overlay, setOverlay] = useState<Snapshot|null>(null);
  const [rawAddon, setRawAddon] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [prefer, setPrefer] = useState<'auto'|'base'|'addon'>('auto');
  const [solo, setSolo] = useState(false);
  const [growthTarget,setGrowthTarget]=useState('315');
  const [reserveKey,setReserveKey]=useState('gold');
  const [reserveValue,setReserveValue]=useState('');
  const [excludeSlots,setExcludeSlots]=useState<string[]>([]);
  const importRevision = useRef(0);
  const combined = addon ? mergeSnapshots(base,addon,{prefer}) : base;
  const snapshot = combined && overlay ? {...combined,
    resources:{...combined.resources,...Object.fromEntries(Object.entries(overlay.resources).filter(([,row])=>(row as {value:number|null}).value!==null))},
    progress:overlay.progress ? {...combined.progress,...Object.fromEntries(Object.entries(overlay.progress).filter(([,value])=>value!==null))}:combined.progress,
    fieldSources:{...combined.fieldSources,progress:{...combined.fieldSources?.progress,...Object.fromEntries(Object.entries(overlay.progress??{}).filter(([key,value])=>key!=='source'&&key!=='observedAt'&&value!==null).map(([key])=>[key,{source:'manual',observedAt:overlay.progress.observedAt}]))}},
    keystone:overlay.keystone??combined.keystone} : combined;
  const equipmentConflict = base && addon && base.source!=='sample' && (
    base.weaponMode!==addon.weaponMode || base.equipment.length!==addon.equipment.length ||
    addon.equipment.some((item:Gear)=>!base.equipment.some((other:Gear)=>item.slot===other.slot&&item.itemId===other.itemId&&item.ilvl===other.ilvl)));
  const [isSample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState<Record<string,string>>({});
  const [saved, setSaved] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [, refreshWorldQuests] = useState(0);
  const [notes, setNotes] = useState<Record<string,string>>({});

  useEffect(() => {
    try {
      const items: unknown = JSON.parse(localStorage.getItem('gearpath-recent') ?? '[]');
      if (Array.isArray(items)) setRecent(items.filter(x => typeof x?.realm === 'string' && typeof x?.name === 'string').slice(0,5));
    } catch {}
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/realms',{signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '서버 목록을 불러오지 못했습니다.');
      setRealms(data.realms);
      setRealmError('');
    }).catch(error => { if (!controller.signal.aborted) setRealmError(error.message); });
    return () => controller.abort();
  }, [realmAttempt]);

  function load(next: Snapshot, demo: boolean) {
    importRevision.current++;
    const equal = (left:string,right:string) => left.normalize('NFC').toLowerCase()===right.normalize('NFC').toLowerCase();
    const keepAddon = !demo && addon && next.region===addon.region && next.seasonId===addon.seasonId &&
      equal(next.realm,addon.realm) && equal(next.name,addon.name);
    setSnapshot(next);
    setSample(demo);
    setError('');
    if(keepAddon) return;
    setAddon(null);
    setOverlay(null);
    setPrefer('auto');
    setImportStatus('');
    setManual({});
    setNotes({});
    setSaved('');
    setSavedAt('');
    setError('');
  }

  function importAddon(raw:string) {
    importRevision.current++;
    try {
      const next = parseAddon(raw,{against:base?.source==='sample'?null:base??addon,realms:realmList});
      setAddon(mergeWorldQuestScan(addon,next));
      if(base?.source==='sample'){setOverlay(null);setManual({});setNotes({});setSaved('');setSavedAt('');}
      setSample(false);
      setPrefer('auto');
      setRawAddon('');
      setImportStatus('애드온 데이터를 가져왔습니다.');
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : '애드온 데이터를 읽을 수 없습니다.');
    }
  }

  async function search(query: Search) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/character?' + new URLSearchParams(query), {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '캐릭터를 불러오지 못했습니다.');
      load(data, false);
      const next = [query,...recent.filter(x=>x.realm!==query.realm || x.name!==query.name)].slice(0,5);
      setRecent(next);
      try { localStorage.setItem('gearpath-recent',JSON.stringify(next)); } catch {}
    } catch (error) {
      setError(error instanceof Error ? error.message : '조회에 실패했습니다.');
    } finally { setBusy(false); }
  }

  function applyResources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    const observedAt = isSample ? '2026-11-26T10:00:00+09:00' : new Date().toISOString();
    const value = (id:string) => manual[id] === undefined || manual[id] === '' ? null : Number(manual[id]);
    const resources = Object.fromEntries(resourceDefinitions.map(({key})=>[key,{value:value(key), source:'manual', observedAt}]));
    const dungeon = manual.dungeon?.trim();
    const keyLevel = value('keyLevel');
    if ((!dungeon) !== (keyLevel === null)) {
      setSaved('보유 쐐기돌은 던전명과 단계를 함께 입력하세요.');
      return;
    }
    const next = {...snapshot,resources,progress:{maxDelveTier:value('maxDelveTier'),stableTier:value('stableTier'),
      vaultWorld:value('vaultWorld'),vaultDungeon:value('vaultDungeon'),vaultRaid:value('vaultRaid'),
      venomstoneUnlocked:manual.venomstoneUnlocked==='' || !manual.venomstoneUnlocked ? null : manual.venomstoneUnlocked==='yes',source:'manual',observedAt},
      keystone:dungeon && keyLevel!==null ? {dungeon,level:keyLevel,source:'manual',observedAt} : null};
    setOverlay({resources:next.resources,progress:next.progress,keystone:next.keystone});
    setNotes({...manual});
    setSavedAt(observedAt);
    setSaved('재화와 진행 상황을 반영했습니다.');
  }

  const enteredTarget=Number(growthTarget), enteredReserve=Number(reserveValue);
  const growthSettings={target:enteredTarget>=1&&enteredTarget<=2000?enteredTarget:315,
    reserve:{[reserveKey]:Number.isSafeInteger(enteredReserve)&&enteredReserve>=0?enteredReserve:0},excludeSlots,priority:reserveKey};
  const result = snapshot ? diagnose(snapshot, isSample ? {demo:!savedAt,now:new Date(savedAt || '2026-11-26T10:00:00+09:00'),web:true,solo,...growthSettings} : {web:true,solo,...growthSettings}) : null;
  const nextGoal = !result || result.rawAverage === null || result.rawAverage >= 315 ? null : 315;
  const profile = snapshot?.profile;
  const nextQuestRefresh=result?.worldQuests?.nextRefresh;
  useEffect(()=>{
    if (nextQuestRefresh===undefined || !Number.isFinite(nextQuestRefresh)) return;
    const timeout=window.setTimeout(()=>refreshWorldQuests(current=>current+1),Math.max(1,nextQuestRefresh-Date.now()));
    return ()=>window.clearTimeout(timeout);
  },[nextQuestRefresh]);
  const balanceRows = new Map(result?.resources.map(row=>[row.key,row]));
  const gear: Gear[] = snapshot?.equipment ?? [];
  const weak = new Set(result?.weakSlots.map((row:Gear)=>row.slot));

  return <main>
    <header className="mast"><a href="/">WoW <strong>GearPath</strong></a><span>한국 리테일 <i /> {season.name}</span></header>
    <section className="lookup" aria-labelledby="lookup">
      <div><p className="eyebrow">장비 · 재화 · 파밍</p><h1 id="lookup">캐릭터 장비 진단</h1></div>
      <form className="search" onSubmit={event=>{event.preventDefault(); void search({realm,name:name.trim()});}}>
        <label>서버<select required value={realm} onChange={e=>setRealm(e.target.value)}>
          <option value="">{realmList.length ? '서버 선택' : '서버 목록 대기'}</option>
          {realmList.map(row=><option key={row.slug} value={row.slug}>{row.name}</option>)}
        </select></label>
        <label>캐릭터명<input required maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="캐릭터명 입력" /></label>
        <button className="primary" disabled={busy || !realm || !name.trim()}>{busy?'조회 중…':'검색 및 진단'}</button>
        <button type="button" disabled={busy} onClick={()=>load(sample(),true)}>샘플 보기</button>
      </form>
      {realmError && <p className="feedback" role="status">{realmError} <button type="button" onClick={()=>retryRealms(x=>x+1)}>다시 불러오기</button></p>}
      {error && <p className="feedback" role="alert">{error}</p>}
      {recent.length>0 && <div className="recent"><span>최근 검색</span>{recent.map(row=><button key={JSON.stringify(row)} disabled={busy} onClick={()=>{setRealm(row.realm);setName(row.name);void search(row);}}>{row.name} · {realmList.find(x=>x.slug===row.realm)?.name ?? row.realm}</button>)}</div>}
    </section>
    <section className="lookup" aria-label="애드온 연동">
      <h2>애드온 데이터 가져오기</h2>
      <label>애드온 JSON<textarea className="snapshot-json" rows={3} maxLength={maxImportBytes} value={rawAddon} onChange={e=>setRawAddon(e.target.value)} /></label>
      <button type="button" disabled={!rawAddon.trim()||busy} onClick={()=>importAddon(rawAddon)}>JSON 가져오기</button>
      <label>JSON 파일<input type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{
        const file=e.target.files?.[0];e.target.value='';
        if(!file)return;
        const revision=++importRevision.current;
        if(file.size>maxImportBytes || !file.name.toLowerCase().endsWith('.json')) {setImportStatus('256 KiB 이하의 JSON 파일을 선택하세요.');return;}
        try {const json=await file.text();if(revision===importRevision.current) importAddon(json);}
        catch {if(revision===importRevision.current) setImportStatus('파일을 읽을 수 없습니다.');}
      }} /></label>
      {addon && <button type="button" onClick={()=>{importRevision.current++;setAddon(null);if(!base || base.source==='sample'){setOverlay(null);setManual({});setNotes({});setSaved('');setSavedAt('');setSample(base?.source==='sample');}setImportStatus('가져온 데이터를 삭제했습니다.');}}>가져온 데이터 삭제</button>}
      <p role="status">{importStatus}</p>
      {addon && <p>애드온 {addon.addonVersion ?? '버전 미확인'} · 수집 {presentTime(addon.observedAt)} KST · 장비 출처 {combined?.equipmentSource==='addon'?'애드온':'Blizzard'}</p>}
      {addon?.collectionWarnings?.map((warning:string,index:number)=><p className="feedback" key={index}>{warning}</p>)}
      {equipmentConflict && <label>장비 충돌 해결<select value={prefer} onChange={e=>setPrefer(e.target.value as typeof prefer)}><option value="auto">완전성과 최신성 기준</option><option value="addon">애드온 장비 사용</option><option value="base">Blizzard 장비 사용</option></select></label>}
      <label><span><input style={{width:'auto'}} type="checkbox" checked={solo} onChange={e=>setSolo(e.target.checked)} /> 솔플만 추천</span></label>
    </section>
    {snapshot && result && <>
      <section className="character">
        <div><p className="eyebrow">{isSample ? '가상 샘플' : realmList.find(x=>x.slug===snapshot.realm)?.name ?? snapshot.realm}</p>
          <h2>{snapshot.name}</h2><p>{profile?.race ?? '종족 미확인'} · {profile?.className ?? '직업 미확인'} · {profile?.specialization ?? '전문화 미확인'} · {profile?.level ?? '—'} 레벨{roles[profile?.role] ? ` · ${roles[profile.role]}` : ''}</p>
          <small>조회 시각 {presentTime(snapshot.fetchedAt ?? snapshot.observedAt)} KST</small></div>
        <div className="metric"><span>평균 장착 레벨</span><strong>{result.displayAverage ?? '미확인'}</strong></div>
        <div className="metric"><span>다음 목표</span><strong>{nextGoal ?? '—'}</strong><small>{solo?'솔플만 추천':result.groupEligible?'그룹 후보 표시':result.rawAverage !== null && result.rawAverage>=315?'그룹 추천 보류 · 진단 범위 확인':'315부터 그룹 후보 표시'}</small></div>
      </section>
      <div className="columns">
        <section className="panel"><div className="section-title"><h2>장착 장비</h2><span>교체 후보 표시</span></div>
          <div className="table-scroll"><table aria-label="장착 장비"><thead><tr><th>부위</th><th>아이템</th><th>레벨</th><th>강화</th></tr></thead><tbody>
            {Object.entries(slots).map(([slot,label])=>{
              const item = gear.find(x=>x.slot===slot);
              return <tr className={weak.has(slot)?'weak':''} key={slot}>
                <th scope="row">{label}{weak.has(slot)&&<small>교체 검토</small>}</th>
                <td>{item ? <div className="gear">{item.icon ? <img src={item.icon} width={30} height={30} alt="" /> : <span className="icon" aria-hidden="true" />}
                  <span className={item.quality ?? ''}>{item.name || '이름 미확인'}<small>{qualities[item.quality ?? ''] ?? '등급 미확인'}</small></span></div>
                  : slot==='OFF_HAND'&&snapshot.weaponMode==='two-hand' ? '양손 무기 사용' : '미확인'}</td>
                <td className="number">{item?.ilvl ?? '—'}</td><td><span>{item?.track ? `${Object.hasOwn(tracks,item.track) ? tracks[item.track] : item.track} ${item.rank ?? '—'}${item.maxRank ? '/'+item.maxRank : ''}` : item?.upgradeStatus==='unrecognized'?'미인식 트랙':'미확인'}</span>
                  {item?.upgradeText && <small className="upgrade-note">{item.upgradeText}</small>}
                  {(item?.setId || item?.bonusIds?.length) ? <details><summary>장비 세부 정보</summary>{item.setId ? <div>세트 ID {item.setId}</div> : null}{item.bonusIds?.length ? <div>보너스 ID {item.bonusIds.join(', ')}</div> : null}</details> : null}</td>
              </tr>;
            })}
          </tbody></table></div>
        </section>
        <section className="panel"><div className="section-title"><h2>추천 파밍 순서</h2><span>솔플 우선</span></div>
          {result.worldQuests && <WorldQuestPanel model={result.worldQuests} />}
          <ol className="routes">{result.activities.map(row=><li key={row.id}><div><h3>{row.title}</h3><span className="badge">{row.kind==='group'?'그룹':row.certainty}</span></div><p>{row.id==='weak-slots' ? result.weakSlots.map((item:Gear)=>`${slots[item.slot] ?? item.slot} ${item.ilvl}`).join(' · ') : row.reason}</p></li>)}</ol>
          {savedAt && <div className="progress-note"><strong>입력한 진행 상황</strong><dl>{progressFields.map(([id,label])=><div key={id}><dt>{label}</dt><dd>{notes[id] || '미입력'}</dd></div>)}</dl></div>}
          <details><summary>진단 범위 및 공식 출처</summary><ul>{result.warnings.map(w=><li key={w}>{w}</li>)}</ul><a href={season.source}>한국 시즌 공지</a> · <a href={season.updateSource}>12.1.5 공지</a></details>
        </section>
      </div>
      <section className="panel resources" aria-label="장비 성장 계획">
        <div className="section-title"><h2>장비 성장 계획</h2><span>{result.growth.scope==='synthetic'?'가상 강화 예제':'검증된 강화만 계산'}</span></div>
        <div className="growth-controls">
          <label>목표 평균 아이템 레벨<input type="number" min={1} max={2000} step="0.001" value={growthTarget} onChange={e=>setGrowthTarget(e.target.value)} /></label>
          <label>보존·우선 최소화 재화<select aria-label="보존·우선 최소화 재화" value={reserveKey} onChange={e=>setReserveKey(e.target.value)}>
            {resourceDefinitions.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}<option value="demoCrest" hidden={!isSample}>가상 문장</option>
          </select></label>
          <label>남겨둘 수량<input type="number" min={0} step={1} value={reserveValue} onChange={e=>setReserveValue(e.target.value)} placeholder="0" /></label>
        </div>
        <p className="growth-summary">현재 {result.displayAverage??'미확인'} · 목표 {result.growth.target} · 보유 재화로 가능한 확인 범위 {result.growth.plan?.max.average.toFixed(3)??'미확인'} · {goalStatuses[result.growth.status]}</p>
        {result.growth.plan ? <div className="growth-summary">
          {result.growth.plan.limited&&<p>탐색 한도에 도달했습니다. 표시된 경로는 실행 가능한 후보이며 전체 최적값은 미확인입니다.</p>}
          {result.growth.plan.missing.length>0&&<p>잔액 미확인 또는 오래됨: {result.growth.plan.missing.map(costLabel).join(', ')}</p>}
          {result.growth.gap!==null&&result.growth.gap>0&&<p>표시된 경로 기준 목표까지 평균 {result.growth.gap.toFixed(3)} 차이가 남습니다. 진단의 파밍 후보에서 교체 장비를 확인하세요.</p>}
          <details open><summary>현재 예산에서 평균을 가장 높인 경로</summary>
            <p>예상 소비 {costText(result.growth.plan.max.costs)} · 사용 재화 잔액 {costText(Object.fromEntries(Object.keys(result.growth.plan.max.costs).map(key=>[key,result.growth.plan!.max.remaining[key]])))}</p>
            <ol>{result.growth.plan.max.actions.map((action:GrowthAction)=><li key={action.actionId}>{slots[action.slot]} {action.from} → {action.to} · {costText(action.costs)}</li>)}</ol>
          </details>
          {result.growth.plan.targetPlans.length>0&&<details><summary>목표를 충족하는 비용 비교 ({result.growth.plan.targetPlans.length}/{result.growth.plan.targetPlanCount})</summary>
            <ul>{result.growth.plan.targetPlans.map((path,index)=><li key={index}>평균 {path.average.toFixed(3)} · {costText(path.costs)}
              <ol>{path.actions.map((action:GrowthAction)=><li key={action.actionId}>{slots[action.slot]} {action.from} → {action.to}</li>)}</ol>
            </li>)}</ul>
          </details>}
        </div>:<p className="growth-summary">검증된 비용·할인과 최신 장비 정보가 갖춰지면 강화 경로를 표시합니다. 교체 확률과 DPS는 별도 확인이 필요합니다.</p>}
        <div className="table-scroll"><table aria-label="슬롯별 성장 분석"><thead><tr><th>부위</th><th>현재 / 상한</th><th>다음 비용 / 평균 증가</th><th>판단</th><th>제외</th></tr></thead>
          <tbody>{result.gearAnalysis.map((row:GrowthSlot)=><tr key={row.slot}><th scope="row">{slots[row.slot]}</th>
            <td>{row.ilvl} / {row.maxIlvl??'미확인'}<small className="upgrade-note">단계 {row.rank??'—'}/{row.maxRank??'—'} · {row.source==='addon'?'애드온':row.source==='blizzard'?'Blizzard':'입력'} · {presentTime(row.observedAt)}</small></td>
            <td>{row.next ? <>{costText(row.next.costs)} · +{row.next.averageGain.toFixed(3)}{row.next.discount==='unknown'&&<small className="upgrade-note">기본 비용 · 할인 미확인</small>}
              {row.maxCosts&&<small className="upgrade-note">최대 단계까지 {costText(row.maxCosts)}</small>}</>:'미확인'}</td>
            <td>{decisions[row.decision]}<small className="upgrade-note">{row.reason}</small></td>
            <td><input type="checkbox" aria-label={`${slots[row.slot]} 강화에서 제외`} checked={excludeSlots.includes(row.slot)} onChange={e=>setExcludeSlots(e.target.checked?[...excludeSlots,row.slot]:excludeSlots.filter(slot=>slot!==row.slot))} /></td>
          </tr>)}</tbody></table></div>
      </section>
      <section className="panel resources"><div className="section-title"><h2>보유 재화와 진행 상황</h2><span>빈칸은 미입력, 0은 보유 없음</span></div>
      <form onSubmit={applyResources}>
        <div className="table-scroll"><table aria-label="보유 재화"><thead><tr><th>재화</th><th>보유량</th><th>출처와 수집 상태</th><th>용도 및 검증</th><th>수동 입력</th></tr></thead><tbody>
        {resourceDefinitions.map(({key,label,use,collection,identityStatus})=>{
          const row=balanceRows.get(key);
          return <tr key={key}><th scope="row">{label}</th><td className="number">{row?.value??'—'}</td>
            <td>{row ? <>{row.source==='addon'?'애드온':'수동'} · {balanceStates[row.state]??(row.value===null?'미입력':'입력됨')}{row.status==='오래됨'?' · 오래됨':''}
              <small className="upgrade-note">{presentTime(row.observedAt)} · {scopeNames[row.scope]??'범위 미확인'}</small>
              {(row.maxQuantity!=null || row.weeklyEarned!=null || row.weeklyLimit!=null) && <small className="upgrade-note">관측 상한 {row.maxQuantity??'—'} · 주간 {row.weeklyEarned??'—'}/{row.weeklyLimit??'—'}</small>}</>:'미입력'}</td>
            <td>{use}<small className="upgrade-note">{identityStatus==='kr-client-observed'?'한국 12.1.5 실측 · 소비 검증 대기':collection==='contract-only'?'계약 지원 · ID 실측 대기':'소비 계산 보류'}</small></td>
            <td><input type="number" aria-label={label} min={0} max={999999999} step={1} placeholder="미입력" value={manual[key]??''} onChange={e=>setManual({...manual,[key]:e.target.value})} /></td></tr>;
        })}</tbody></table></div><div className="inputs">
        {progressFields.map(([id,label,max])=><label key={id}>{label}<input type="number" min={id.includes('Tier')?1:0} max={max} step={1} placeholder="미입력" value={manual[id]??''} onChange={e=>setManual({...manual,[id]:e.target.value})} /></label>)}
        <label>승천의 맹독석 해금<select value={manual.venomstoneUnlocked??''} onChange={e=>setManual({...manual,venomstoneUnlocked:e.target.value})}><option value="">미입력</option><option value="yes">해금</option><option value="no">미해금</option></select></label>
        <label>보유 쐐기돌 던전<input maxLength={80} value={manual.dungeon??''} onChange={e=>setManual({...manual,dungeon:e.target.value})} placeholder="미입력" /></label>
        <label>보유 쐐기돌 단계<input type="number" min={2} max={100} value={manual.keyLevel??''} onChange={e=>setManual({...manual,keyLevel:e.target.value})} placeholder="미입력" /></label>
      </div><button className="primary">진단에 반영</button><span className="save" role="status">{saved}</span></form>
      </section>
    </>}
    {!result && <div className="empty"><strong>장착 장비와 파밍 경로</strong><p>한국 리테일 캐릭터를 검색하거나 샘플을 열어 진단 내용을 확인하세요.</p></div>}
    <footer>WoW GearPath · 월드 오브 워크래프트 팬 도구 <span>315는 서비스의 추천 기준입니다.</span></footer>
  </main>;
}
