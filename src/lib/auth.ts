import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email && user.email.toLowerCase() === process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase());
    }
  }
};
