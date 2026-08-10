import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "./schema/user";

export const db = drizzle(process.env.DATABASE_URL!);
// const usersCount = await db.$count(users);
