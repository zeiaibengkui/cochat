import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { nodes } from "../db/schema/graph";
import { users } from "../db/schema/user";

export default defineEventHandler(async (event) => {
    const session = await getServerSession(event);
    if (!session?.user?.id) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const userId = parseInt(session.user.id);
    const userName = session.user.name ?? session.user.email ?? "";

    // Match nodes by author name (varchar). Name collision is a known risk
    // at this scale; a proper solution would use a user_id FK alongside the
    // display author field, but the user chose varchar for flexibility
    // (model names as authors).
    await db.delete(nodes).where(eq(nodes.author, userName));

    // Delete the user record (id is a proper FK — no collision risk here)
    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
});
