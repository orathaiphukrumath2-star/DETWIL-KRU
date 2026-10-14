import { NextResponse } from "next/server";
import { getAppsScriptHealth } from "@/lib/appsScript";
import { detwilProject } from "@/lib/detwil";
import { sheetCount } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const appsScript = await getAppsScriptHealth();
  return NextResponse.json({
    ok: appsScript.ok,
    system: detwilProject.shortName,
    phase: detwilProject.currentPhase,
    sheetCount,
    appsScript,
    timestamp: new Date().toISOString(),
  }, {
    status: appsScript.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
