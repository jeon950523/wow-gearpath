import {formatCopper} from './format-copper';
import type {analyzeWorldQuests,RewardGroup,RewardKind} from '../src/world-quests.mjs';

const labels = {gold:'골드',items:'확정 아이템',choices:'선택 아이템',currencies:'화폐'} as const;
const states:Record<string,string>={observed:'관측',zeroUnverified:'0 의미 미확인',incomplete:'부분 관측',uncollected:'미수집',failed:'수집 실패'};
const localTime = (value:string|null) => value ? new Intl.DateTimeFormat('ko-KR',{
  timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',
}).format(new Date(value))+' KST' : '미확인';

function RewardDetails({kind,group}:{kind:RewardKind;group:RewardGroup}) {
  return <li>{labels[kind]} · {states[group.state]} · {localTime(group.observedAt)}
    {kind==='gold' && group.value!=null && <> · {formatCopper(group.value)}</>}
    {group.count===0 && <> · 없음</>}
    {group.rows?.map((item,index)=><div key={index}>
      {item.name??(kind==='currencies'?'화폐 '+item.currencyId:'아이템 '+item.itemId)} × {item.quantity.toLocaleString('ko-KR')}
      {item.ilvl!=null && <> · 아이템 레벨 {item.ilvl}</>}
      {item.factionId!=null && <> · 평판 연계</>}
    </div>)}
  </li>;
}

export function WorldQuestPanel({model}:{model:NonNullable<ReturnType<typeof analyzeWorldQuests>>}) {
  const {scan,rows,totals,historical,conflict}=model;
  const kinds=Object.keys(labels) as RewardKind[];
  return <section aria-label="오늘 할 일 · 전역퀘">
    <h3>오늘 할 일 · 전역퀘</h3>
    <p>애드온 {localTime(scan.observedAt)} · {states[scan.state]} · {scan.coverage==='seedMapsOnly'?'기준 지도':'기준 지도와 하위 지역'}
      {' · '}지도 {scan.maps.filter((map)=>map.status==='ok').length}/{scan.maps.length}
      {scan.discoveryPartial || scan.mapExpansion!=='ok' ? ' · 탐색 일부 미확인' : ''}</p>
    {historical && <p>갱신 필요 · 아래 항목은 이전 관측 참고용입니다.</p>}
    {conflict && <p>같은 시각의 전역퀘 목록이 달라 기존 관측을 유지했습니다.</p>}
    <p>표시 기본 보상 부분합 · 골드 {formatCopper(totals.goldCopper)}
      {' · '}확정 아이템 {totals.itemCount??'미확인'}</p>
    {totals.currencies.length>0 && <ul aria-label="화폐 부분합">{totals.currencies.map((currency)=><li key={currency.currencyId}>
      {currency.name??'화폐 '+currency.currencyId} {currency.quantity.toLocaleString('ko-KR')}{currency.factionId!=null?' · 평판 연계':''}
    </li>)}</ul>}
    <p>관측 범위 안의 표시 보상입니다. 선택 아이템은 별도로 표시하며, 골드는 보유량이나 성장 예산에 반영하지 않습니다.</p>
    {!rows.length && <p>{scan.state==='failed' || scan.state==='uncollected' ? '전역퀘 목록을 수집하지 못했습니다.' : '이 스캔 범위에서 발견한 전역퀘가 없습니다.'}</p>}
    {[...rows.filter(item=>item.active),...rows.filter(item=>!item.active)].map(({row,active,included,locationUsable})=><details key={row.questId}>
      <summary>{row.title??'퀘스트 '+row.questId} · {active?'활성 확인':'참고'} · {locationUsable?row.zoneName:'위치 참고 제한'} · 만료 {localTime(row.expiresAt)}</summary>
      {row.completed===true && <p>완료</p>}
      {row.completed===null && <p>완료 여부 미확인</p>}
      {row.activeUnverified && <p>활성 여부 미확인</p>}
      {row.zoneName && !locationUsable && <p>관측 지역 {row.zoneName}</p>}
      {included.length>0 && <p>현재 관측 보상 · {included.map(kind=>labels[kind]).join(' · ')}</p>}
      <ul>{kinds.map(kind=><RewardDetails key={kind} kind={kind} group={row[kind]}/>)}</ul>
      {row.cached && Object.keys(row.cached).length>0 && <><p>이전 보상 캐시 · 참고용</p>
        <ul>{kinds.map(kind=>{const group=row.cached?.[kind];return group && <RewardDetails key={kind} kind={kind} group={group}/>;})}</ul></>}
    </details>)}
  </section>;
}
