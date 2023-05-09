// checks and returns new releases with link/msg
import { anime } from "@prisma/client";
import { axios } from "../src";
import { imageGet } from "../src/api/anilist_api";
import { GetNyaaSearchQueries } from "../src/database/search_query_handler";
import { GetWatchedList, getNumber } from "../src/database/animeDB";
import { writeJson } from "fs-extra";
import { Queue } from "async-await-queue";
import aniep from "aniep";
import { db } from "../src";
import { i_NyaaResponse, i_ProcessedObj } from "../src/interfaces";

export async function CheckUpdatesForUser(userid: number) {
	const myq = new Queue(2, 100);
	console.log("Fetching data...");
	const mainstarttime = new Date().getTime();
	const alidlist = await db.watchinganime.findUnique({
		where: { userid: userid },
		select: { alid: true }
	});
	const [searchqueries, animelist] = await GetNyaaSearchQueries(alidlist.alid);
	const watched = await GetWatchedList(userid, alidlist.alid); // all subscribed alid's ep prog
	const baseurl = `${process.env.NYAA_API_URL}/user/SubsPlease`;
	let urls = [];
	var returnobj: i_ProcessedObj[] = [];
	for (let i = 0; i < searchqueries.length; i++) {
		let url = baseurl + `?q=${searchqueries[i]}`;
		urls.push(url);
	}
	const queue = [];
	for (let i = 0; i < urls.length; i++) {
		//await GetUpdate(urls[i], i, mainstarttime, mongoClient, filelist)
		let wanime = watched.find((o) => o.alid == animelist[i].alid);
		if (wanime == undefined) wanime = { alid: animelist[i].alid, ep: [] };
		queue.push(
			myq.run(() =>
				getNotWatched(
					urls[i],
					i,
					mainstarttime,
					getNumber(wanime.ep) as number[],
					animelist[i]
				).catch((e) => console.error(e))
			)
		);
	}
	returnobj = await Promise.all(queue);
	//console.log(urls)
	console.log("Fetched data.");
	console.log(`Sync took ${new Date().getTime() - mainstarttime} ms`);
	writeJson("./returnobj.json", returnobj, { spaces: "\t" });
	return returnobj;
}

