import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { PASSCODE_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Server-side check behind the proxy, so the gate never relies on proxy alone.
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(PASSCODE_COOKIE)?.value)) {
    redirect("/login");
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-6">{children}</main>
    </>
  );
}
