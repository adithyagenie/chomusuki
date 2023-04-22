// handles search query formation

import { anime, PrismaClient } from "@prisma/client";
//import { db } from "..";
// export const db = new PrismaClient();
import { db } from "../api/UpdRelease";

/**Takes alid list as parameter and returns list of nyaa search queries along with their anime objects. */
export async function GetNyaaSearchQueries(alid: number[]) {
	let searchqueries: string[] = [];
	//return fs.readJson("./AnimeNames.json")
	const otime = new Date().getTime();
	const obj = await db.anime.findMany({
		where: {
			alid: { in: alid },
		},
	});
	console.log(`Postgres took: ${new Date().getTime() - otime} ms`);
	for (let i = 0; i < obj.length; i++) {
		let cs = obj[i];
		let name = `"${cs.enname}"|"${cs.jpname}"`;
		for (let j = 0; j < cs.optnames.length; j++) {
			name += `|"${cs.optnames[j]}"`;
		}
		if (cs.excludenames.length != 0) {
			name += " -";
			for (let j = 0; j < cs.excludenames.length; j++) {
				if (j == 0) name += `"${cs.excludenames[j]}"`;
				else name += `|"${cs.excludenames[j]}"`;
			}
		}
		let finalsearch = `${name} 1080p`;
		searchqueries.push(finalsearch);
	}
	let returnobj: [string[], anime[]] = [searchqueries, obj];
	return returnobj;
}

/**Takes user id and list of alid as parameter and returns the ep status of them for the user */
export async function GetWatchedList(userid: string, alidlist: number[]) {
	return await db.watchedepanime.findMany({
		where: { userid: userid, alid: { in: alidlist } },
		select: { alid: true, ep: true },
	});
}

// const alidlist = [143064, 155202];
// GetNyaaSearchQueries(alidlist)
// 	.then(async ([a, b]) => {
// 		console.log(a, b);
// 		const c = await GetWatchedList("c578f7", alidlist);
// 		console.log(c);
// 	})
// 	.catch((e) => console.error(e));
