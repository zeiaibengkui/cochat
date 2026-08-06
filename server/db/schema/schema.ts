import * as t from "drizzle-orm/pg-core";

export const users = t.pgTable("users", {
	id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
	name: t.varchar("name", { length: 256 }),
	email: t.varchar("email").unique(),
});
