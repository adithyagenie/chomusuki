import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
	const a = await db.users.findUnique({
		where: { userid: 1 }
	});
	console.log(a);
}
main();
