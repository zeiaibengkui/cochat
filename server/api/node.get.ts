import { nodes } from "../db/schema/graph";

export default defineEventHandler<{ query: { id: number } }>(async (event) => {
    const id = getQuery(event).id;
    const children = await db.select().from(nodes).where(eq(nodes.id, id));
    return children[0];
});
