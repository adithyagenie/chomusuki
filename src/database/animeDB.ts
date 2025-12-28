import { db } from '..';
import * as Prisma from '@prisma/client';
import * as types from '../interfaces';
import aniep from 'aniep';
import { getAnimeDetails, imageGet } from '../api/anilist_api';
import { bot } from '../bot/bot';

export async function addAnimeNames(obj: Prisma.anime) {
  try {
    const insertres = await db.anime.upsert({
      where: { alid: obj.alid },
      update: obj,
      create: obj,
    });
    await db.airingupdates.upsert({
      where: { alid: obj.alid },
      update: {
        alid: undefined,
        userid: undefined,
      },
      create: {
        alid: obj.alid,
        userid: [],
      },
    });
    console.log(`POSTGRES: Add anime - Documents inserted: ${insertres.alid}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: addAnimeNames - ${err}`);
    return 1;
  }
}

export async function markWatchedunWatched(obj: Prisma.watchedepanime) {
  try {
    const res = await db.watchedepanime.upsert({
      where: {
        userid_alid: {
          userid: obj.userid,
          alid: obj.alid,
        },
      },
      create: obj,
      update: obj,
    });
    console.log(
      `POSTGRES: Mark watched/unwatched - Documents upserted: ${res.userid}: ${res.alid}`,
    );
    return 0;
  } catch (err) {
    console.error(`POSTGRES: markWatchedunWatched - ${err}`);
    return 1;
  }
}

export async function addWatching(userid: number, alid: number) {
  try {
    const add = await db.watchinganime.update({
      where: { userid: userid },
      data: { alid: { push: alid } },
    });
    await db.watchedepanime.create({
      data: { userid: userid, alid: alid, ep: [] },
    });
    console.log(
      `POSTGRES: Add subscription - Documents updated: ${add.userid}: ${alid}`,
    );
  } catch (err) {
    console.error(`POSTGRES: addWatching - ${err}`);
  }
}

/**Takes user id and list of alid as parameter and returns the ep status of them for the user */
export async function GetWatchedList(userid: number, alidlist: number[]) {
  return db.watchedepanime.findMany({
    where: { userid: userid, alid: { in: alidlist } },
    select: { alid: true, ep: true },
  });
}

export async function getUserWatchingAiring(
  table: 'watchinganime' | 'airingupdates',
  userid: number,
  count?: number,
  offset?: number,
) {
  try {
    let alidlist: number[] = [];
    let amount: number;
    if (table == 'airingupdates') {
      amount = await db.airingupdates.count({
        where: { userid: { has: userid } },
      });
      console.log(amount);
      if (amount == 0) return { alidlist: [], animelist: [], amount: 0 };
      const _ = await db.airingupdates.findMany({
        where: { userid: { has: userid } },
        select: { alid: true },
        take: count,
        skip: offset,
      });
      alidlist = _.map((o) => o.alid);
    } else {
      const _ = await db.watchinganime.findUnique({
        where: { userid },
        select: { alid: true },
      });
      if (_ === null) return { alidlist: [], animelist: [], amount: 0 };
      else alidlist = _.alid;
      amount = alidlist.length;
      if (count !== undefined && offset !== undefined)
        alidlist = alidlist.slice(offset - 1, count + offset - 1);
    }
    const tosort = await db.anime.findMany({
      where: { alid: { in: alidlist } },
      select: { jpname: true, alid: true },
    });
    tosort.sort((a, b) =>
      alidlist.indexOf(a.alid) > alidlist.indexOf(b.alid) ? 1 : -1,
    );
    const animelist = tosort.map((o) => o.jpname);
    if (alidlist.length !== animelist.length) {
      console.error(
        `POSTGRES: get_Watching_Airing - "Unequal fetch for anime: alid"`,
      );
      return undefined;
    }

    console.log(`${alidlist}:: ${animelist}`);
    return { alidlist, animelist, amount };
  } catch (err) {
    console.error(`POSTGRES: get_Watching_Airing - ${err}`);
    return undefined;
  }
}

