import { db } from "..";
import { eq, and, inArray, sql, arrayContains, count } from "drizzle-orm";
import * as schema from "./schema";
import * as types from "../interfaces";
import aniep from "aniep";
import { getAnimeDetails, imageGet } from "../api/anilist_api";
import { bot } from "../bot/bot";

export async function addAnimeNames(obj: schema.NewAnime) {
    try {
        const insertres = await db.insert(schema.anime)
            .values(obj)
            .onConflictDoUpdate({
                target: schema.anime.alid,
                set: obj
            })
            .returning();
        
        await db.insert(schema.airingupdates)
            .values({
                alid: obj.alid,
                userid: []
            })
            .onConflictDoUpdate({
                target: schema.airingupdates.alid,
                set: { userid: [] }
            });
        
        console.log(`POSTGRES: Add anime - Documents inserted: ${insertres[0].alid}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: addAnimeNames - ${err}`);
        return 1;
    }
}

export async function markWatchedunWatched(obj: schema.NewWatchedEpAnime) {
    try {
        const res = await db.insert(schema.watchedepanime)
            .values(obj)
            .onConflictDoUpdate({
                target: [schema.watchedepanime.userid, schema.watchedepanime.alid],
                set: obj
            })
            .returning();
        
        console.log(
            `POSTGRES: Mark watched/unwatched - Documents upserted: ${res[0].userid}: ${res[0].alid}`
        );
        return 0;
    } catch (err) {
        console.error(`POSTGRES: markWatchedunWatched - ${err}`);
        return 1;
    }
}

export async function addWatching(userid: number, alid: number) {
    try {
        // Get current alid array
        const current = await db.select({ alid: schema.watchinganime.alid })
            .from(schema.watchinganime)
            .where(eq(schema.watchinganime.userid, userid));
        
        const newAlids = current.length > 0 ? [...current[0].alid, alid] : [alid];
        
        const add = await db.update(schema.watchinganime)
            .set({ alid: newAlids })
            .where(eq(schema.watchinganime.userid, userid))
            .returning();
        
        await db.insert(schema.watchedepanime)
            .values({ userid: userid, alid: alid, ep: [] });
        
        console.log(`POSTGRES: Add subscription - Documents updated: ${add[0].userid}: ${alid}`);
    } catch (err) {
        console.error(`POSTGRES: addWatching - ${err}`);
    }
}

/**Takes user id and list of alid as parameter and returns the ep status of them for the user */
export async function GetWatchedList(userid: number, alidlist: number[]) {
    return db.select({
        alid: schema.watchedepanime.alid,
        ep: schema.watchedepanime.ep
    })
    .from(schema.watchedepanime)
    .where(
        and(
            eq(schema.watchedepanime.userid, userid),
            inArray(schema.watchedepanime.alid, alidlist)
        )
    );
}

export async function getUserWatchingAiring(
    table: "watchinganime" | "airingupdates",
    userid: number,
    count?: number,
    offset?: number
) {
    try {
        let alidlist: number[] = [];
        let amount: number;
        if (table == "airingupdates") {
            // Count airingupdates where userid array contains the userid
            const countResult = await db.select({ count: sql<number>`count(*)` })
                .from(schema.airingupdates)
                .where(arrayContains(schema.airingupdates.userid, [userid]));
            
            amount = Number(countResult[0].count);
            console.log(amount);
            if (amount == 0) return { alidlist: [], animelist: [], amount: 0 };
            
            const _ = await db.select({ alid: schema.airingupdates.alid })
                .from(schema.airingupdates)
                .where(arrayContains(schema.airingupdates.userid, [userid]))
                .limit(count)
                .offset(offset);
            
            alidlist = _.map((o) => o.alid);
        } else {
            const _ = await db.select({ alid: schema.watchinganime.alid })
                .from(schema.watchinganime)
                .where(eq(schema.watchinganime.userid, userid));
            
            if (_.length === 0) return { alidlist: [], animelist: [], amount: 0 };
            else alidlist = _[0].alid;
            amount = alidlist.length;
            if (count !== undefined && offset !== undefined)
                alidlist = alidlist.slice(offset - 1, count + offset - 1);
        }
        
        const tosort = await db.select({
            jpname: schema.anime.jpname,
            alid: schema.anime.alid
        })
        .from(schema.anime)
        .where(inArray(schema.anime.alid, alidlist));
        
        tosort.sort((a, b) => (alidlist.indexOf(a.alid) > alidlist.indexOf(b.alid) ? 1 : -1));
        const animelist = tosort.map((o) => o.jpname);
        if (alidlist.length !== animelist.length) {
            console.error(`POSTGRES: get_Watching_Airing - "Unequal fetch for anime: alid"`);
            return undefined;
        }

        console.log(`${alidlist}:: ${animelist}`);
        return { alidlist, animelist, amount };
    } catch (err) {
        console.error(`POSTGRES: get_Watching_Airing - ${err}`);
        return undefined;
    }
}

