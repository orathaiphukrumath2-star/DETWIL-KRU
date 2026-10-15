import { ResetPassword } from "@/components/PasswordRecovery";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ตั้งรหัสผ่านใหม่ | DETWIL",
  robots: { index: false, follow: false },
};
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <ResetPassword
      token={
        typeof params.token === "string" && params.token.length <= 200
          ? params.token
          : ""
      }
    />
  );
}
