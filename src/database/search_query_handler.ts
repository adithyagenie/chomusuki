// handles search query formation

import { anime } from "@prisma/client";
//import { db } from "..";
// export const db = new PrismaClient();
import { db } from "..";

/**Takes alid list as parameter and returns list of nyaa search queries along with their anime objects. */
export async function GetNyaaSearchQueries(alid: number[]) {
    const searchqueries: string[] = [];
    const otime = new Date().getTime();
    const obj = await db.anime.findMany({
        where: {
            alid: { in: alid }
        }
    });
    console.log(`Postgres took: ${new Date().getTime() - otime} ms`);
    for (let i = 0; i < obj.length; i++) {
        const cs = obj[i];
        let name = `"${cs.enname}"|"${cs.jpname}"`;
        if (cs.optnames.length != 0)
            for (let j = 0; j < cs.optnames.length; j++) {
                name += `|"${cs.optnames[j]}"`;
            }
        else cs.optnames = [];
        if (cs.excludenames.length == 0) {
            cs.excludenames = [];
        } else {
            name += " -";
            for (let j = 0; j < cs.excludenames.length; j++) {
                if (j == 0) name += `"${cs.excludenames[j]}"`;
                else name += `|"${cs.excludenames[j]}"`;
            }
        }
        const finalsearch = `${name} 1080p`;
        searchqueries.push(finalsearch);
    }
    const returnobj: [string[], anime[]] = [searchqueries, obj];
    return returnobj;
}
