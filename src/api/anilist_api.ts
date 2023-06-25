import anilist, { AnimeEntry, MediaFilterTypes, MediaSearchEntry } from "anilist-node";
import { requestCache } from "..";

const al = new anilist(process.env.ANILIST_TOKEN);

export async function imageGet(id: number) {
	let url: string;
	try {
		url = (await al.media.anime(id)).coverImage.large;
	} catch {
		console.log(`ANILIST: Incorrect Anilist ID ${id}`);
		url = "https://upload.wikimedia.org/wikipedia/commons/d/d1/Image_not_available.png";
	}
	return url;
}

// export async function getAlId(enname: string, jpname: string) {
// 	let alid = 0;
// 	try {
// 		const res = await al.searchEntry.anime(enname);
// 		if (res.media[0].title.english == enname || res.media[0].title.romaji == jpname) {
// 			alid = res.media[0].id;
// 		}
// 		return alid;
// 	} catch {
// 		console.log(`ANILIST: Error fetching ${enname}`);
// 		return alid;
// 	}
// }

export async function searchAnime(query: string, pagenum: number, releasingonly = false) {
	try {
		const cached = requestCache.find((o) => o.query == query.toLowerCase() && o.pg == pagenum);
		if (cached !== undefined) {
			if (Math.floor(new Date().getTime() / 1000) - cached.timestamp > 60) {
				console.log(`${cached} cache deleted.`);
				requestCache.splice(requestCache.indexOf(cached), 1);
			} else {
				console.log(`${JSON.stringify(cached)} cached. Returning cache.`);
				return cached.response;
			}
		}
		console.log(`Can't find cache:: ${query}:${pagenum}`);
		let filter: MediaFilterTypes = null;
		if (releasingonly == true) filter = { status_in: ["RELEASING", "NOT_YET_RELEASED"] };
		const res: MediaSearchEntry = await al.searchEntry.anime(query, filter, pagenum, 5);
		if (res.media.length > 0) {
			requestCache.push({
				query: query.toLowerCase(),
				pg: pagenum,
				response: res,
				timestamp: Math.floor(new Date().getTime() / 1000)
			});
			console.log(JSON.stringify(requestCache));
			return res;
		} else return undefined;
	} catch (err) {
		console.log(err);
	}
}

export async function getAnimeDetails(alid: number) {
	let res: AnimeEntry | undefined = undefined;
	try {
		res = await al.media.anime(alid);
	} catch (error) {
		console.error(error);
	}
	return res;
}
