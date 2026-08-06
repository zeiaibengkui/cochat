import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./server/database/migrations",
	schema: "./server/db/schema",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
