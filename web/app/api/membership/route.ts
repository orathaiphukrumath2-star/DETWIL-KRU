import { callWorkApi, errorResponse } from "@/lib/workServer";
export const maxDuration = 60;
export async function GET() {
  try {
    const data = await callWorkApi("registrationOptions");
    return Response.json(
      { ok: true, data },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
