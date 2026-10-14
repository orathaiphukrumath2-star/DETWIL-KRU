import { ActivationForm } from "@/components/ActivationForm";
export const metadata = {
  title: "เปิดใช้งานผู้ดูแล | DETWIL",
  robots: { index: false, follow: false },
};
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <ActivationForm token={(await searchParams).token || ""} />;
}
