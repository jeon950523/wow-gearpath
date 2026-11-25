import { realms, errorResponse } from '../../server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return Response.json({realms: await realms()}, {headers: {'Cache-Control': 'public, max-age=300, s-maxage=3600'}});
  } catch (error) {
    return errorResponse(error);
  }
}
