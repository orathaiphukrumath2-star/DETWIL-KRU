import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { fileResponseHeaders } from "@/lib/fileResponse";
import {
  callWorkApi,
  errorResponse,
  sessionCookie,
  WorkApiError,
} from "@/lib/workServer";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const result = await callWorkApi<{
      name: string;
      mime: string;
      base64: string;
    }>(
      "downloadFile",
      {
        id: query.get("work"),
        fileId: query.get("file"),
        preview: query.get("preview") === "1",
      },
      (await cookies()).get(sessionCookie)?.value || "",
    );
    if (result.base64.length > 2800000)
      throw new WorkApiError("VALIDATION", "ไฟล์มีขนาดใหญ่เกินกำหนด");
    return new Response(Buffer.from(result.base64, "base64"), {
      headers: fileResponseHeaders(
        result.name,
        result.mime,
        query.get("inline") === "1",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
