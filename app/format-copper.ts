import {splitCopper} from '../src/activity-dashboard.mjs';

const quantity=new Intl.NumberFormat('ko-KR');
export function formatCopper(value:number|null) {
  const parts=splitCopper(value);
  if (!parts) return '미확인';
  const {gold,silver,copper}=parts;
  return [gold>0 && quantity.format(gold)+'골드',silver>0 && silver+'실버',
    (copper>0 || (gold===0 && silver===0)) && copper+'코퍼'].filter(Boolean).join(' ');
}
