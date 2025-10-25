import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { getNumber, GetWatchedList } from "../database/animeDB";
import { anime, Anime, watchedepanime, watchinganime } from "../database/schema";
import { i_ProcessedObjV2 } from "../interfaces";

/** Returns all yet to watch episodes of user. */
export async function getPending(userid: number) {
    const t = new Date().getTime();
    const alidlistResult = await db
        .select({ alid: watchinganime.alid })
        .from(watchinganime)
        .where(eq(watchinganime.userid, userid));

    if (alidlistResult.length === 0) return undefined;
    const alidlist = alidlistResult[0];

    const animelist = await db.select().from(anime).where(inArray(anime.alid, alidlist.alid));
    const watchedlist = await GetWatchedList(userid, alidlist.alid);
    const reqQueue = [];
    for (let i = 0; i < alidlist.alid.length; i++) {
        const alid = alidlist.alid[i];
        let watched = watchedlist.find((o) => o.alid == alidlist.alid[i]);
        if (watched === undefined) watched = { alid: alid, ep: [] };
        const animeentry = animelist.find((o) => o.alid == alidlist.alid[i]);
        reqQueue.push(getPendingInAnime(getNumber(watched.ep) as number[], animeentry));
    }
    const res: i_ProcessedObjV2[] = await Promise.all(reqQueue);
    console.log(`----------RES TOOK :${new Date().getTime() - t} ms----------`);
    //writeJSON("./returnobj3.json", res);
    return res;
}

export async function getSinglePending(userid: number, animename?: string, alid?: number) {
    let animeentry: Anime;
    try {
        if (alid == undefined) {
            const animeResult = await db
                .select()
                .from(anime)
                .where(eq(anime.jpname, animename.trim()))
                .limit(1);

            if (animeResult.length == 0) {
                console.error(`Unable to fetch anime with name ${animename}`);
                return undefined;
            }
            animeentry = animeResult[0];
        } else {
            const animeResult = await db.select().from(anime).where(eq(anime.alid, alid));

            if (animeResult.length === 0) {
                console.error(`No anime found: ${alid}`);
                return undefined;
            }
            animeentry = animeResult[0];
        }
        const watchedResult = await db
            .select({ ep: watchedepanime.ep })
            .from(watchedepanime)
            .where(
                and(eq(watchedepanime.userid, userid), eq(watchedepanime.alid, animeentry.alid))
            );

        if (watchedResult.length === 0) {
            console.error(`Got null when pulling watched - ${alid}: ${userid}`);
            return null;
        }
        return await getPendingInAnime(getNumber(watchedResult[0].ep) as number[], animeentry);
    } catch (error) {
        console.error(error);
        return undefined;
    }
}

/**
 ** Internal function.
 ** Returns the 'res' obj for each watching anime.
 */
async function getPendingInAnime(watchedep: number[], animeentry: Anime) {
    let shortname: string | undefined;
    if (!(animeentry.optnames == null || animeentry.optnames.length == 0)) {
        shortname = animeentry.optnames.reduce((a, b) => (a.length <= b.length ? a : b)); // returns
        // shortest
        // string
        // in
        // optname
        if (animeentry.jpname.length <= shortname.length) {
            shortname = undefined;
        }
    }
    const status = animeentry.status;
    if (!(status == "RELEASING" || status == "NOT_YET_RELEASED" || status == "FINISHED")) return;
    const resobj = {
        alid: animeentry.alid,
        jpname: animeentry.jpname,
        enname: animeentry.enname,
        shortname: shortname,
        watched: watchedep,
        notwatched: [],
        image: animeentry.fileid,
        status: status,
    };
    resobj.notwatched = Array.from({ length: animeentry.last_ep }, (_, i) => i + 1)
        .concat(getNumber(animeentry.ep_extras))
        .sort((a, b) => (a > b ? 1 : -1))
        .filter((o) => !resobj.watched.includes(o)); // gets all notwatched ep
    return resobj;
}

// async function markCompletedChore(obj: i_ProcessedObjV2[]) {
// 	for (let i = 0; i < obj.length; i++) {
// 		if (obj[i].status == "RELEASING" || obj[i].status == "NOT_YET_RELEASED") continue;
// 		if (obj[i].notwatched.length == 0) {
// 		    await db.completedanime.
// 		}
// 	}
// }
