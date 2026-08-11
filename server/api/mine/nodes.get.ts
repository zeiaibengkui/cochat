import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { nodes } from "../../db/schema/graph";

export default defineEventHandler(async (event) => {
    const session = await getServerSession(event);
    if (!session?.user?.id) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const authorName = session.user.name ?? session.user.email ?? "";
    return db.select().from(nodes).where(eq(nodes.author, authorName));
});
