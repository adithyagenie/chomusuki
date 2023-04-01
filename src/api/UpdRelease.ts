// checks and returns new releases with link/msg

import axios, { AxiosResponse } from 'axios';
import { xml2js } from 'xml-js';
import { imageget } from "./anilist_api";
import { MongoClient } from 'mongodb';
import { GetWatchedList, GetSearchQueries } from '../database/search_query_handler';
import { appendFile, writeJson } from "fs-extra";
import { Queue } from 'async-await-queue';
import { AnimeNames } from '../database/db_connect';
import aniep from 'aniep';

export interface ResObj {
    anime: string,
    shortname: string | undefined,
    notwatched: {
        epnum: number,
        epname: string
    }[],
    watched: {
        epnum: number,
        epname: string
    }[],
    links: string[],
    notwatchedepnames: string[],
    torrentlink: string[],
    imagelink: string,
}

export async function CheckUpdates(client:MongoClient) {
    const myq = new Queue(2, 100);
    console.log("Fetching data...")
    const mainstarttime = (new Date()).getTime();
    const [searchqueries, filelist] = await GetSearchQueries(client);
    console.log(`Mongo Initial query ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
    const wfile = await GetWatchedList(client)
    console.log(`Mongo Query2: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
    const baseurl = "https://nyaa.si/?page=rss"
    let urls = []
    var returnobj:ResObj[] = [];
    for (let i = 0; i < searchqueries.length; i++)
    {
        let url = baseurl + `&q=${searchqueries[i]}`
        urls.push(url);
    }
    const queue = [];
    for (let i = 0; i < urls.length; i ++) {
        //await GetUpdate(urls[i], i, mainstarttime, client, filelist)
        queue.push(myq.run(() => 
            GetUpdate(urls[i], i, mainstarttime, wfile, filelist[i])
            .catch((e) => console.error(e)))
        );
    }
    returnobj = await Promise.all(queue);
    //console.log(urls)
    console.log("Fetched data.")
    console.log(`Sync took ${(new Date()).getTime() - mainstarttime} ms`)
    writeJson("./returnobj.json", returnobj,{spaces:"\t"})
    return returnobj
}

async function GetUpdate(url: string, querynum: number, mainstarttime: number, wfile: any[], filelist: AnimeNames) {
    let starttime = (new Date()).getTime();
    let returnobj:ResObj;
    let shortname: string | undefined;
    if (filelist.OptionalNames.length > 0) {
        shortname = filelist.OptionalNames.reduce((a, b) => a.length <= b.length ? a : b)
        if (filelist.JpName.length <= shortname.length) {
            shortname = undefined
        }
    }
    let res:AxiosResponse;
    try {
        res = await axios.get<any>(url)
    } catch (error) {
        Promise.reject("AXIOS ERROR:ECONNRESET")
        return returnobj
    }
    console.log(`Query: ${querynum} - Axios Query: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
    if (res.status == 200)
    {
        let resobj = xml2js(res.data.toString())
        console.log(`Query: ${querynum} - XML2js: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        //handling response xml
        let reselem = resobj["elements"][0]["elements"][0]["elements"]
        reselem.splice(0, 4)
        appendFile("./log.json", JSON.stringify(reselem, null, 4) + "\n")
        appendFile("./biglog.json", JSON.stringify(resobj, null, 4) + "\n")
        let textobj:string[] = []
        for (let j = 0; j < reselem.length; j ++) {
            textobj.push(reselem[j]["elements"][0]["elements"][0]["text"])
        }
        console.log(`Query: ${querynum} - Textobj pushed: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        var sp = false
        let animename = url.split("\"")[3]
        for (let j = 0; j < textobj.length; j ++) {
            if (textobj[j].includes("SubsPlease")) {
                //console.log(`\nSubsPlease print available for ${animename}`)
                sp = true
                break
            }
        }
        let actualnames = textobj.map((x) => x);
        let actualnotwatch = []
        for (let j = 0; j < textobj.length; j ++) {
            textobj[j] = textobj[j].slice(0, textobj[j].indexOf("1080p") - 2).replace("[SubsPlease] ", "").replace("[Erai-raws] ", "");
            reselem[j]["elements"][0]["elements"][0]["text"] = reselem[j]["elements"][0]["elements"][0]["text"].slice(0, reselem[j]["elements"][0]["elements"][0]["text"].indexOf("1080p") - 2);
        }
        console.log(`Query: ${querynum} - Removal of subsplease and erai raws: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        //if (!sp) 
        //    console.log(`\nNo SubsPlease print for ${animename}`)
        //else {
        if (sp) {
            for (let j = reselem.length - 1; j >= 0; j--) {
                if (!(reselem[j]["elements"][0]["elements"][0]["text"].includes("SubsPlease"))) {
                    reselem.splice(j, 1)
                    textobj.splice(j, 1)
                    actualnames.splice(j, 1)
                }
            }
        }
        //check for verified only
        for (let j = reselem.length - 1; j >= 0; j--) {
            if (reselem[j]["elements"][12]["name"] == "nyaa:trusted") {
                if (reselem[j]["elements"][12]["elements"][0]["text"] == "No") {
                    reselem.splice(j, 1)
                    textobj.splice(j, 1)
                    actualnames.splice(j, 1)
                }
            }
        }
        console.log(`Query: ${querynum} - Removal of erai-raws if sp present and non-verified shit: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        //console.log(`Episodes: ${reselem.length}`)

        let newep = []
        let old_anime_watch:{epnum:number, epname:string}[] = []
        let old_anime_watchlist:string[] = [];
        for (let j = 0; j < wfile.length; j ++) {
            if (wfile[j]["name"] == animename) {
                old_anime_watch = (wfile[j]["watched"])
                old_anime_watchlist = old_anime_watch.map(({ epnum, epname }) => (epname))
                break
            }
        }
        console.log(`Query: ${querynum} - Removal of already watched shit: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        
        for (let k = 0; k < textobj.length; k++) {
            if (!(old_anime_watchlist.includes(textobj[k]))) { //checking if ep in old_anime is there in textobj
                newep.push(textobj[k])
                actualnotwatch.push(actualnames[k])
            }
        }
        if (newep.length == 0) {
            console.log(`Query ${querynum + 1} took ${(new Date()).getTime() - starttime} ms`)
            returnobj = {
                anime: animename,
                shortname: shortname,
                notwatched: [],
                watched: old_anime_watch.reverse(),
                links: [],
                notwatchedepnames: [],
                torrentlink: [],
                imagelink: ""
            }
            return returnobj
        }
                //if (newep.length > 0)
                    // console.log(`Episodes not watched ${newep}`)
        for (let j = reselem.length - 1; j >= 0; j--) {
            if (!(newep.includes(reselem[j]["elements"][0]["elements"][0]["text"].replace("[SubsPlease] ", "").replace("[Erai-raws] ", "")))) {
                reselem.splice(j, 1)
            }
        }
        console.log(`Query: ${querynum} - Random for loop label: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        let downloadlinks = []; 
        let viewlinks = []; 
        for (let j = 0; j < reselem.length; j++) {
            downloadlinks.push(reselem[j]["elements"][1]["elements"][0]["text"])
            viewlinks.push(reselem[j]["elements"][2]["elements"][0]["text"])
        }
        
        let newepnum:number[] = [];
        try {
            for (let j = 0; j < newep.length; j ++) {
                let epnum = aniep(newep[j])
                if (epnum !== null && typeof(epnum) == 'number')
                    newepnum.push(epnum)
                else 
                    throw new Error("ya yeet")
            } 
        } catch {
            newepnum = [];
            newep.reverse()
            console.log(`${animename}, resorting to manual epnum`)
            for (let j = old_anime_watchlist.length + 1; j <= textobj.length; j++) 
                newepnum.push(j);
        }
        
        let watchepnum:number[] = [];
        try {
            for (let j = 0; j < old_anime_watchlist.length; j ++) {
                let epnum = aniep(old_anime_watchlist[j])
                if (epnum !== null && typeof(epnum) == 'number')
                    watchepnum.push(epnum)
                else 
                    throw new Error("ya yeet")
            } 
        } catch {
            watchepnum = [];
            old_anime_watchlist.reverse()
            console.log(`${animename}, resorting to manual epnum2`)
            for (let j = 1; j <= old_anime_watchlist.length; j++) 
                watchepnum.push(j);
        }


        
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
        console.log(`Query: ${querynum} - Episode numbers: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        
        let newepdis:ResObj["notwatched"] = []
        for (let j = 0; j < newep.length; j ++) {
            //let newstr = newep[j].replace("[SubsPlease] ", "")
            //newstr = newstr.replace("[Erai-raws] ", "")
            newepdis.push({
                "epnum": newepnum[j],
                "epname": newep[j]
            })
        }
        let watcheddis:ResObj["watched"] = [];
        for (let j = 0; j < old_anime_watch.length; j ++) {
            watcheddis.push({
                epnum: watchepnum[j],
                epname: old_anime_watchlist[j]
            })
        }
        
        let AlId = filelist["AlID"]
        let imagelink = await imageget(AlId)
        console.log(`Query: ${querynum} - Pushed all shit: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER
        
        /*let xdcclinks:SPSearch[] = []
        if (sp) {
            for (let j = 0; j < actualnotwatch.length; j ++) {
                xdcclinks.push(await getxdcc(actualnotwatch[j]))
            }
        }
        console.log(`XDCC query: ${(new Date()).getTime() - mainstarttime} ms`) // TIME LOGGER */
        
        returnobj = {
            anime: animename,
            shortname: shortname,
            notwatched: newepdis.sort((a, b) => (a.epnum > b.epnum) ? 1: -1),
            watched: watcheddis.sort((a, b) => (a.epnum > b.epnum) ? 1: -1),
            links: viewlinks.reverse(),
            notwatchedepnames: actualnotwatch.reverse(),
            torrentlink: downloadlinks.reverse(),
            imagelink: imagelink
        }
        console.log(`Query ${querynum} took ${(new Date()).getTime() - starttime} ms`)
        return returnobj
    }
    
    else
        throw "Axios fail"
}


module.exports = { CheckUpdates }