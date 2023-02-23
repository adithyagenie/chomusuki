// handles all mongo db updates

import { MongoClient } from "mongodb";
import { getData } from "./db_connect";

const fs = require('fs-extra')

export async function GetAnimeList(client:MongoClient) {
    const obj:any = await getData(client, "AnimeNames")
    return obj
}

export async function GetSearchQueries(client:MongoClient) {
    let searchqueries = []
    //return fs.readJson("./AnimeNames.json")
    const obj:any = await getData(client, "AnimeNames")
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
    return searchqueries
}

export async function GetWatchedList(client:MongoClient) {
    return await getData(client, "WatchedAnime")
}

module.exports = { GetAnimeList, GetWatchedList, GetSearchQueries }