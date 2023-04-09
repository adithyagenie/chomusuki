// spins up everything

require("dotenv").config();
if (
	process.env.BOT_TOKEN === undefined ||
	process.env.ANILIST_TOKEN === undefined ||
	process.env.AUTHORISED_CHAT === undefined ||
	process.env.DATABASE_URL === undefined ||
	process.env.RENDER_EXTERNAL_URL === undefined
) {
	console.log("ENV VARIABLE NOT SET!");
	process.exit();
}
import { UpdateHold, botinit, bot } from "./bot/bot";
import { startserver } from "./api/server";
import { configure, initMongo } from "./database/db_connect";
import { createWriteStream } from "fs-extra";
import { format } from "util";
import { syncresponser } from "./bot/helpers/anime/anime_sync";

var log_file = createWriteStream("./debug.log", { flags: "w" });
var log_stdout = process.stdout;
var log_stderr = process.stderr;

console.log = function (d: any) {
	const time = new Date().toLocaleString("en-IN", {
		timeZone: "Asia/Kolkata",
	});
	log_file.write(`${time}: ${format(d)}\n`);
	log_stdout.write(`${time}: ${format(d)}\n`);
};

console.error = function (d: any) {
	const time = new Date().toLocaleString("en-IN", {
		timeZone: "Asia/Kolkata",
	});
	log_file.write(`${time}: ${format(d)}\n`);
	log_stderr.write(`${time}: ${format(d)}\n`);
};

export const authchat = parseInt(process.env.AUTHORISED_CHAT);
export const mongoClient = initMongo();
export const updater = new UpdateHold(mongoClient);

async function spinup() {
	const options = await configure(mongoClient);
	await updater.updater();
	const app = startserver();
	await botinit(options);
	app.post("/sync", async (req, res) => {
		if (req.headers.calledby == "manualcall") {
			console.log("Got manual sync request.");
			res.status(200).send("Syncing anime...");
			await syncresponser(options, false, undefined);
		} else if (req.headers.calledby == "croncall") {
			console.log("Got automatic sync request.");
			res.status(200).send("Syncing anime...");
			await syncresponser(options, true, undefined);
		} else return res.sendStatus(401);
	});
}

spinup().catch((e) => console.error(e));
