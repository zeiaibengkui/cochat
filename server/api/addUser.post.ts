import { users } from "../db/schema/user";

export default eventHandler(async event => {
	const body = await readBody(event);
	await db.insert(users).values(body);
	return body;
});
