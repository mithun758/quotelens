import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { StepRail } from "@/components/StepRail";
import { PASSCODE_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";
import { formatDisplayDate } from "@/lib/config";
import { db } from "@/lib/db/client";
import { loadProgress } from "@/lib/nav/progress";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Server-side check behind the proxy, so the gate never relies on proxy alone.
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value)) {
    redirect("/login");
  }
  // The shell still renders if progress cannot load; the screen shows its own error.
  const progress = await loadProgress(db(), formatDisplayDate).catch(() => null);

  return (
    <>
      <Header progress={progress} />
      <div className="flex flex-1">
        <StepRail progress={progress} />
        <main className="min-w-0 flex-1 px-6 py-5">{children}</main>
      </div>
    </>
  );
}
