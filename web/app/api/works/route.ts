import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  callWorkApi,
  errorResponse,
  sessionCookie,
  WorkApiError,
} from "@/lib/workServer";
import type { Identity, PublicList } from "@/lib/works";
import { isSameOrigin } from "@/lib/requestSecurity";
import { allowAuthAttempt, preparePasswordPayload } from "@/lib/passwordServer";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const actions = [
  "activateOwner",
  "passwordLogin",
  "session",
  "logout",
  "changePassword",
  "myWorks",
  "getWork",
  "saveWork",
  "workflow",
  "uploadFile",
  "adminData",
  "saveSchool",
  "createUser",
  "register",
  "switchRole",
  "requestRoles",
  "roleDecision",
  "assignRoles",
  "resetMemberPassword",
];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const data = await callWorkApi<PublicList>("publicWorks", {
      search: params.get("search"),
      type: params.get("type"),
      year: params.get("year"),
      page: params.get("page"),
    });
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Next's internal bind address can differ from the public Host behind a proxy.
    const protocol = (
      request.headers.get("x-forwarded-proto") ||
      request.nextUrl.protocol.replace(":", "")
    )
      .split(",")[0]
      .trim();
    if (
      !isSameOrigin(
        request.headers.get("origin"),
        request.headers.get("host"),
        protocol,
      ) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new WorkApiError("FORBIDDEN", "คำขอไม่ได้มาจากเว็บไซต์นี้");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new WorkApiError("VALIDATION", "รูปแบบคำขอไม่ถูกต้อง");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 3000000)
      throw new WorkApiError("VALIDATION", "ไฟล์มีขนาดใหญ่เกิน 2 MB");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new WorkApiError("VALIDATION", "ข้อมูล JSON ไม่ถูกต้อง");
    }
    if (!body || !actions.includes(body.action))
      throw new WorkApiError("VALIDATION", "ไม่พบคำสั่ง");
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value || "";
    if (
      !["register", "passwordLogin", "activateOwner"].includes(body.action) &&
      !token
    )
      throw new WorkApiError("UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
    if (
      [
        "register",
        "passwordLogin",
        "activateOwner",
        "changePassword",
        "createUser",
        "resetMemberPassword",
      ].includes(body.action)
    ) {
      const ip = (
        request.headers.get("x-forwarded-for") ||
        "local"
      )
        .split(",")[0]
        .trim()
        .slice(0, 80);
      if (!allowAuthAttempt(ip))
        throw new WorkApiError(
          "RATE_LIMIT",
          "ทำรายการบ่อยเกินไป กรุณารอแล้วลองใหม่",
        );
    }
    try {
      body.payload = await preparePasswordPayload(body.action, body.payload);
    } catch (error) {
      throw new WorkApiError(
        "VALIDATION",
        error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง",
      );
    }
    if (body.action === "passwordLogin") {
      const result = await callWorkApi<{
        token: string;
        user: Identity;
        maxAge?: number;
      }>(body.action, body.payload);
      const response = NextResponse.json({ ok: true, data: result.user });
      response.cookies.set(sessionCookie, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: result.maxAge === 2592000 ? 2592000 : 28800,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const data = await callWorkApi(body.action, body.payload, token);
    const response = NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (["logout", "changePassword"].includes(body.action))
      response.cookies.delete(sessionCookie);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
