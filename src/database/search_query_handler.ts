// handles search query formation

import { MongoClient } from "mongodb";
import { AnimeNames, getData } from "./db_connect";

export async function GetSearchQueries(client:MongoClient) {
    let searchqueries: string[] = []
    const obj:AnimeNames[] = await getData(client, "AnimeNames")
    for (let i = 0; i < obj.length; i++) {
        let cs = obj[i];
        let name = `"${cs["EnName"]}"|"${cs["JpName"]}"`;
        for (let j = 0; j < cs.OptionalNames.length; j++) {
            name += `|"${cs["OptionalNames"][j]}"`;
        }
        if (cs.ExcludeNames.length != 0) {
            name += " -";
            for (let j = 0; j < cs.ExcludeNames.length; j++) {
                if (j == 0)
                    name += `"${cs["ExcludeNames"][j]}"`;
                else
                    name += `|"${cs["ExcludeNames"][j]}"`;
            }
        }
        let finalsearch = `${name} "[SubsPlease]"|"[Erai-Raws]" 1080p`;
        searchqueries.push(finalsearch)
    }
    let returnobj: [string[], AnimeNames[]] = [searchqueries, obj]
    return returnobj
}

export async function GetWatchedList(client:MongoClient) {
    return await getData(client, "WatchedAnime")
}

module.exports = { GetWatchedList, GetSearchQueries }