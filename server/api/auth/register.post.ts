import bcrypt from "bcryptjs";
import { db } from "../../db";
import { users } from "../../db/schema/user";

export default defineEventHandler(async (event) => {
    const { email, password, name } = await readBody(event);

    if (!email || !password || !email.includes("@")) {
        throw createError({ statusCode: 400, message: "Valid email and password are required" });
    }

    if (password.length < 6) {
        throw createError({ statusCode: 400, message: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
        const [user] = await db.insert(users).values({ email, passwd: hash, name }).returning();
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
    } catch (e: any) {
        // Unique constraint violation — don't reveal whether the email exists.
        // Drizzle wraps pg errors; check both the wrapped error and its cause.
        const pgCode = e.code || e.cause?.code || "";
        if (pgCode === "23505" || e.message?.includes("duplicate key")) {
            throw createError({ statusCode: 409, message: "Registration failed" });
        }
        throw e;
    }
});