// export async function removeWatching(obj: Prisma.watchinganime) {
//     try {
//         const del = await db.watchinganime.update({
//             where: { userid: obj.userid },
//             data: obj
//         });
//         console.log(`POSTGRES: Unsubscribed anime - Deletion success: ${del.userid}`);
//         return 0;
//     } catch (err) {
//         console.error(`POSTGRES: removeWatching - ${err}`);
//     }
// }

export async function addAiringFollow(alid: number, userid: number) {
  try {
    await db.airingupdates.update({
      where: { alid },
      data: { userid: { push: userid } },
    });
    return 0;
  } catch (err) {
    console.error(`POSTGRES: addAiringFollow - ${err}`);
    return 1;
  }
}

export async function newDL(obj: types.i_DlSync) {
  try {
    const res = await db.syncupd.create({
      data: obj,
    });
    console.log(`POSTGRES: New download queued - Documents inserted: ${res}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: DlSync - ${err}`);
  }
}

export async function changeConfig(newconfig: Prisma.config) {
  try {
    const res = await db.config.update({
      where: { userid: newconfig.userid },
      data: newconfig,
    });
    console.log(`POSTGRES: UPDATE CONFIG: ${res.userid}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: changeConfig - ${err}`);
  }
}

export async function newWatchlist(
  watchlist_name: string,
  generated_by: number,
) {
  try {
    const res = await db.watchlists.create({
      data: {
        watchlist_name,
        generated_by,
      },
    });
    console.log(`POSTGRES: Watchlist created - ${res.watchlist_name}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: newWatchlist - ${err}`);
    return 1;
  }
}

export async function addToWatchlist(watchlistid: number, addAlID: number) {
  try {
    const anime = await checkAnimeTable(addAlID);
    if (anime == 'err') {
      console.error(
        `POSTGRES: addToWatchList - Unable to find anime ${addAlID}`,
      );
      return 'err';
    }
    if (anime == 'invalid') return 'invalid';
    const is_present =
      (
        await db.watchlists.findUniqueOrThrow({
          where: { watchlistid },
          select: { alid: true },
        })
      ).alid.filter((o) => o === addAlID).length > 0;
    if (is_present === true) return 'present';
    const res = await db.watchlists.update({
      where: {
        watchlistid: watchlistid,
      },
      data: {
        alid: { push: addAlID },
      },
    });
    console.log(`POSTGRES: Watchlist item added - ${res.watchlistid}`);
    return anime.pull.jpname;
  } catch (err) {
    console.error(`POSTGRES: addToWatchList - ${err}`);
    return 'err';
  }
}

export async function markDone(userid: number, AlID: number) {
  try {
    const res = await db.completedanime.update({
      where: { userid },
      data: { completed: { push: AlID } },
    });
    console.log(`POSTGRES: Marking anime as done - ${res.userid}:${AlID}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: markDone - ${err}`);
  }
}

export async function markNotDone(userid: number, AlID: number) {
  try {
    const completed = (
      await db.completedanime.findUniqueOrThrow({
        where: { userid: userid },
        select: { completed: true },
      })
    ).completed;
    const i = completed.indexOf(AlID);
    if (i === -1) return 'missing';
    completed.splice(i, 1);
    await db.completedanime.update({ where: { userid }, data: { completed } });
    console.log(`POSTGRES: Marking anime as done - ${userid}:${AlID}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: markDone - ${err}`);
    return 1;
  }
}

