import { LoginForm } from "./LoginForm";

export const metadata = { title: "Enter passcode · QuoteLens" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">QuoteLens</h1>
        <p className="mt-1 text-sm text-zinc-600">Enter the demo passcode to continue.</p>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
    </main>
  );
}
