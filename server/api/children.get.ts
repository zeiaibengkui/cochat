import { nodes } from "../db/schema/graph";

export default defineEventHandler<{ query: { parent: number } }>(
	async event => {
		const parent = getQuery(event).parent;
		const children = await db
			.select()
			.from(nodes)
			.where(eq(nodes.parent, parent));
		return children;
	}
);
