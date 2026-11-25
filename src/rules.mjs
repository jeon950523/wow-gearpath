import manifest from './data/expansions/midnight/season-2/manifest.json' with {type:'json'};
import currencies from './data/expansions/midnight/season-2/currencies.json' with {type:'json'};
import growth from './data/expansions/midnight/season-2/growth.json' with {type:'json'};
import world from './data/expansions/midnight/season-2/world.json' with {type:'json'};
import activities from './data/expansions/midnight/season-2/activities.json' with {type:'json'};
import {activeSeasonRules,validateSeasonData,validateResourceDefinitions} from './data/validate-season.mjs';

export const resourceDefinitions = validateResourceDefinitions(currencies).accepted;
export const resourceByKey = new Map(resourceDefinitions.map(row=>[row.key,row]));
export const season = Object.freeze({
  ...manifest, id:manifest.seasonId, validUntil:manifest.reviewDueAt, upgradeRules:[],
});
export const seasonData = validateSeasonData(manifest,currencies,[...growth,...world,...activities]);
export function rulesAt(now){
  const rows=activeSeasonRules(seasonData,now);
  return {
    byId:new Map(rows.map(row=>[row.ruleId,row])),
    upgrades:rows.filter(row=>row.category==='upgrade-table').map(row=>({
      ...row.effect, source:row.source, evidence:row.verificationStatus, discountPolicy:row.conditions.discountPolicy,
    })),
  };
}

export const demoRules = [{
  track: 'DEMO', levels: [308, 311, 315, 318, 321, 324],
  currency: 'demoCrest', crestPerStep: 20, goldPerStep: 100,
  evidence: 'synthetic',
}];