export async function removeFromWatchlist(watchlistid: number, AlID: number) {
  try {
    const old = await db.watchlists.findUnique({
      where: { watchlistid: watchlistid },
    });
    if (old === null) return 'wlmissing';
    const index = old.alid.indexOf(AlID);
    if (index == -1) return 'alidmissing';
    old.alid.splice(index, 1);
    const res = await db.watchlists.update({
      where: {
        watchlistid: watchlistid,
      },
      data: {
        alid: old.alid,
      },
    });
    console.log(
      `POSTGRES: Removing anime from watchlist - ${res.watchlistid}:${AlID}`,
    );
    return 0;
  } catch (err) {
    console.error(`POSTGRES: markDoneWatchlist - ${err}`);
    return 1;
  }
}

// export async function getUserWatchlists(userid: number) {
// 	const wl = await db.watchlists.findMany({
// 		where: { generated_by: userid },
// 		select: { watchlist_name: true, watchlistid: true, alid: true }
// 	});
// 	if (wl === null) return { wl: null, wllist: null };
// 	return { wl: wl, wllist: wl.map((o) => o.watchlist_name) };
// }

export async function getWatchlistAnime(
  wlid: number,
  currentpg?: number,
  amount?: number,
  paginate = true,
  needmaxpg = true,
  towatch = { towatch: false, userid: undefined },
) {
  let maxpg: number;
  if (needmaxpg === true)
    if (towatch.towatch === true)
      maxpg = Math.ceil(
        Number(
          (
            await db.$queryRaw<
              {
                len: bigint;
              }[]
            >`SELECT count(a) as len\
                    FROM watchlists w, completedanime c, unnest(w.alid) a \
                    WHERE (c.userid = ${towatch.userid}) and (NOT (a) = any(c.completed));`
          )[0].len,
        ) / amount,
      );
    else
      maxpg = Math.ceil(
        Number(
          (
            await db.$queryRaw<
              {
                len: bigint;
              }[]
            >`SELECT array_length(alid, 1) AS len \
                    FROM watchlists \
                    WHERE watchlistid = ${wlid};`
          )[0].len,
        ) / amount,
      );
  else maxpg = undefined;
  let wl: {
    jpname: string;
    enname: string;
    alid: number;
  }[];
  if (towatch.towatch) {
    if (paginate)
      wl = await db.$queryRaw`SELECT a.jpname, a.enname, a.alid \
                                    FROM watchlists w, completedanime c, anime a, unnest(w.alid) u \
                                    WHERE (c.userid = ${towatch.userid}) AND (NOT (u) = any(c.completed)) AND (a.alid in (u)) \
                                    OFFSET ${(currentpg - 1) * amount} \
                                    LIMIT ${amount};`;
    else
      wl = await db.$queryRaw`SELECT a.jpname, a.enname, a.alid \
                                    FROM watchlists w, completedanime c, anime a, unnest(w.alid) u \
                                    WHERE (c.userid = ${towatch.userid}) AND (NOT (u) = any(c.completed)) AND ((a.alid) in (u))`;
  } else {
    if (paginate)
      wl = await db.$queryRaw`SELECT a.jpname, a.enname, a.alid \
                                    FROM anime a, watchlists w, unnest(w.alid) s \
                                    WHERE (a.alid IN (s)) AND (w.watchlistid = ${wlid}) \
                                    OFFSET ${(currentpg - 1) * amount} \
                                    LIMIT ${amount};`;
    else
      wl = await db.$queryRaw`SELECT a.jpname, a.enname, a.alid \
                                    FROM anime a, watchlists w, unnest(w.alid) s \
                                    WHERE (a.alid IN (s)) AND (w.watchlistid = ${wlid})`;
  }
  if (wl === null) return undefined;
  return { wl, maxpg };
}

export async function renameWatchlist(watchlistid: number, wlname: string) {
  try {
    await db.watchlists.update({
      where: { watchlistid },
      data: { watchlist_name: wlname },
    });
    console.log(`POSTGRES: Renaming watchlist - ${watchlistid} -> ${wlname}`);
    return 0;
  } catch (e) {
    console.error(`POSTGRES: renameWatchlist - ${e}`);
    return 1;
  }
}

