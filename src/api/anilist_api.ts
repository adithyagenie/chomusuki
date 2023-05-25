import anilist, { AnimeEntry, MediaFilterTypes, MediaSearchEntry } from "anilist-node";

const al = new anilist(process.env.ANILIST_TOKEN);

export async function imageGet(id: number) {
	let url = "";
	try {
		url = (await al.media.anime(id)).coverImage.large;
	} catch {
		console.log(`ANILIST: Incorrect Anilist ID ${id}`);
		url = "https://upload.wikimedia.org/wikipedia/commons/d/d1/Image_not_available.png";
	}
	return url;
}

export async function getAlId(enname: string, jpname: string) {
	var alid = 0;
	try {
		const res = await al.searchEntry.anime(enname);
		if (res.media[0].title.english == enname || res.media[0].title.romaji == jpname) {
			alid = res.media[0].id;
		}
		return alid;
	} catch {
		console.log(`ANILIST: Error fetching ${enname}`);
		return alid;
	}
}

export async function searchAnime(query: string, pagenum: number, releasingonly: boolean = false) {
	try {
		let filter: MediaFilterTypes = null;
		if (releasingonly == true) filter = { status_in: ["RELEASING", "NOT_YET_RELEASED"] };
		let res: MediaSearchEntry = await al.searchEntry.anime(query, filter, pagenum, 5);
		if (res.media.length > 0) return res;
		else return undefined;
	} catch (err) {
		console.log(err);
	}
}

export async function getAnimeDetails(alid: number) {
	var res: AnimeEntry | undefined = undefined;
	try {
		res = await al.media.anime(alid);
	} catch (error) {
		console.error(error);
	}
	return res;
}
