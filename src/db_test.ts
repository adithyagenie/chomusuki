import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	await prisma.animenames.deleteMany();
	const res = await prisma.animenames.create({
		data: {
			alid: 155202,
			enname: "Revenger",
			jpname: "Revenger",
			excludenames: ["Tokyo revengers", "Tokyo"],
			optnames: undefined,
		},
	});
	console.log(res);
	const res2 = await prisma.animenames.findMany();

	console.log(res2);
}

main().catch((e) => console.log(e));
