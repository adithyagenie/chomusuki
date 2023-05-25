// // import { PrismaClient } from "@prisma/client";

// // const db = new PrismaClient();

// // async function main() {
// // 	const a = await db.users.findUnique({
// // 		where: { userid: 1 }
// // 	});
// // 	console.log(a);
// // }
// // main();

// import anilist from "anilist-node";
// require("dotenv").config();
// const al = new anilist(process.env.ANILIST_TOKEN);

// async function* yo() {
// 	let num = -1;
// 	let recordnum = 0;
// 	var item = await al.searchEntry.anime(
// 		null,
// 		{ status_in: ["RELEASING", "NOT_YET_RELEASED"] },
// 		1,
// 		5
// 	);
// 	let page = 1;
// 	console.log("yo");
// 	console.log(item.pageInfo, item.media, "\n\n\n\n\n");
// 	while (num <= item.pageInfo.total) {
// 		num++;
// 		recordnum++;
// 		console.log("woo");
// 		if (item.media[num] == undefined) {
// 			page++;
// 			console.log("GET PAGE ", page);
// 			item = await al.searchEntry.anime(
// 				null,
// 				{ status_in: ["RELEASING", "NOT_YET_RELEASED"] },
// 				page,
// 				5
// 			);
// 			num = 0;
// 			if (item.media == null) return;
// 		}
// 		console.log("ITERATION:: ", recordnum, num);
// 		yield item.media[num];
// 	}
// }

// async function gen() {
// 	const a = yo();
// 	let i = 0;
// 	while (i < 30) {
// 		const b = await a.next();
// 		if (b.done == true) {
// 			console.log("done");
// 			break;
// 		}
// 		if (b.value === undefined) {
// 			console.log(b.value);
// 			break;
// 		} else {
// 			console.log("-------------------------------------------\n", b.value);
// 			console.log("yooooooooooooooooooooooooooooooooooooooooo");
// 		}
// 		i++;
// 	}
// }
// gen().catch(console.error);
