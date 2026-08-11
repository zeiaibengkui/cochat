import { drizzle } from "drizzle-orm/d1";
export { sql, eq, and, or } from "drizzle-orm";

export { db } from "../db";
import { db } from "../db";

import * as schema from "../db/schema/user";

export function useDrizzle() {
    return drizzle(db);
}

export type User = typeof schema.users.$inferSelect;
