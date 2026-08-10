import * as t from "drizzle-orm/pg-core";
import { users } from "./user";

export const nodes = t.pgTable(
	"nodes",
	{
		id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
		parent: t.integer(), // one whose parent is null is a root
		createdAt: t.timestamp().defaultNow(),
		author: t
			.integer()
			.references(() => users.id)
			.notNull(),
		property: t
			.jsonb()
			.$type<{
				text: string;
			}>()
			.notNull(), // handle it in frontend
	},
	table => [
		t.foreignKey({
			columns: [table.parent],
			foreignColumns: [table.id],
		}),
	]
);

export type graphNode = typeof nodes.$inferSelect;

export const graphs = t.pgTable("graphs", {
	id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
	property: t
		.jsonb()
		.$type<{
			topic: string;
		}>()
		.notNull(),
	createdAt: t.timestamp().defaultNow().notNull(),
	root: t
		.integer()
		.references(() => nodes.id)
		.notNull(),
});

export type Graph = typeof graphs.$inferInsert;
