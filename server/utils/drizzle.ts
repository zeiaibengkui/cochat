import { drizzle } from "drizzle-orm/d1";
export { sql, eq, and, or } from "drizzle-orm";

import * as schema from "../db/schema/schema";
export { db } from "../db";
import { db } from "../db";

export const tables = schema;

export function useDrizzle() {
	return drizzle(db);
}

export type User = typeof schema.users.$inferSelect;