// export async function removeWatching(obj: schema.WatchingAnime) {
//     try {
//         const del = await db.update(schema.watchinganime)
//             .set(obj)
//             .where(eq(schema.watchinganime.userid, obj.userid))
//             .returning();
//         console.log(`POSTGRES: Unsubscribed anime - Deletion success: ${del[0].userid}`);
//         return 0;
//     } catch (err) {
//         console.error(`POSTGRES: removeWatching - ${err}`);
//     }
// }

export async function addAiringFollow(alid: number, userid: number) {
    try {
        // Get current userid array
        const current = await db.select({ userid: schema.airingupdates.userid })
            .from(schema.airingupdates)
            .where(eq(schema.airingupdates.alid, alid));
        
        const newUserids = current.length > 0 ? [...current[0].userid, userid] : [userid];
        
        await db.update(schema.airingupdates)
            .set({ userid: newUserids })
            .where(eq(schema.airingupdates.alid, alid));
        
        return 0;
    } catch (err) {
        console.error(`POSTGRES: addAiringFollow - ${err}`);
        return 1;
    }
}

export async function newDL(obj: types.i_DlSync) {
    try {
        const insertData: schema.NewSyncupd = {
            userid: obj.userid,
            synctype: obj.synctype,
            anime: obj.anime,
            epnum: obj.epnum.toString(),
            dltype: obj.dltype,
            xdccdata: obj.xdccdata || [],
            torrentdata: obj.torrentdata
        };
        
        const res = await db.insert(schema.syncupd)
            .values(insertData)
            .returning();
        
        console.log(`POSTGRES: New download queued - Documents inserted: ${res}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: DlSync - ${err}`);
    }
}

export async function changeConfig(newconfig: schema.Config) {
    try {
        const res = await db.update(schema.config)
            .set(newconfig)
            .where(eq(schema.config.userid, newconfig.userid))
            .returning();
        
        console.log(`POSTGRES: UPDATE CONFIG: ${res[0].userid}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: changeConfig - ${err}`);
    }
}

export async function newWatchlist(watchlist_name: string, generated_by: number) {
    try {
        const res = await db.insert(schema.watchlists)
            .values({
                watchlist_name,
                generated_by,
                alid: []
            })
            .returning();
        
        console.log(`POSTGRES: Watchlist created - ${res[0].watchlist_name}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: newWatchlist - ${err}`);
        return 1;
    }
}

export async function addToWatchlist(watchlistid: number, addAlID: number) {
    try {
        const anime = await checkAnimeTable(addAlID);
        if (anime == "err") {
            console.error(`POSTGRES: addToWatchList - Unable to find anime ${addAlID}`);
            return "err";
        }
        if (anime == "invalid") return "invalid";
        
        const wl = await db.select({ alid: schema.watchlists.alid })
            .from(schema.watchlists)
            .where(eq(schema.watchlists.watchlistid, watchlistid));
        
        if (wl.length === 0) throw new Error("Watchlist not found");
        
        const is_present = wl[0].alid.filter((o) => o === addAlID).length > 0;
        if (is_present === true) return "present";
        
        const newAlids = [...wl[0].alid, addAlID];
        
        const res = await db.update(schema.watchlists)
            .set({ alid: newAlids })
            .where(eq(schema.watchlists.watchlistid, watchlistid))
            .returning();
        
        console.log(`POSTGRES: Watchlist item added - ${res[0].watchlistid}`);
        return anime.pull.jpname;
    } catch (err) {
        console.error(`POSTGRES: addToWatchList - ${err}`);
        return "err";
    }
}

export async function markDone(userid: number, AlID: number) {
    try {
        // Get current completed array
        const current = await db.select({ completed: schema.completedanime.completed })
            .from(schema.completedanime)
            .where(eq(schema.completedanime.userid, userid));
        
        const newCompleted = current.length > 0 ? [...current[0].completed, AlID] : [AlID];
        
        const res = await db.update(schema.completedanime)
            .set({ completed: newCompleted })
            .where(eq(schema.completedanime.userid, userid))
            .returning();
        
        console.log(`POSTGRES: Marking anime as done - ${res[0].userid}:${AlID}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: markDone - ${err}`);
    }
}

