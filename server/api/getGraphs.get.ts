import { graphs } from "../db/schema/graph";

export default eventHandler(async (_event) => {
    const a = db.select().from(graphs);
    return a;
});
