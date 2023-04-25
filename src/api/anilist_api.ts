import anilist, { MediaSearchEntry } from "anilist-node";
import { Queue } from "async-await-queue";

const al = new anilist(process.env.ANILIST_TOKEN);

export async function imageget(id: number) {
	let url = "";
	try {
		url = (await al.media.anime(id)).coverImage.large;
	} catch {
		console.log(`ANILIST: Incorrect Anilist ID ${id}`);
		url =
			"https://upload.wikimedia.org/wikipedia/commons/d/d1/Image_not_available.png";
	}
	return url;
}

export async function getAlId(enname: string, jpname: string) {
	var alid = 0;
	try {
		const res = await al.searchEntry.anime(enname);
		if (
			res.media[0].title.english == enname ||
			res.media[0].title.romaji == jpname
		) {
			alid = res.media[0].id;
		}
		return alid;
	} catch {
		console.log(`ANILIST: Error fetching ${enname}`);
		return alid;
	}
}

export async function searchAnime(query: string, pagenum: number) {
	try {
		let res: MediaSearchEntry = await al.searchEntry.anime(
			query,
			null,
			pagenum
		);
		if (res.media.length > 0) return res;
		else return undefined;
	} catch (err) {
		console.log(err);
	}
}
