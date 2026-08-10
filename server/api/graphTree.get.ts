import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { graphs, nodes } from "../db/schema/graph";

/** Returns the full tree for a graph: all nodes + parent-child edges */
export default defineEventHandler(async (event) => {
	const session = await getServerSession(event);
	if (!session?.user?.id) {
		throw createError({ statusCode: 401, message: "Unauthorized" });
	}

	const id = Number(getQuery(event).id);
	if (!id) throw createError({ statusCode: 400, message: "id required" });

	const [graph] = await db.select().from(graphs).where(eq(graphs.id, id));
	if (!graph) throw createError({ statusCode: 404, message: "Graph not found" });

	// BFS to collect all nodes
	const allNodes: typeof nodes.$inferSelect[] = [];
	const queue = [graph.root];
	while (queue.length) {
		const current = queue.shift()!;
		const [node] = await db.select().from(nodes).where(eq(nodes.id, current));
		if (!node) continue;
		allNodes.push(node);
		const children = await db.select({ id: nodes.id }).from(nodes).where(eq(nodes.parent, current));
		queue.push(...children.map(c => c.id));
	}

	// Build edges from parent relationships
	const edges = allNodes
		.filter(n => n.parent !== null)
		.map(n => ({ source: n.parent!, target: n.id }));

	return { nodes: allNodes, edges };
});
