import { LoginForm } from "./LoginForm";

export const metadata = { title: "Enter passcode · QuoteLens" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm border-t-[3px] border-ink bg-sheet p-6">
        <h1 className="text-xl font-semibold">QuoteLens</h1>
        <p className="mt-1 text-sm text-slate">Quote comparison for Meridian Diagnostics. Enter the demo passcode to continue.</p>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
    </main>
  );
}