export async function markNotDone(userid: number, AlID: number) {
    try {
        const result = await db.select({ completed: schema.completedanime.completed })
            .from(schema.completedanime)
            .where(eq(schema.completedanime.userid, userid));
        
        if (result.length === 0) throw new Error("User not found");
        
        const completed = [...result[0].completed];
        const i = completed.indexOf(AlID);
        if (i === -1)
            return "missing";
        completed.splice(i, 1);
        
        await db.update(schema.completedanime)
            .set({ completed })
            .where(eq(schema.completedanime.userid, userid));
        
        console.log(`POSTGRES: Marking anime as not done - ${userid}:${AlID}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: markNotDone - ${err}`);
        return 1;
    }
}

export async function removeFromWatchlist(watchlistid: number, AlID: number) {
    try {
        const old = await db.select()
            .from(schema.watchlists)
            .where(eq(schema.watchlists.watchlistid, watchlistid));
        
        if (old.length === 0) return "wlmissing";
        
        const alidArray = [...old[0].alid];
        const index = alidArray.indexOf(AlID);
        if (index == -1) return "alidmissing";
        alidArray.splice(index, 1);
        
        const res = await db.update(schema.watchlists)
            .set({ alid: alidArray })
            .where(eq(schema.watchlists.watchlistid, watchlistid))
            .returning();
        
        console.log(`POSTGRES: Removing anime from watchlist - ${res[0].watchlistid}:${AlID}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: markDoneWatchlist - ${err}`);
        return 1;
    }
}

// export async function getUserWatchlists(userid: number) {
// 	const wl = await db.select({
//         watchlist_name: schema.watchlists.watchlist_name,
//         watchlistid: schema.watchlists.watchlistid,
//         alid: schema.watchlists.alid
//     })
//     .from(schema.watchlists)
//     .where(eq(schema.watchlists.generated_by, userid));
//     
// 	if (wl.length === 0) return { wl: null, wllist: null };
// 	return { wl: wl, wllist: wl.map((o) => o.watchlist_name) };
// }

export async function getWatchlistAnime(
    wlid: number,
    currentpg?: number,
    amount?: number,
    paginate = true,
    needmaxpg = true,
    towatch = { towatch: false, userid: undefined }
) {
    let maxpg: number;
    if (needmaxpg === true) {
        if (towatch.towatch === true) {
            const result = await db.execute<{ len: string }>(
                sql`SELECT count(a) as len
                    FROM watchlists w, completedanime c, unnest(w.alid) a 
                    WHERE (c.userid = ${towatch.userid}) and (NOT (a) = any(c.completed));`
            );
            maxpg = Math.ceil(Number(result.rows[0].len) / amount);
        } else {
            const result = await db.execute<{ len: string }>(
                sql`SELECT array_length(alid, 1) AS len 
                    FROM watchlists 
                    WHERE watchlistid = ${wlid};`
            );
            maxpg = Math.ceil(Number(result.rows[0].len) / amount);
        }
    } else {
        maxpg = undefined;
    }
    
    let wl: {
        jpname: string;
        enname: string;
        alid: number
    }[];
    
    if (towatch.towatch) {
        if (paginate) {
            const result = await db.execute<{ jpname: string; enname: string; alid: number }>(
                sql`SELECT a.jpname, a.enname, a.alid 
                    FROM watchlists w, completedanime c, anime a, unnest(w.alid) u 
                    WHERE (c.userid = ${towatch.userid}) AND (NOT (u) = any(c.completed)) AND (a.alid in (u)) 
                    OFFSET ${(currentpg - 1) * amount} 
                    LIMIT ${amount};`
            );
            wl = result.rows;
        } else {
            const result = await db.execute<{ jpname: string; enname: string; alid: number }>(
                sql`SELECT a.jpname, a.enname, a.alid 
                    FROM watchlists w, completedanime c, anime a, unnest(w.alid) u 
                    WHERE (c.userid = ${towatch.userid}) AND (NOT (u) = any(c.completed)) AND ((a.alid) in (u))`
            );
            wl = result.rows;
        }
    } else {
        if (paginate) {
            const result = await db.execute<{ jpname: string; enname: string; alid: number }>(
                sql`SELECT a.jpname, a.enname, a.alid 
                    FROM anime a, watchlists w, unnest(w.alid) s 
                    WHERE (a.alid IN (s)) AND (w.watchlistid = ${wlid}) 
                    OFFSET ${(currentpg - 1) * amount} 
                    LIMIT ${amount};`
            );
            wl = result.rows;
        } else {
            const result = await db.execute<{ jpname: string; enname: string; alid: number }>(
                sql`SELECT a.jpname, a.enname, a.alid 
                    FROM anime a, watchlists w, unnest(w.alid) s 
                    WHERE (a.alid IN (s)) AND (w.watchlistid = ${wlid})`
            );
            wl = result.rows;
        }
    }
    if (wl === null) return undefined;
    return { wl, maxpg };
}