export async function deleteWatchlist(watchlistid: number) {
  try {
    const res = await db.watchlists.delete({
      where: {
        watchlistid: watchlistid,
      },
    });
    console.log(`POSTGRES: Deleting watchlist - ${res.watchlistid}`);
    return 0;
  } catch (err) {
    console.error(`POSTGRES: deleteWatchlist - ${err}`);
    return 1;
  }
}

export function getNumber(
  data: Prisma.Prisma.Decimal | Prisma.Prisma.Decimal[],
): number | number[] {
  try {
    if (Array.isArray(data))
      return data.map((o) => new Prisma.Prisma.Decimal(o).toNumber());
    else if (data instanceof Prisma.Prisma.Decimal)
      return new Prisma.Prisma.Decimal(data).toNumber();
  } catch (e) {
    console.error(e);
  }
}

export function getDecimal(
  data: number | number[],
): Prisma.Prisma.Decimal | Prisma.Prisma.Decimal[] {
  if (Array.isArray(data)) return data.map((o) => new Prisma.Prisma.Decimal(o));
  else if (typeof data == 'number') return new Prisma.Prisma.Decimal(data);
}

/** Adds anime details to anime table if not existing.*/
export async function checkAnimeTable(alid: number, updatedata = false) {
  let pull: {
    alid: number;
    jpname: string;
    status: string;
    next_ep_num: Prisma.Prisma.Decimal;
    next_ep_air: number;
  } = null;
  if (updatedata === false)
    pull = await db.anime.findUnique({
      where: { alid },
      select: {
        alid: true,
        status: true,
        jpname: true,
        next_ep_air: true,
        next_ep_num: true,
      },
    });
  let airing = false;
  if (pull === null) {
    const res = await getAnimeDetails(alid);
    if (res === undefined) {
      return 'invalid';
    }
    const release = res.status === 'RELEASING';
    let imglink: string = undefined,
      fileid: string = undefined;
    if (updatedata !== true) {
      imglink = await imageGet(res.id);
      fileid = (await bot.api.sendPhoto(-1001869285732, imglink)).photo[0]
        .file_id;
    }
    const obj: Prisma.anime = {
      alid: res.id,
      jpname: res.title.romaji,
      enname: res.title.english === null ? res.title.romaji : res.title.english,
      optnames: undefined,
      excludenames: undefined,
      status: res.status,
      next_ep_num: undefined,
      next_ep_air: undefined,
      last_ep: undefined,
      ep_extras: undefined,
      imglink: imglink,
      fileid: fileid,
    };
    if (release) {
      obj.next_ep_air = res.nextAiringEpisode['airingAt'];
      obj.next_ep_num = getDecimal(
        res.nextAiringEpisode['episode'],
      ) as Prisma.Prisma.Decimal;
    }
    if (obj.status === 'RELEASING' || obj.status === 'FINISHED') {
      let _: number[] = [];
      if (res.airingSchedule.length != 0) {
        _ = res.airingSchedule
          .filter((o) => o.timeUntilAiring <= 0)
          .map((o) => o.episode);
      } else if (
        res.airingSchedule.length == 0 &&
        res.streamingEpisodes.length != 0
      ) {
        _ = res.streamingEpisodes.map((o) => aniep(o.title) as number).sort();
      } else if (
        res.airingSchedule.length == 0 &&
        res.streamingEpisodes.length == 0 &&
        res.episodes != null
      ) {
        _ = Array.from({ length: res.episodes }, (_, i) => i + 1);
      }
      obj.last_ep = Math.max(..._);
      obj.ep_extras = getDecimal(
        _.filter((o) => o % 1 !== 0),
      ) as Prisma.Prisma.Decimal[];
      if (_.includes(0))
        obj.ep_extras.push(getDecimal(0) as Prisma.Prisma.Decimal);
    }
    const add = await addAnimeNames(obj);
    if (add == 1) return 'err';
    pull = obj;
  }
  airing = pull.status === 'RELEASING';

  return { pull, airing };
}
