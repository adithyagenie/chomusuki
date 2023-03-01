// spins up everything

import { config } from "dotenv";
import { UpdateHold, botinit, syncresponser } from "./bot/bot";
import { startserver } from "./api/server";
import { initMongo } from "./database/db_connect";

async function spinup() {
    config()
    const mongoClient = await initMongo()
    const authchat = parseInt(process.env.AUTHORISED_CHAT)
    let updater = new UpdateHold(mongoClient);
    const bot = await botinit(updater, authchat)
    const app = startserver()
    app.post('/sync', (req, res) => {
        console.log("Got sync request.")
        res.send("Syncing anime...")
        syncresponser(bot, authchat, updater)
    });
}

spinup()
