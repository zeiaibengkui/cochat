import { Graph, graphNode, graphs, nodes } from "../db/schema/graph";

export default defineEventHandler<{ body: graphNode }>(async event => {
	const body = await readBody(event);

	const a = await db.insert(nodes).values(body).returning();

	return a[0]!.id;
});
