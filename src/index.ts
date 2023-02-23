// spins up everything

import { config } from "dotenv";
config()
if (process.env.BOT_TOKEN === undefined || 
    process.env.MAL_CLIENT_KEY === undefined ||
    process.env.AUTHORISED_CHAT === undefined ||
    process.env.DATABASE_URL === undefined ||
    process.env.RENDER_EXTERNAL_URL === undefined) {
        console.log("ENV VARIABLE NOT SET!")
        process.exit()
    }
import { initMAL } from "./api/mal_api";
import { UpdateHold, botinit, syncresponser, bot } from "./bot/bot";
import { startserver } from "./api/server";
import { initMongo } from "./database/db_connect";

async function spinup() {
    initMAL()
    const mongoClient = await initMongo()
    //const xdccJS = await xdccInit();
    //const torrclient = new Torrent();

    const authchat = parseInt(process.env.AUTHORISED_CHAT)
    let updater = new UpdateHold(mongoClient);
    const app = startserver()
    await updater.updater()
    await botinit(bot, updater, authchat, app)
    app.post('/sync', (req, res) => {
        console.log("Got sync request.")
        res.send("Syncing anime...")
        syncresponser(bot, authchat, updater)
    });
}

spinup()