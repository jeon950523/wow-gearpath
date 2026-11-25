import { character, errorResponse, HttpError } from '../../server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const realm = query.get('realm')?.trim().normalize('NFC') ?? '';
    const name = query.get('name')?.trim().normalize('NFC') ?? '';
    if (!/^[\p{L}\p{N}-]{1,80}$/u.test(realm) || !/^[\p{L}\p{M}]{2,24}$/u.test(name)) {
      throw new HttpError(400, '한국 리테일 서버와 캐릭터명을 확인하세요.');
    }
    return Response.json(await character(realm, name), {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    return errorResponse(error);
  }
}
