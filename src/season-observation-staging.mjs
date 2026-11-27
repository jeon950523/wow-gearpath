import {decodeGrowthSavedVariables} from './saved-variables.mjs';
import {parseGrowthDiagnostic,validateGrowthDiagnosticsStorage} from './growth-diagnostics-contract.mjs';
import {parseUpgradeDiagnostic,upgradeSlotCandidates} from './upgrade-diagnostic.mjs';

const equal=(left,right)=>typeof left==='string' && typeof right==='string' &&
  left.normalize('NFC').toLowerCase()===right.normalize('NFC').toLowerCase();

// Only records for an explicitly selected character are staged. Records remain independent
// from the operational snapshot and never provide a spending budget or current price.
export function stageGrowthObservations(database,character,{now=Date.now()}={}) {
  validateGrowthDiagnosticsStorage(database,{now});
  const row=database.characters.find(candidate=>candidate.region===character.region &&
    equal(candidate.name,character.name) && equal(candidate.realmDisplayName,character.realmDisplayName));
  if(!row) return null;
  return {name:row.name,realmDisplayName:row.realmDisplayName,region:row.region,
    merchant:row.merchant.map(raw=>parseGrowthDiagnostic('merchant',raw,{now})),
    craft:row.craft.map(raw=>parseGrowthDiagnostic('craft',raw,{now})),
  };
}

export function stageGrowthSavedVariables(raw,character,options) {
  return stageGrowthObservations(decodeGrowthSavedVariables(raw),character,options);
}

export function stageUpgradeComparison(entry,snapshot,{now=Date.now()}={}) {
  const hasSlug=typeof entry.realm==='string' && !equal(entry.realm,entry.realmDisplayName);
  const sameRealm=hasSlug ? equal(entry.realm,snapshot.realm) : equal(entry.realmDisplayName,snapshot.realmDisplayName);
  if(entry.kind!=='upgrade' || snapshot.region!=='kr' || !equal(entry.name,snapshot.name) ||
    !sameRealm) return null;
  const diagnostic=parseUpgradeDiagnostic(entry.json,{now});
  return diagnostic.observations.map(({observation})=>({
    observation,candidateSlots:upgradeSlotCandidates(diagnostic,observation,snapshot),
  }));
}
