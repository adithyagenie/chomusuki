// spins up everything

import { config } from "dotenv";
import { initMAL } from "./api/mal_api";
import { UpdateHold, botinit, syncresponser } from "./bot/bot";
import { startserver } from "./api/server";
import { initMongo } from "./database/db_connect";

async function spinup() {
    config()
    initMAL()
    const mongoClient = await initMongo()
    //const xdccJS = await xdccInit();
    //const torrclient = new Torrent();

    const authchat = parseInt(process.env.AUTHORISED_CHAT)
    let updater = new UpdateHold(mongoClient);
    await updater.updater()
    const bot = await botinit(updater, authchat)
    const app = startserver()
    app.post('/sync', (req, res) => {
        console.log("Got sync request.")
        res.send("Syncing anime...")
        syncresponser(bot, authchat, updater)
    });
}

spinup()