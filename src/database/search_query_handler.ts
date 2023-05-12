// handles search query formation

import { anime } from "@prisma/client";
//import { db } from "..";
// export const db = new PrismaClient();
import { db } from "..";

/**Takes alid list as parameter and returns list of nyaa search queries along with their anime objects. */
export async function GetNyaaSearchQueries(alid: number[]) {
	let searchqueries: string[] = [];
	//return fs.readJson("./AnimeNames.json")
	const otime = new Date().getTime();
	const obj = await db.anime.findMany({
		where: {
			alid: { in: alid }
		}
	});
	console.log(`Postgres took: ${new Date().getTime() - otime} ms`);
	for (let i = 0; i < obj.length; i++) {
		let cs = obj[i];
		let name = `"${cs.enname}"|"${cs.jpname}"`;
		if (cs.optnames != null || cs.optnames.length != 0)
			for (let j = 0; j < cs.optnames.length; j++) {
				name += `|"${cs.optnames[j]}"`;
			}
		else cs.optnames = [];
		if (cs.excludenames.length != 0) {
			name += " -";
			for (let j = 0; j < cs.excludenames.length; j++) {
				if (j == 0) name += `"${cs.excludenames[j]}"`;
				else name += `|"${cs.excludenames[j]}"`;
			}
		} else cs.excludenames = [];
		let finalsearch = `${name} 1080p`;
		searchqueries.push(finalsearch);
	}
	let returnobj: [string[], anime[]] = [searchqueries, obj];
	return returnobj;
}
