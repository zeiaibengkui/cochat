import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { nodes } from "../db/schema/graph";

export default defineEventHandler(async (event) => {
    const session = await getServerSession(event);
    if (!session?.user?.id) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const { id, property } = await readBody(event);
    if (!id || !property) {
        throw createError({ statusCode: 400, message: "id and property required" });
    }
    const userName = session.user.name ?? session.user.email ?? "";

    const [node] = await db.select().from(nodes).where(eq(nodes.id, id));
    if (!node) throw createError({ statusCode: 404, message: "Node not found" });

    if (node.author !== userName) {
        throw createError({ statusCode: 403, message: "Not your node" });
    }

    // Preserve original text on first edit, mark as edited
    const updated = {
        ...property,
        edited: true,
        originalText: node.property?.originalText ?? node.property?.text,
    };

    await db.update(nodes).set({ property: updated }).where(eq(nodes.id, id));

    return { success: true };
});
