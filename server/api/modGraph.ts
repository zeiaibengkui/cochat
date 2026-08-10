import { getServerSession } from "#auth";
import { Graph, graphs, nodes } from "../db/schema/graph";

export default defineEventHandler<{ body: Graph["property"] }>(async (event) => {
	const session = await getServerSession(event);
	if (!session?.user?.id) {
		throw createError({ statusCode: 401, message: "Unauthorized" });
	}

	const body = await readBody(event);

	const [rootNode] = await db
		.insert(nodes)
		.values({
			author: session.user.name ?? session.user.email ?? "unknown",
			property: { text: body.topic, role: "user" as const },
		})
		.returning();

	if (!rootNode) throw createError({ statusCode: 500, message: "Failed to create root node" });

	const [graph] = await db
		.insert(graphs)
		.values({ property: body, root: rootNode.id })
		.returning();

	return graph;
});
