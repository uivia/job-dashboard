import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { refreshGoogleToken } from "./google-token";

const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";

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
          scope: `openid email profile ${gmailScope}`,
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email && user.email.toLowerCase() === process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase());
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token ?? undefined;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.accessTokenExpires = account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
        token.authError = undefined;
        return token;
      }

      if (token.accessToken && token.accessTokenExpires && Date.now() < token.accessTokenExpires * 1000 - 60_000) {
        return token;
      }
      if (!token.refreshToken) return { ...token, authError: "ReconnectGoogle" };

      try {
        const refreshed = await refreshGoogleToken(
          token.refreshToken,
          process.env.GOOGLE_CLIENT_ID ?? "",
          process.env.GOOGLE_CLIENT_SECRET ?? ""
        );
        return { ...token, accessToken: refreshed.accessToken, accessTokenExpires: refreshed.expiresAt, authError: undefined };
      } catch {
        return { ...token, authError: "ReconnectGoogle" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.authError;
      return session;
    }
  }
};
