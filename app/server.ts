import 'server-only';
import { createBlizzardClient } from '../src/blizzard.mjs';
import { validate } from '../src/engine.mjs';

const client = createBlizzardClient({
  clientId: process.env.BLIZZARD_CLIENT_ID,
  clientSecret: process.env.BLIZZARD_CLIENT_SECRET,
});

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Entry<T> = { promise: Promise<T>; expires: number };
function cache<T>(max: number, ttl: number) {
  const entries = new Map<string, Entry<T>>();
  return (key: string, lookup: () => Promise<T>) => {
    const previous = entries.get(key);
    if (previous && previous.expires > Date.now()) return previous.promise;
    if (!previous && entries.size >= max) {
      for (const [id, entry] of entries) {
        if (entry.expires <= Date.now()) entries.delete(id);
      }
      if (entries.size >= max) throw new HttpError(429, '조회 요청이 많습니다. 잠시 후 다시 시도하세요.');
    }
    const promise = Promise.resolve().then(lookup).catch(error => {
      if (entries.get(key)?.promise === promise) entries.delete(key);
      throw error;
    });
    entries.set(key, {promise, expires: Date.now() + ttl});
    return promise;
  };
}

const realmCache = cache<Awaited<ReturnType<typeof client.realms>>>(1, 6 * 60 * 60_000);
const characterCache = cache<Awaited<ReturnType<typeof client.character>>>(200, 2 * 60_000);
export const realms = () => realmCache('kr', client.realms);
export async function character(realm: string, name: string) {
  if (!(await realms()).some(row => row.slug === realm)) throw new HttpError(400, '한국 리테일 서버 목록에서 선택하세요.');
  return characterCache(JSON.stringify([realm,name.toLowerCase()]), async () => {
    const snapshot = await client.character(realm, name, {media:true});
    validate(snapshot);
    return snapshot;
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({error: error.message}, {status: error.status});
  const upstream = error instanceof Error ? /^Blizzard (401|403|404|429|5\d\d):/.exec(error.message)?.[1] : null;
  const upstreamStatus = upstream ? Number(upstream) : null;
  const timeout = error instanceof Error && error.message.includes('시간 초과');
  const status = upstreamStatus === 401 ? 502 : upstreamStatus && upstreamStatus >= 500 ? 503 : upstreamStatus ?? (timeout ? 504 : 503);
  const message = upstreamStatus === 401 ? 'Blizzard 앱 인증에 실패했습니다.'
    : status === 403 ? '비공개 캐릭터이거나 Blizzard가 조회를 거부했습니다.'
    : status === 404 ? '캐릭터를 찾을 수 없습니다. 서버와 이름을 확인하세요.'
    : status === 429 ? 'Blizzard 조회 한도에 도달했습니다. 잠시 후 다시 시도하세요.'
    : status === 504 ? 'Blizzard 응답을 기다리다 시간이 초과됐습니다.'
    : 'Blizzard 조회가 일시적으로 불가능합니다.';
  return Response.json({error: message}, {status, headers: {'Cache-Control': 'no-store'}});
}
