const definitions=[
  ['vault','위대한 금고'],['delves','구렁'],['bountiful','풍요로운 구렁'],['kindozan','킨도잔'],
  ['nightmare','악몽 사냥'],['weekly-quests','주간 퀘스트'],['bonus-loot','추가 전리품'],
  ['raid','레이드'],['mythic','신화 쐐기돌'],
];

export const activityStatusLabels={
  complete:'완료',pending:'미완료',uncollected:'미수집',unknown:'확인 불가',
  locked:'잠김',expired:'만료',partial:'부분 관측',
};

// A visible progress counter does not establish completion or which reset it belongs to.
export function buildWeeklyActivities(snapshot, result) {
  const progress=snapshot.progress;
  const observations=(keys)=>keys.flatMap(([key,label])=>{
    const value=progress?.[key];
    if (value==null) return [];
    const origin=snapshot.fieldSources?.progress?.[key]??progress;
    return [{label,value,source:origin.source,observedAt:origin.observedAt}];
  });
  const vault=[['vaultWorld','야외·구렁'],['vaultDungeon','던전'],['vaultRaid','레이드']];
  const delves=[['maxDelveTier','최고 해금 단계'],['stableTier','안정 완료 입력']];
  const byId=new Map(result.activities.map(activity=>[activity.id,activity]));
  return definitions.map(([id,label])=>{
    const evidence=id==='vault' ? observations(vault) : id==='delves' ? observations(delves) : [];
    return {id,label,period:'weekly',status:evidence.length?'partial':'uncollected',evidence,
      recommendation:byId.get(id)??null};
  });
}

export function splitCopper(value) {
  if (!Number.isSafeInteger(value) || value<0) return null;
  const copper=value%100;
  const silver=((value-copper)%10000)/100;
  const gold=(value-silver*100-copper)/10000;
  return {gold,silver,copper};
}
