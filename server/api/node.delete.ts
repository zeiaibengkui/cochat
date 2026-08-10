import { getServerSession } from "#auth";
import { eq } from "drizzle-orm";
import { nodes } from "../db/schema/graph";

export default defineEventHandler(async (event) => {
	const session = await getServerSession(event);
	if (!session?.user?.id) {
		throw createError({ statusCode: 401, message: "Unauthorized" });
	}

	const id = Number(getQuery(event).id);
	if (!id) throw createError({ statusCode: 400, message: "id required" });
	const userName = session.user.name ?? session.user.email ?? "";

	const [node] = await db.select().from(nodes).where(eq(nodes.id, id));
	if (!node) throw createError({ statusCode: 404, message: "Node not found" });

	// Ownership check
	if (node.author !== userName) {
		throw createError({ statusCode: 403, message: "Not your node" });
	}

	// Soft delete — hide the content but preserve the node in the tree
	// so comment chains (child nodes) are not broken.
	await db
		.update(nodes)
		.set({ property: { ...node.property, text: "[deleted]", deleted: true } })
		.where(eq(nodes.id, id));

	return { success: true };
});
