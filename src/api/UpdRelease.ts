// checks and returns new releases with link/msg

import axios, { AxiosResponse } from 'axios';
import { xml2js } from 'xml-js';
import { imageget } from "../api/mal_api";
import { SPSearch, getxdcc } from "../api/subsplease-xdcc";
import { MongoClient } from 'mongodb';
import { GetAnimeList, GetWatchedList, GetSearchQueries } from '../database/dbupdater';
import { writeJson } from "fs-extra";

export interface ResObj {
    anime: string,
    notwatched: {
        epnum: number,
        epname: string
    }[],
    watched: {
        epnum: number,
        epname: string
    }[],
    links: string[],
    xdcclink: SPSearch[],
    torrentlink: string[],
    imagelink: string,
}

export async function CheckUpdates(client:MongoClient) {
    console.log("Fetching data...")
    const searchqueries = await GetSearchQueries(client)
    let filelist = await GetAnimeList(client)
    const baseurl = "https://nyaa.si/?page=rss"
    let urls = []
    var returnobj:ResObj[] = [];
    for (let i = 0; i < searchqueries.length; i++)
    {
        let url = baseurl + `&q=${searchqueries[i]}`
        urls.push(url);
    }
    //console.log(urls)
    const mainstarttime = (new Date()).getTime();
    for (let i = 0; i < urls.length; i ++) {
        let starttime = (new Date()).getTime();
        let url = urls[i]
        let res:AxiosResponse;
        try {
            res = await axios.get<any>(url)
        } catch (error) {
            Promise.reject("AXIOS ERROR:ECONNRESET")
            return returnobj
        }
        
        if (res.status == 200)
        {
            let resobj = xml2js(res.data.toString())
            //console.log(resobj)

            //handling response xml
            let reselem = resobj["elements"][0]["elements"][0]["elements"]
            reselem.splice(0, 4)
            //appendFile("./log.json", JSON.stringify(reselem, null, 4) + "\n")
            let textobj:string[] = []
            for (let j = 0; j < reselem.length; j ++) {
                textobj.push(reselem[j]["elements"][0]["elements"][0]["text"])
            }
            var sp = false
            let animename = urls[i].split("\"")[3]
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
            //console.log(`Episodes: ${reselem.length}`)
            let wfile = await GetWatchedList(client)
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
            
            for (let k = 0; k < textobj.length; k++) {
                if (!(old_anime_watchlist.includes(textobj[k]))) { //checking if ep in old_anime is there in textobj
                    newep.push(textobj[k])
                    actualnotwatch.push(actualnames[k])
                }
            }
            if (newep.length == 0) {
                console.log(`Query ${i + 1} took ${(new Date()).getTime() - starttime} ms`)
                returnobj.push({
                    anime: animename,
                    notwatched: [],
                    watched: old_anime_watch.reverse(),
                    links: [],
                    xdcclink: [],
                    torrentlink: [],
                    imagelink: ""
                })
                continue
            }
                    //if (newep.length > 0)
                        // console.log(`Episodes not watched ${newep}`)
            for (let j = reselem.length - 1; j >= 0; j--) {
                if (!(newep.includes(reselem[j]["elements"][0]["elements"][0]["text"].replace("[SubsPlease] ", "").replace("[Erai-raws] ", "")))) {
                    reselem.splice(j, 1)
                }
            }
            let downloadlinks = []; 
            let viewlinks = []; 
            for (let j = 0; j < reselem.length; j++) {
                downloadlinks.push(reselem[j]["elements"][1]["elements"][0]["text"])
                viewlinks.push(reselem[j]["elements"][2]["elements"][0]["text"])
            }
            // console.log(downloadlinks);
            // console.log(viewlinks);
            //dbupdate the downloadlinks
            let newepnum:number[] = []
            try {
                for (let j = 0; j < newep.length; j ++) {
                    if (Number.isNaN(parseInt(newep[j].trimEnd().slice(-2))))
                        throw new Error("ya yeet");
                    newepnum.push(parseInt(newep[j].trimEnd().slice(-2)))
                }
            } catch {
                newepnum = [];
                console.log(`${animename}, resorting to manual epnum`)
                for (let j = old_anime_watchlist.length + 1; j <= textobj.length; j++) 
                    newepnum.push(j);
            }
            let watchepnum:number[] = []
            try {
                for (let j = 0; j < old_anime_watch.length; j ++) {
                    if (Number.isNaN(parseInt(old_anime_watchlist[j].trimEnd().slice(-2))))
                        throw new Error("ya yeet");
                    watchepnum.push(parseInt(old_anime_watchlist[j].trimEnd().slice(-2)))
                }
            } catch {
                watchepnum = [];
                console.log(`${animename}, resorting to manual epnum2`)
                console.log(old_anime_watch)
                for (let j = 1; j <= old_anime_watchlist.length; j++) 
                    watchepnum.push(j);
            }
            
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
            
            let malid:number;
            for (let j = 0; j < filelist.length; j ++) {
                if (filelist[j]["JpName"] == animename) {
                    malid = parseInt(filelist[j]["MalId"])
                }
            }
            let xdcclinks:SPSearch[] = []
            if (sp) {
                for (let j = 0; j < actualnotwatch.length; j ++) {
                    xdcclinks.push(await getxdcc(actualnotwatch[j]))
                }
            }
            
            
            let imagelink = await imageget(malid)
            returnobj.push({
                anime: animename,
                notwatched: newepdis.sort((a, b) => (a.epnum > b.epnum) ? 1: -1),
                watched: watcheddis.sort((a, b) => (a.epnum > b.epnum) ? 1: -1),
                links: viewlinks.reverse(),
                xdcclink: xdcclinks.reverse(),
                torrentlink: downloadlinks.reverse(),
                imagelink: imagelink
            })
            
            //downloadlinks = ["https://webtorrent.io/torrents/sintel.torrent", "https://webtorrent.io/torrents/big-buck-bunny.torrent"]
            //for (let j = 0; j < downloadlinks.length; j ++) {
            //    downloader.startdl(torrent, downloadlinks[j])
            //}
            
        }
        
        else
            throw "Axios fail"
        console.log(`Query ${i + 1} took ${(new Date()).getTime() - starttime} ms`)
    }
    console.log("Fetched data.")
    console.log(`Sync took ${(new Date()).getTime() - mainstarttime} ms`)
    writeJson("./returnobj.json", returnobj,{spaces:"\t"})
    return returnobj
}

module.exports = { CheckUpdates }