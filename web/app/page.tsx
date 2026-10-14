import { Suspense } from "react";
import { AppsScriptConnection, AppsScriptConnectionPending } from "@/components/AppsScriptConnection";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <Dashboard connectionStatus={
    <Suspense fallback={<AppsScriptConnectionPending />}>
      <AppsScriptConnection />
    </Suspense>
  } />;
}
