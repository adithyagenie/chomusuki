import { config } from "dotenv";

const taki = require("taki")

export async function imageget(id:number) { // where '27989' represents the anime Hibike! Euphonium
    const anime = await taki.getInfoFromId(id);
    return anime.main_picture.large
};

export async function initMAL() {   
    config()
    const CLIENT_KEY = process.env.MAL_CLIENT_KEY;
    taki.setClientKey(CLIENT_KEY);
} 

export async function getMalId(name:string) {
    const anime = await taki.getInfoFromName(name);
    return anime.node.id;
};

module.exports = { imageget, initMAL, getMalId }