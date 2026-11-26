'use client';

import {useRef,useState} from 'react';
import {latestSavedCharacters,maxSavedVariablesBytes,maxSavedVariablesFiles,readSavedVariables} from '../src/saved-variables.mjs';

type SavedCharacter=ReturnType<typeof readSavedVariables>[number];
const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'});

export function SavedVariablesImport({disabled,onImport}:{disabled:boolean;onImport:(json:string,history:string|null)=>void}) {
  const [entries,setEntries]=useState<SavedCharacter[]>([]);
  const [selected,setSelected]=useState(0);
  const [feedback,setFeedback]=useState('');
  const [reading,setReading]=useState(false);
  const revision=useRef(0);

  async function readFiles(files:File[]) {
    const current=++revision.current;
    if(!files.length) return;
    if(files.length>maxSavedVariablesFiles || files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024) {
      setFeedback('한 번에 Lua 파일을 최대 8개, 합계 20 MiB까지 선택하세요.');
      return;
    }
    setReading(true);
    const next:SavedCharacter[]=[];
    const errors=new Set<string>();
    for (const file of files) {
      if(!file.name.toLowerCase().endsWith('.lua') || file.size>maxSavedVariablesBytes) {
        errors.add('10 MiB 이하의 .lua 파일을 선택하세요.');
        continue;
      }
      try {
        const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
        next.push(...readSavedVariables(raw));
      } catch (error) {
        errors.add(error instanceof TypeError ? 'UTF-8 Lua 파일을 읽을 수 없습니다.' :
          error instanceof Error ? error.message : 'SavedVariables 파일을 읽을 수 없습니다.');
      }
    }
    if (current!==revision.current) return;
    const characters=latestSavedCharacters(next);
    if(characters.length) {setEntries(characters);setSelected(0);}
    setFeedback([...(characters.length?[characters.length+'명의 저장 데이터를 확인했습니다.']:[]),...errors].join(' '));
    setReading(false);
  }

  function download(json:string,filename:string) {
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const link=document.createElement('a');
    link.href=url;
    link.download=filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const entry=entries[selected];
  return <details className="saved-variables">
    <summary>SavedVariables 파일에서 가져오기</summary>
    <p>WoW에서 기록한 WowGearPath.lua 파일을 선택하세요. 브라우저에서 읽고 원래 관측 시각을 유지합니다.</p>
    <label>SavedVariables Lua 파일<input type="file" accept=".lua" multiple disabled={disabled||reading}
      onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';void readFiles(files);}} /></label>
    <p role="status">{feedback}</p>
    {entry && <>
      <label>저장된 캐릭터<select value={selected} onChange={event=>setSelected(Number(event.target.value))} disabled={disabled||reading}>
        {entries.map((item,index)=><option key={index} value={index}>{item.name} · {item.realmDisplayName??item.realm} · {item.kind==='upgrade'?'강화 진단':'운영 스냅샷'} · {time.format(new Date(item.observedAt))} KST</option>)}
      </select></label>
      {entry.kind==='snapshot' ?
        <button type="button" disabled={disabled||reading} onClick={()=>onImport(entry.json,entry.historyJson)}>저장 데이터 가져오기</button> :
        <p>별도 강화 진단 자료입니다. 성장 계획과 보유 재화에 반영하지 않습니다.</p>}
      <button type="button" disabled={reading} onClick={()=>download(entry.json,entry.kind==='upgrade'?'gearpath-upgrade-diagnostic.json':'gearpath-snapshot.json')}>JSON 다운로드</button>
      {entry.historyJson && <button type="button" disabled={reading}
        onClick={()=>download(entry.historyJson!,'gearpath-world-quests-history.json')}>이전 전역퀘 JSON 다운로드</button>}
      <button type="button" onClick={()=>{revision.current++;setReading(false);setEntries([]);setFeedback('');}}>선택한 파일 데이터 지우기</button>
    </>}
  </details>;
}
