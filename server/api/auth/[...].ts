import CredentialsProvider from "next-auth/providers/credentials";
import { NuxtAuthHandler } from "#auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema/user";

export default NuxtAuthHandler({
    secret: useRuntimeConfig().authSecret,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
        // @ts-expect-error NextAuth v4 provider default export quirk
        CredentialsProvider.default({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, credentials.email));
                if (!user) return null;

                const valid = await bcrypt.compare(credentials.password, user.passwd);
                if (!valid) return null;

                return { id: String(user.id), name: user.name, email: user.email };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string;
            }
            return session;
        },
    },
});
