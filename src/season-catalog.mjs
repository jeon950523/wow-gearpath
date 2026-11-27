import catalog from './data/expansions/midnight/season-2/catalog.json' with {type:'json'};

export const seasonCatalog=catalog;

export function catalogApplies({region,seasonId,patch,now}) {
  return region===catalog.region && seasonId===catalog.seasonId && patch===catalog.patch &&
    Number.isFinite(+now) && +now>=Date.parse(catalog.checkedAt+'T00:00:00+09:00') && +now<Date.parse(catalog.reviewDueAt);
}

// A catalog family or recipe never establishes a merchant offer or a character's eligibility.
export function compareMerchantCandidate({offer,history,character,now=Date.now()}) {
  const equal=(left,right)=>typeof left==='string' && typeof right==='string' &&
    left.normalize('NFC').toLowerCase()===right.normalize('NFC').toLowerCase();
  if(!history?.merchant?.length) return 'uncollected';
  if(!equal(history.name,character.name) || !equal(history.realmDisplayName,character.realmDisplayName) ||
      history.region!==character.region || !catalogApplies({...character,now})) return 'unverified';
  if (!Number.isSafeInteger(offer.npcID) || !Number.isSafeInteger(offer.itemID) ||
      !Number.isSafeInteger(offer.itemLevel) || !Number.isSafeInteger(offer.filter) ||
      !Number.isSafeInteger(offer.mapID) || !Number.isSafeInteger(offer.lootSpecID) ||
      !Number.isSafeInteger(offer.specID) || character.specializationId!==offer.specID ||
      character.lootSpecializationId!==offer.lootSpecID) return 'unverified';
  const scans=history.merchant.filter(scan=>scan.patch===catalog.patch && scan.build===catalog.clientBuild && scan.regionID===2 &&
    scan.npcID===offer.npcID && scan.mapID===offer.mapID && scan.filter===offer.filter &&
    scan.lootSpecID===offer.lootSpecID && scan.specID===offer.specID &&
    +now-scan.observedAt*1000>=0 && +now-scan.observedAt*1000<15*60*1000);
  const latestTime=Math.max(...scans.map(scan=>scan.observedAt));
  const newest=scans.filter(scan=>scan.observedAt===latestTime);
  if(newest.length!==1) return 'unverified';
  const [latest]=newest;
  const matching=latest.rows.filter(row=>row.itemID===offer.itemID && row.itemLevel===offer.itemLevel && row.detailState==='observed');
  if(matching.length!==1 || !Array.isArray(offer.costs) || offer.priceCopper==null) return 'unverified';
  const [row]=matching;
  if(row.priceCopper==null || !['observed','noExtendedCost'].includes(row.costState)) return 'unverified';
  const costs=entries=>entries.map(entry=>JSON.stringify([entry.itemID,entry.currencyID,entry.quantity])).sort().join('|');
  return row.priceCopper===offer.priceCopper && costs(row.costs)===costs(offer.costs) ? 'corroborated' : 'conflict';
}
