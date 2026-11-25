const metric = (value, other) => value<other?-1:value>other?1:0;
const noMore = (left,right) => left.every((cost,index)=>cost<=right[index]);

// Each slot contributes one prefix. Costs stay as independent dimensions.
export function optimizeGrowth(groups, balances, {current,target=315,reserve={},priority=null,maxStates=256,maxTransitions=24000}={}) {
  const keys=[...new Set(groups.flatMap(group=>group.flatMap(option=>Object.keys(option.costs).filter(key=>option.costs[key]>0))))].sort();
  const stateLimit=Math.min(256,Math.max(1,Math.trunc(maxStates)||1));
  const transitionLimit=Math.min(24000,Math.max(1,Math.trunc(maxTransitions)||1));
  const start={gain:0,cost:keys.map(()=>0),actions:[],sequence:0};
  const missing=keys.filter(key=>balances[key]==null);
  const budgets=keys.map(key=>Math.max(0,(balances[key]??0)-(reserve[key]??0)));
  const priorityIndex=keys.indexOf(priority);
  const order=priorityIndex<0?keys.map((_,index)=>index):[priorityIndex,...keys.map((_,index)=>index).filter(i=>i!==priorityIndex)];
  const indexed=groups.map(group=>group.map(option=>({...option,costVector:keys.map(key=>option.costs[key]??0)})));
  const compareCost=(a,b)=>order.reduce((cmp,index)=>cmp || metric(a.cost[index],b.cost[index]),0);
  const compareGain=(a,b)=>b.gain-a.gain || compareCost(a,b) || a.sequence-b.sequence;
  let states=[start], transitions=0, peakStates=1, limited=false, sequence=0;
  for (const options of indexed) {
    if (transitions>=transitionLimit) {limited=true;break;}
    const next=[];
    visitStates: for (const state of states) {
      for (const option of options) {
        if(transitions>=transitionLimit){limited=true;break visitStates;}
        transitions++;
        const cost=state.cost.map((value,index)=>value+option.costVector[index]);
        if(!noMore(cost,budgets))continue;
        const gain=state.gain+option.gainUnits;
        if(next.some(x=>x.gain>=gain && noMore(x.cost,cost)))continue;
        for(let i=next.length-1;i>=0;i--) if(gain>=next[i].gain && noMore(cost,next[i].cost)) next.splice(i,1);
        next.push({gain,cost,actions:[...state.actions,...option.actions],sequence:sequence++});
        if(next.length>stateLimit){
          next.sort(compareGain);next.length=stateLimit;limited=true;
        }
      }
    }
    // Preserve an executable prefix even if the last group was cut short.
    if(next.length) states=next;
    peakStates=Math.max(peakStates,states.length);
  }
  const reaches = state => current+state.gain/16>=target;
  states.sort(compareGain);
  const targetStates=states.filter(reaches);
  const cheapest=targetStates.filter((state,i)=>!targetStates.some((other,j)=>i!==j &&
    noMore(other.cost,state.cost) && (other.cost.some((v,k)=>v<state.cost[k])||j<i)));
  cheapest.sort((a,b)=>compareCost(a,b)||compareGain(a,b));
  const pack=state=>({average:current+state.gain/16,
    costs:Object.fromEntries(keys.flatMap((key,i)=>state.cost[i]?[[key,state.cost[i]]]:[])),
    remaining:Object.fromEntries(Object.entries(balances).map(([key,v])=>[key,v==null?null:v-(state.cost[keys.indexOf(key)]??0)])),
    actions:state.actions});
  const max=pack(states[0]);
  return {max, targetPlans:cheapest.slice(0,5).map(pack), targetPlanCount:cheapest.length,
    status:targetStates.length?'reachable':limited||missing.length?'undetermined':'unreachable',
    limited, missing, transitions, peakStates};
}
