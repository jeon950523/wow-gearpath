// Only independently verified facts go into the production season pack.
export const season = Object.freeze({
  id: 'midnight-s2', region: 'kr', patch: '12.1.5',
  name: '한밤 2시즌', checkedAt: '2026-11-26',
  validUntil: '2026-12-03T00:00:00+09:00', // review deadline, not season end
  source: 'https://news.blizzard.com/ko-kr/article/24294369/pvp-2',
  updateSource: 'https://news.blizzard.com/ko-kr/article/24307306/12-1-5',
  upgradeRules: [], // full rank/cost/discount table not primary-source verified
});

// Synthetic fixture only. NOT a live Midnight reward / cost table.
export const demoRules = [{
  track: 'DEMO', levels: [308, 311, 315, 318, 321, 324],
  currency: 'demoCrest', crestPerStep: 20, goldPerStep: 100,
  evidence: 'synthetic',
}];
