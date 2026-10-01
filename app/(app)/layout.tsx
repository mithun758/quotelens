import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { LensDock } from "@/components/lens/LensDock";
import { LensProvider } from "@/components/lens/LensProvider";
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

  // Lens docks on the right of every screen; it pushes the content, never covers it.
  return (
    <LensProvider attentionByScreen={progress?.attention ?? {}}>
      <Header progress={progress} />
      <div className="flex flex-1">
        <Suspense fallback={<div className="w-16 shrink-0 border-r border-rule bg-sheet" />}>
          <StepRail progress={progress} />
        </Suspense>
        <main className="@container min-w-0 flex-1 px-6 py-5">{children}</main>
        <LensDock />
      </div>
    </LensProvider>
  );
}
