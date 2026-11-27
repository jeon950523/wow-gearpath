import {useEffect,useState} from 'react';
import {catalogApplies,seasonCatalog as catalog} from '../src/season-catalog.mjs';

type Scope={region:string;seasonId:string;patch:string|null};

export function SeasonCatalogPanel({scope}:{scope:Scope}) {
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>setNow(Date.now()),[]);
  const current=now===null || catalogApplies({...scope,now});
  const source=(key:string)=>{
    const row=catalog.sources[key as keyof typeof catalog.sources];
    return <a key={key} href={row.url} title={row.scope}>{row.label}</a>;
  };
  const value=(n:number|null)=>n??'—';
  return <section className="panel resources season-catalog" aria-label="공개 시즌 성장 가이드">
    <div className="section-title"><h2>공개 시즌 성장 가이드</h2><span>{current?'한밤 2시즌 · 12.1.5':'과거 자료 · 시즌 재확인'}</span></div>
    <p className="section-body">공개 자료로 확인한 성장 후보입니다. 현재 판매·재고·개인 해금 및 구매 가능 여부는 게임에서 확인하세요.</p>
    <details>
      <summary>구렁 상인과 킨도잔 교환</summary>
      <ul className="weekly-list">{catalog.vendors.map(row=><li key={row.id}>
        <div><strong>{row.name}</strong><span>{row.policy==='rotating'?'회전 후보':'공개 경로'}</span></div>
        <small>{row.conditions}</small>
        <small>{row.track && <>장비 {row.track}{row.itemLevel && <> · {row.itemLevel}레벨</>} · </>}
          {row.cost ? <>{row.cost.label} {row.cost.quantity===null?'수량 미확인':row.cost.quantity+'개'}</> : '교환 비용 미확인'}</small>
        <small>{row.sources.map(source).reduce<React.ReactNode[]>((items,node)=>items.length?[...items,' · ',node]:[node],[])}</small>
      </li>)}</ul>
    </details>
    <details>
      <summary>구렁 난이도별 보상과 위대한 금고</summary>
      <div className="table-scroll"><table aria-label="구렁 공개 보상"><thead><tr><th>단계</th><th>풍요로운 보관함</th><th>보물 사냥꾼 보상</th><th>위대한 금고</th></tr></thead>
        <tbody>{catalog.delveRewards.tiers.map(row=><tr key={row.tier}><th scope="row">{row.tier}</th><td>{value(row.bountiful)}</td><td>{value(row.bounty)}</td><td>{value(row.vault)}</td></tr>)}</tbody>
      </table></div>
      <p>표시 아이템 레벨은 구렁 공개 자료 기준입니다. 개인 금고 후보·보상 획득은 게임에서 확인하세요. {source(catalog.delveRewards.source)}</p>
    </details>
    <details>
      <summary>제작 레시피와 기본 재료</summary>
      <ul className="weekly-list">{catalog.recipes.map(recipe=><li key={recipe.recipeId}>
        <div><strong>{recipe.label}</strong><span>{recipe.profession} · {recipe.slot}</span></div>
        <small>{recipe.unlock} · {recipe.baseMaterials.map(row=>row.label+' ×'+row.quantity).join(' · ')}</small>
        <small>{recipe.reagentSlots.map(row=>row.label+' ×'+row.quantity).join(' · ')} · 실제 주문 비용과 결과는 미확인</small>
        <small>{recipe.sources.map(source).reduce<React.ReactNode[]>((items,node)=>items.length?[...items,' · ',node]:[node],[])}</small>
      </li>)}</ul>
    </details>
  </section>;
}
