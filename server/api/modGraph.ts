import { Graph, graphs, nodes } from "../db/schema/graph";

export default defineEventHandler<{ body: Graph["property"] }>(async event => {
	const body = await readBody(event);

	const a = await db
		.insert(nodes)
		.values({ property: { text: body.topic + " - root" } })
		.returning();

	const root = a[0]?.id;
	if (!root) throw new Error("insert node failed");

	const graph = await db
		.insert(graphs)
		.values({ property: body, root: root })
		.returning();
	return { graph: graph[0]!.property, root: root };
});
