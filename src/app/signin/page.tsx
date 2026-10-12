import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { authOptions } from "@/lib/auth";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email?.toLowerCase() === process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase()) redirect("/");

  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true">J</div>
        <p className="eyebrow">ROLE LOG · PRIVATE WORKSPACE</p>
        <h1>Your next role,<br />organized.</h1>
        <p>Sign in with the Google account you use for job applications.</p>
        <SignInButton />
      </section>
    </main>
  );
}

