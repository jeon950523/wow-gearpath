import {SLOTS} from './engine.mjs';
export function sample() {
  const observedAt='2026-11-26T09:00:00+09:00';
  return {schemaVersion:1,region:'kr',realm:'sample-realm',name:'샘플모험가',source:'sample',seasonId:'midnight-s2',observedAt,weaponMode:'two-hand',
    equipment:SLOTS.filter(x=>x!=='OFF_HAND').map((slot,i)=>({slot,itemId:900000+i,name:`샘플 ${slot}`,ilvl:i%3===0?308:315,track:'DEMO',rank:i%3===0?1:3})),
    resources:Object.fromEntries([['cofferKey',3],['demoCrest',60],['gold',1000],['venomstone',null]].map(([k,value])=>[k,{value,source:'sample',observedAt}])),
    progress:{maxDelveTier:8,venomstoneUnlocked:null,source:'sample',observedAt}};
}
