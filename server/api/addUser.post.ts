import { db } from "../db";
import { users } from "../db/schema/schema";

export default eventHandler(async event => {
	const body = await readBody(event);
	await db.insert(users).values(body);
	return body;
});
