import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { nodes } from "../db/schema/graph";

export default defineEventHandler(async (event) => {
    const session = await getServerSession(event);
    if (!session?.user?.id) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const body = await readBody(event);
    const userName = session.user.name ?? session.user.email ?? "";
    const isUserMessage = !body.property?.role || body.property.role === "user";

    // For user messages: author MUST come from the session, not the client
    // For AI messages: accept body.author (model name)
    const author = isUserMessage ? userName : body.author || "unknown";

    // Verify parent (unless null = graph root)
    if (body.parent != null) {
        const [parentNode] = await db
            .select({ author: nodes.author, property: nodes.property })
            .from(nodes)
            .where(eq(nodes.id, body.parent));
        if (!parentNode) {
            throw createError({ statusCode: 404, message: "Parent node not found" });
        }
        // Allow: user-owned node, or AI node (anyone can reply to AI)
        const parentIsAi = parentNode.property?.role === "assistant";
        if (parentNode.author !== userName && !parentIsAi) {
            throw createError({ statusCode: 403, message: "Not your node" });
        }
    }

    const [node] = await db
        .insert(nodes)
        .values({ parent: body.parent, author, property: body.property })
        .returning();

    return node.id;
});
