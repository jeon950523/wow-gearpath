import {maxImportBytes,parseAddon} from './addon-import.mjs';
import {maxUpgradeDiagnosticBytes,parseUpgradeDiagnostic} from './upgrade-diagnostic.mjs';

export const maxSavedVariablesBytes=10*1024*1024;
export const maxSavedVariablesFiles=8;
const maxPayloadBytes=2*1024*1024;
const maxDepth=32;
const maxEntries=10000;
const maxStringLength=maxImportBytes;
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const reserved=new Set(['__proto__','prototype','constructor']);

function readLuaData(text) {
  let offset=text.charCodeAt(0)===0xfeff ? 1 : 0, entries=0;
  const positional=new WeakMap();
  const whitespace=/[ \t\r\n\f\v]+/y;
  const longDelimiter=/\[=*\[/y;
  const name=/[A-Za-z_][A-Za-z0-9_]*/y;
  const number=/-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  const stringChunk=/[^"'\\\r\n]+/y;
  const simpleEscapes={a:7,b:8,f:12,n:10,r:13,t:9,v:11,'\\':92,'"':34,"'":39,'\n':10};
  function fail() { throw new Error('SavedVariables Lua 데이터 형식이 올바르지 않습니다.'); }
  function match(pattern) {
    pattern.lastIndex=offset;
    const token=pattern.exec(text)?.[0];
    if(token) offset+=token.length;
    return token;
  }
  function skip() {
    do {
      match(whitespace);
      if(!text.startsWith('--',offset)) return;
      offset+=2;
      if(match(longDelimiter)) fail();
      while (offset<text.length && text[offset]!=='\n' && text[offset]!=='\r') offset++;
    } while (offset<text.length);
  }
  function take(char) {
    skip();
    if (text[offset]!==char) return false;
    offset++;
    return true;
  }
  function expect(char) { if(!take(char)) fail(); }
  function readString() {
    const quote=text[offset++];
    const chunks=[];
    let length=0;
    while (offset<text.length) {
      if (length>maxStringLength) fail();
      const char=text[offset];
      if (char===quote) {
        offset++;
        if (chunks.every(chunk=>typeof chunk==='string')) return chunks.join('');
        const bytes=new Uint8Array(length*3);
        let used=0;
        for (const chunk of chunks) {
          if (typeof chunk==='string') used+=encoder.encodeInto(chunk,bytes.subarray(used)).written;
          else bytes[used++]=chunk;
        }
        try {return decoder.decode(bytes.subarray(0,used));} catch {fail();}
      }
      if (char==='\n' || char==='\r') fail();
      if (char!=='\\') {
        const chunk=match(stringChunk)??text[offset++];
        length+=chunk.length;
        chunks.push(chunk);
        continue;
      }
      offset++;
      length++;
      const escape=text[offset];
      if (escape==='\r') {
        offset++;
        if (text[offset]==='\n') offset++;
        chunks.push(10);
      } else if (Object.hasOwn(simpleEscapes,escape)) {
        offset++;
        chunks.push(simpleEscapes[escape]);
      } else {
        const decimal=/^\d{1,3}/.exec(text.slice(offset,offset+3))?.[0];
        if (!decimal || +decimal>255) fail();
        offset+=decimal.length;
        chunks.push(+decimal);
      }
    }
    fail();
  }
  function value(depth) {
    skip();
    if (text[offset]==='{' && depth<maxDepth) return table(depth+1);
    if (text[offset]==='"' || text[offset]==="'") return readString();
    const numeric=match(number);
    if (numeric) {
      const n=Number(numeric);
      if (!Number.isFinite(n) || Math.abs(n)>Number.MAX_SAFE_INTEGER) fail();
      return n;
    }
    switch(match(name)) {
      case 'true': return true;
      case 'false': return false;
      case 'nil': return null;
      default: fail();
    }
  }
  function table(depth) {
    expect('{');
    const result=Object.create(null), positions=new Set();
    positional.set(result,positions);
    let implicit=1;
    while (!take('}')) {
      if (++entries>maxEntries) fail();
      let key;
      if (take('[')) {
        key=value(depth);
        if (typeof key!=='string' && !Number.isSafeInteger(key)) fail();
        expect(']');
        expect('=');
      } else {
        const start=offset;
        key=match(name);
        if (!key || !take('=')) {offset=start;key=implicit++;}
      }
      if (reserved.has(key) || Object.hasOwn(result,key)) fail();
      if(typeof key==='number') positions.add(key);
      result[key]=value(depth);
      if (!take(',') && !take(';')) {expect('}');break;}
    }
    return result;
  }
  skip();
  const root=match(name);
  if(root!=='WowGearPathDB' && root!=='WowGearPathUpgradeDB') fail();
  expect('=');
  const result=table(1);
  take(';');
  skip();
  if(offset!==text.length) fail();
  return {root,database:result,positional};
}

const canonical=value=>value.normalize('NFC').toLowerCase();
function requireStorage(ok) {
  if (!ok) throw new Error('지원하지 않거나 손상된 GearPath 저장 형식입니다.');
}
const keyAllowed=(record,keys)=>record!==null && typeof record==='object' &&
  Object.keys(record).every(key=>keys.includes(key));
const identityText=value=>typeof value==='string' && value.trim()===value && value.length>0 &&
  encoder.encode(value).length<=128 && !/[\p{Cc}\p{Cf}]/u.test(value);
const same=(left,right)=>canonical(left)===canonical(right);

function normalizeSnapshot(raw,options) {
  const {profile,worldQuestPatch,equipment,...snapshot}=parseAddon(raw,options);
  // Raw links are unnecessary for reimport, and are omitted from the download.
  const json=JSON.stringify({...snapshot,equipment:equipment.map(({itemLink,...item})=>item)});
  parseAddon(json,options);
  return {kind:'snapshot',json,name:snapshot.name,realm:snapshot.realm,realmDisplayName:snapshot.realmDisplayName,
    observedAt:snapshot.observedAt,hasWorldQuests:snapshot.worldQuests!==undefined,historyJson:null};
}

export function readSavedVariables(raw,options) {
  if(typeof raw!=='string' || raw.length>maxSavedVariablesBytes ||
      encoder.encode(raw).length>maxSavedVariablesBytes) throw new Error('SavedVariables 파일은 10 MiB 이하여야 합니다.');
  const {root,database,positional}=readLuaData(raw);
  const operational=root==='WowGearPathDB';
  let payloadBytes=0;
  function charge(value,limit) {
    requireStorage(typeof value==='string' && value.length<=limit);
    const size=encoder.encode(value).length;
    payloadBytes+=size;
    requireStorage(size<=limit && payloadBytes<=maxPayloadBytes);
  }
  function snapshot(value) {
    charge(value,maxImportBytes);
    return normalizeSnapshot(value,options);
  }
  if(operational && !Object.hasOwn(database,'storageVersion')) {
    requireStorage(keyAllowed(database,['lastExport']));
    if(typeof database.lastExport!=='string') throw new Error('저장된 GearPath JSON이 없습니다.');
    return [snapshot(database.lastExport)];
  }
  requireStorage(database.storageVersion===1 &&
    keyAllowed(database,operational?['storageVersion','lastExport','characters']:['storageVersion','characters']));
  const characters=database.characters;
  requireStorage(characters!==null && typeof characters==='object');
  const count=Object.keys(characters).length;
  requireStorage(count<=16);
  const entries=[];
  const identities=new Set(), displayToSlug=new Map();
  for(let index=1;index<=count;index++){
    requireStorage(positional.get(characters)?.has(index));
    const row=characters[index];
    const fields=['region','realmDisplayName','realm','name'];
    requireStorage(keyAllowed(row,[...fields,...(operational?['snapshotJson','worldQuestSnapshotJson']:['upgradeJson'])]) &&
      row.region==='kr' && identityText(row.realmDisplayName) && identityText(row.name) &&
      (operational || Object.hasOwn(row,'realm') ? identityText(row.realm) && /^[\p{L}\p{N}-]{1,80}$/u.test(row.realm) : true));
    const identity=JSON.stringify([row.realm??row.realmDisplayName,row.name].map(canonical));
    const display=JSON.stringify([row.realmDisplayName,row.name].map(canonical));
    requireStorage(!identities.has(identity) && !displayToSlug.has(display));
    identities.add(identity);
    displayToSlug.set(display,row.realm);
    if (!operational) {
      charge(row.upgradeJson,maxUpgradeDiagnosticBytes);
      const diagnostic=parseUpgradeDiagnostic(row.upgradeJson,options);
      requireStorage(diagnostic.observations.length>0);
      const lastObserved=Math.max(...diagnostic.observations.map(entry=>entry.observation.observedAt));
      entries.push({kind:'upgrade',json:row.upgradeJson,name:row.name,realm:row.realm??row.realmDisplayName,
        realmDisplayName:row.realmDisplayName,observedAt:new Date(lastObserved*1000).toISOString(),historyJson:null});
      continue;
    }
    const entry=snapshot(row.snapshotJson);
    const matches=value=>same(value.name,row.name) && same(value.realm,row.realm) &&
      (value.realmDisplayName===null || same(value.realmDisplayName,row.realmDisplayName));
    requireStorage(matches(entry));
    if(Object.hasOwn(row,'worldQuestSnapshotJson')) {
      const history=snapshot(row.worldQuestSnapshotJson);
      requireStorage(!entry.hasWorldQuests && history.hasWorldQuests && matches(history) &&
        Date.parse(history.observedAt)<=Date.parse(entry.observedAt));
      entry.historyJson=history.json;
    }
    entries.push(entry);
  }
  if(operational && Object.hasOwn(database,'lastExport')) {
    const legacy=snapshot(database.lastExport);
    const display=legacy.realmDisplayName && JSON.stringify([legacy.realmDisplayName,legacy.name].map(canonical));
    requireStorage(!display || !displayToSlug.has(display) || same(displayToSlug.get(display),legacy.realm));
    // In v1 the per-character record wins. The compatibility copy cannot replace it.
    if (!identities.has(JSON.stringify([legacy.realm,legacy.name].map(canonical)))) {requireStorage(entries.length<16);entries.push(legacy); }
  }
  return entries;
}

export function latestSavedCharacters(entries) {
  const characters=new Map();
  for (const entry of entries) {
    const key=JSON.stringify([entry.kind,canonical(entry.realm),canonical(entry.name)]);
    if (!characters.has(key) || Date.parse(entry.observedAt)>Date.parse(characters.get(key).observedAt)) characters.set(key,entry);
  }
  return [...characters.values()];
}
