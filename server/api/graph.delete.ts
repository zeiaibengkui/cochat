import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { graphs, nodes } from "../db/schema/graph";

export default defineEventHandler(async (event) => {
    const session = await getServerSession(event);
    if (!session?.user?.id) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const id = Number(getQuery(event).id);
    if (!id) throw createError({ statusCode: 400, message: "id required" });

    // Get the graph and its root
    const [graph] = await db.select().from(graphs).where(eq(graphs.id, id));
    if (!graph) throw createError({ statusCode: 404, message: "Graph not found" });

    // Ownership check via the root node's author (string comparison)
    const [rootNode] = await db
        .select({ author: nodes.author })
        .from(nodes)
        .where(eq(nodes.id, graph.root));
    const userName = session.user.name ?? session.user.email ?? "";
    if (!rootNode || rootNode.author !== userName) {
        throw createError({ statusCode: 403, message: "Not your graph" });
    }

    // Collect all node IDs in the tree (BFS from root)
    const nodeIds: number[] = [];
    const queue = [graph.root];
    while (queue.length) {
        const current = queue.shift()!;
        nodeIds.push(current);
        const children = await db
            .select({ id: nodes.id })
            .from(nodes)
            .where(eq(nodes.parent, current));
        queue.push(...children.map((c) => c.id));
    }

    // Delete the graph first (FK graphs.root → nodes.id blocks node delete)
    await db.delete(graphs).where(eq(graphs.id, id));

    // Delete nodes bottom-up (children before parents, avoids parent FK violation)
    for (const nodeId of nodeIds.reverse()) {
        await db.delete(nodes).where(eq(nodes.id, nodeId));
    }

    return { success: true };
});
