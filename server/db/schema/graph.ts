import * as t from "drizzle-orm/pg-core";

export const nodes = t.pgTable(
	"nodes",
	{
		id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
		parent: t.integer(), // null = root
		createdAt: t.timestamp().defaultNow(),
		author: t.varchar("author", { length: 256 }).notNull(), // user name or model name
		property: t
			.jsonb()
			.$type<{
				text: string;
				role: "user" | "assistant";
				deleted?: boolean;
				edited?: boolean;
				originalText?: string;
			}>()
			.notNull(),
	},
	table => [
		t.foreignKey({
			columns: [table.parent],
			foreignColumns: [table.id],
		}),
	],
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
export type GraphSelect = typeof graphs.$inferSelect;