async function getNotWatched(
	url: string,
	querynum: number,
	mainstarttime: number,
	watched: number[],
	animelist: anime
) {
	let starttime = new Date().getTime();
	let returnobj: i_ProcessedObj;
	let shortname: string | undefined;
	if (!(animelist.optnames == null || animelist.optnames.length == 0)) {
		shortname = animelist.optnames.reduce((a, b) => (a.length <= b.length ? a : b)); // returns shortest string in optname
		if (animelist.jpname.length <= shortname.length) {
			shortname = undefined;
		}
	}
	let res: i_NyaaResponse[];
	try {
		var pull = await axios.get<i_NyaaResponse[]>(url);
		if (pull.status != 200) throw new Error(`API unresponsive ${pull.status}`);
		if (pull.data.length == 0) {
			pull = await axios.get<i_NyaaResponse[]>(url.replace("SubsPlease", "Erai-Raws"));
			if (pull.status != 200) throw new Error(`API unresponsive ${pull.status}`);
		}
		if (pull.data.length != 0) res = pull.data;
		else throw new Error("No records found");
	} catch (error) {
		console.error(`Axios Error ${error}`);
		return returnobj;
	}
	res = res.map((o) => {
		let epnum = aniep(o.title) as number;
		o.epnum = epnum;
		return o;
	});
	res = res.sort((a, b) => (a.epnum > b.epnum ? 1 : -1));
	for (let j = 0; j < res.length; j++) {
		res[j].disname = res[j].title
			.slice(0, res[j].title.indexOf("1080p") - 2)
			.replace("[SubsPlease] ", "")
			.replace("[Erai-raws] ", "");
	}
	let notwatchedres = res.filter((o) => !watched.includes(o.epnum));
	let watcheddis: i_ProcessedObj["watched"] = [];
	watched.forEach((o) => {
		let elem = res.find((a) => a.epnum == o);
		watcheddis.push({
			epname: elem.disname,
			epnum: elem.epnum
		});
	}); // pushes all watched epnames to oldanimewatch.
	let alLink = `https://anilist.co/anime/${animelist.alid}`;
	// let textobj = res.map((o) => o.title); // list of all anime titles for dl.

	// let animename = animelist.jpname;
	// let actualnames = textobj.map((x) => x); // also a list of all anime titles for dl.
	// let actualnotwatch = [];

	// for (let j = 0; j < textobj.length; j++) {
	// 	// removing all the checksum shit
	// 	textobj[j] = textobj[j]
	// 		.slice(0, textobj[j].indexOf("1080p") - 2)
	// 		.replace("[SubsPlease] ", "")
	// 		.replace("[Erai-raws] ", "");
	// 	res[j].title = res[j].title.slice(0, res[j].title.indexOf("1080p") - 2);
	// }

	// let newep = [];
	// let old_anime_watch: { epnum: number; epname: string }[] = [];
	// let old_anime_watchlist: string[] = [];
	// for (let j = 0; j < wfile.length; j++) {
	// 	if (wfile[j]["name"] == animename) {
	// 		old_anime_watch = wfile[j]["watched"];
	// 		old_anime_watchlist = old_anime_watch.map(
	// 			({ epnum, epname }) => epname
	// 		);
	// 		break;
	// 	}
	// }

	// for (let k = 0; k < textobj.length; k++) {
	// 	if (!old_anime_watchlist.includes(textobj[k])) {
	// 		//checking if ep in old_anime is there in textobj
	// 		newep.push(textobj[k]);
	// 		actualnotwatch.push(actualnames[k]);
	// 	}
	// }
	if (notwatchedres.length == 0) {
		console.log(`Query ${querynum + 1} took ${new Date().getTime() - starttime} ms`);
		returnobj = {
			alid: animelist.alid,
			anime: animelist.jpname,
			shortname: shortname,
			notwatched: [],
			watched: watcheddis,
			links: [],
			notwatchedepnames: [],
			torrentlink: [],
			imagelink: ""
		};
		return returnobj;
	}
	//if (newep.length > 0)
	// console.log(`Episodes not watched ${newep}`)
	// for (let j = reselem.length - 1; j >= 0; j--) {
	// 	if (
	// 		!newep.includes(
	// 			reselem[j]["elements"][0]["elements"][0]["text"]
	// 				.replace("[SubsPlease] ", "")
	// 				.replace("[Erai-raws] ", "")
	// 		)
	// 	) {
	// 		reselem.splice(j, 1);
	// 	}
	// }

	let downloadlinks = [];
	let viewlinks = [];
	for (let j = 0; j < notwatchedres.length; j++) {
		downloadlinks.push(notwatchedres[j].file);
		viewlinks.push(notwatchedres[j].link);
	}

	// let newepnum: number[] = [];
	// try {
	// 	for (let j = 0; j < newep.length; j++) {
	// 		let epnum = aniep(newep[j]);
	// 		if (epnum !== null && typeof epnum == "number")
	// 			newepnum.push(epnum);
	// 		else throw new Error("ya yeet");
	// 	}
	// } catch {
	// 	newepnum = [];
	// 	newep.reverse();
	// 	console.log(`${animename}, resorting to manual epnum`);
	// 	for (let j = old_anime_watchlist.length + 1; j <= textobj.length; j++)
	// 		newepnum.push(j);
	// }

	// let watchepnum: number[] = [];
	// try {
	// 	for (let j = 0; j < old_anime_watchlist.length; j++) {
	// 		let epnum = aniep(old_anime_watchlist[j]);
	// 		if (epnum !== null && typeof epnum == "number")
	// 			watchepnum.push(epnum);
	// 		else throw new Error("ya yeet");
	// 	}
	// } catch {
	// 	watchepnum = [];
	// 	old_anime_watchlist.reverse();
	// 	console.log(`${animename}, resorting to manual epnum2`);
	// 	for (let j = 1; j <= old_anime_watchlist.length; j++)
	// 		watchepnum.push(j);
	// }

	// let newepnum:number[] = []
	// try {
	//     for (let j = 0; j < newep.length; j ++) {
	//         if (Number.isNaN(parseInt(newep[j].trimEnd().slice(-2))))
	//             throw new Error("ya yeet");
	//         newepnum.push(parseInt(newep[j].trimEnd().slice(-2)))
	//     }
	// } catch {
	//     newepnum = [];
	//     console.log(`${animename}, resorting to manual epnum`)
	//     for (let j = old_anime_watchlist.length + 1; j <= textobj.length; j++)
	//         newepnum.push(j);
	// }
	// let watchepnum:number[] = []
	// try {
	//     for (let j = 0; j < old_anime_watch.length; j ++) {
	//         if (Number.isNaN(parseInt(old_anime_watchlist[j].trimEnd().slice(-2))))
	//             throw new Error("ya yeet");
	//         watchepnum.push(parseInt(old_anime_watchlist[j].trimEnd().slice(-2)))
	//     }
	// } catch {
	//     watchepnum le= [];
	//     console.log(`${animename}, resorting to manual epnum2`)
	//     console.log(old_anime_watch)
	//     for (let j = 1; j <= old_anime_watchlist.length; j++)
	//         watchepnum.push(j);
	// }

	// let newepdis: ResObj["notwatched"] = [];
	// for (let j = 0; j < newep.length; j++) {
	// 	//let newstr = newep[j].replace("[SubsPlease] ", "")
	// 	//newstr = newstr.replace("[Erai-raws] ", "")
	// 	newepdis.push({
	// 		epnum: newepnum[j],
	// 		epname: newep[j],
	// 	});
	// }
	// let watcheddis: ResObj["watched"] = [];
	// for (let j = 0; j < old_anime_watch.length; j++) {
	// 	watcheddis.push({
	// 		epnum: watchepnum[j],
	// 		epname: old_anime_watchlist[j],
	// 	});
	// }

	let newepdis: i_ProcessedObj["notwatched"] = notwatchedres.map((o) => {
		return { epnum: o.epnum, epname: o.disname };
	});

	let imagelink = await imageGet(animelist.alid);

	/*let xdcclinks:SPSearch[] = []
        if (sp) {
            for (let j = 0; j < actualnotwatch.length; j ++) {
                xdcclinks.push(await getxdcc(actualnotwatch[j]))
            }
        }
        console.log(`XDCC query: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER */

	returnobj = {
		alid: animelist.alid,
		anime: animelist.jpname,
		shortname: shortname,
		notwatched: newepdis,
		watched: watcheddis,
		links: viewlinks,
		notwatchedepnames: notwatchedres.map((o) => o.title),
		torrentlink: downloadlinks,
		imagelink: imagelink
	};
	console.log(`Query ${querynum} took ${new Date().getTime() - starttime} ms`);
	return returnobj;
}

//CheckUpdatesForUser(2).then((o) => console.log(JSON.stringify(o)));