export async function renameWatchlist(watchlistid: number, wlname: string) {
    try {
        await db.update(schema.watchlists)
            .set({ watchlist_name: wlname })
            .where(eq(schema.watchlists.watchlistid, watchlistid));
        
        console.log(`POSTGRES: Renaming watchlist - ${watchlistid} -> ${wlname}`);
        return 0;
    } catch (e) {
        console.error(`POSTGRES: renameWatchlist - ${e}`);
        return 1;
    }
}

export async function deleteWatchlist(watchlistid: number) {
    try {
        const res = await db.delete(schema.watchlists)
            .where(eq(schema.watchlists.watchlistid, watchlistid))
            .returning();
        
        console.log(`POSTGRES: Deleting watchlist - ${res[0].watchlistid}`);
        return 0;
    } catch (err) {
        console.error(`POSTGRES: deleteWatchlist - ${err}`);
        return 1;
    }
}

export function getNumber(data: string | string[]): number | number[] {
    try {
        if (Array.isArray(data)) return data.map((o) => parseFloat(o));
        else return parseFloat(data);
    } catch (e) {
        console.error(e);
    }
}

export function getDecimal(data: number | number[]): string | string[] {
    if (Array.isArray(data)) return data.map((o) => o.toString());
    else if (typeof data == "number") return data.toString();
}

/** Adds anime details to anime table if not existing.*/
export async function checkAnimeTable(alid: number, updatedata = false) {
    let pull: {
        alid: number;
        jpname: string;
        status: string;
        next_ep_num: string;
        next_ep_air: number;
    } = null;
    
    if (updatedata === false) {
        const result = await db.select({
            alid: schema.anime.alid,
            status: schema.anime.status,
            jpname: schema.anime.jpname,
            next_ep_air: schema.anime.next_ep_air,
            next_ep_num: schema.anime.next_ep_num
        })
        .from(schema.anime)
        .where(eq(schema.anime.alid, alid));
        
        if (result.length > 0) {
            pull = result[0];
        }
    }
    
    let airing = false;
    if (pull === null) {
        const res = await getAnimeDetails(alid);
        if (res === undefined) {
            return "invalid";
        }
        const release = res.status === "RELEASING";
        let imglink: string = undefined,
            fileid: string = undefined;
        if (updatedata !== true) {
            imglink = await imageGet(res.id);
            fileid = (await bot.api.sendPhoto(-1001869285732, imglink)).photo[0].file_id;
        }
        const obj: schema.NewAnime = {
            alid: res.id,
            jpname: res.title.romaji,
            enname: res.title.english === null ? res.title.romaji : res.title.english,
            optnames: [],
            excludenames: [],
            status: res.status,
            next_ep_num: undefined,
            next_ep_air: undefined,
            last_ep: undefined,
            ep_extras: [],
            imglink: imglink,
            fileid: fileid
        };
        if (release) {
            obj.next_ep_air = res.nextAiringEpisode["airingAt"];
            obj.next_ep_num = getDecimal(res.nextAiringEpisode["episode"]) as string;
        }
        if (obj.status === "RELEASING" || obj.status === "FINISHED") {
            let _: number[] = [];
            if (res.airingSchedule.length != 0) {
                _ = res.airingSchedule.filter((o) => o.timeUntilAiring <= 0).map((o) => o.episode);
            } else if (res.airingSchedule.length == 0 && res.streamingEpisodes.length != 0) {
                _ = res.streamingEpisodes.map((o) => aniep(o.title) as number).sort();
            } else if (
                res.airingSchedule.length == 0 &&
                res.streamingEpisodes.length == 0 &&
                res.episodes != null
            ) {
                _ = Array.from({ length: res.episodes }, (_, i) => i + 1);
            }
            obj.last_ep = Math.max(..._);
            obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as string[];
            if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as string);
        }
        const add = await addAnimeNames(obj);
        if (add == 1) return "err";
        pull = obj as any;
    }
    airing = pull.status === "RELEASING";

    return { pull, airing };
}
