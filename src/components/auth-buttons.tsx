"use client";

import { signIn, signOut } from "next-auth/react";

export function SignInButton() {
  return (
    <button className="primary-button wide" type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
      Continue with Google
    </button>
  );
}

export function SignOutButton() {
  return <button className="text-button" type="button" onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button>;
}

