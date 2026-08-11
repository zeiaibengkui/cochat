import { drizzle } from "drizzle-orm/node-postgres";
// users schema imported via schema/graph for relations

export const db = drizzle(process.env.DATABASE_URL!);
// const usersCount = await db.$count(users);
