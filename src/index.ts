// spins up everything

import { config } from "dotenv";
config()
// if (process.env.BOT_TOKEN === undefined || 
//     process.env.ANILIST_TOKEN === undefined ||
//     process.env.AUTHORISED_CHAT === undefined ||
//     process.env.DATABASE_URL === undefined ||
//     process.env.RENDER_EXTERNAL_URL === undefined) {
//         console.log("ENV VARIABLE NOT SET!")
//         process.exit()
// }
import { UpdateHold, botinit, syncresponser, bot } from "./bot/bot";
import { startserver } from "./api/server";
import { initMongo } from "./database/db_connect";
import { createWriteStream } from "fs-extra";
var util = require('util');

var log_file = createWriteStream('./debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d:string) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

async function spinup() {
    config()
    const authchat = parseInt(process.env.AUTHORISED_CHAT)
    const mongoClient = await initMongo()
    let updater = new UpdateHold(mongoClient);
    const app = startserver();
    await botinit(bot, updater, authchat)
    app.post('/sync', (req, res) => {
        if(req.headers.calledby == "manualcall")
            console.log("Got manual sync request.")
        else if(req.headers.calledby == "croncall")
            console.log("Got automatic sync request.")
        else
            return res.sendStatus(401)
        res.send("Syncing anime...")
        syncresponser(bot, authchat, updater)
    });
}

spinup()