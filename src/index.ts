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
import { UpdateHold, botinit, syncresponser, bot } from "./bot/bot";
import { startserver } from "./api/server";
import { configure, initMongo } from "./database/db_connect";
import { createWriteStream } from "fs-extra";
import { format } from "util";

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

async function spinup() {
	const authchat = parseInt(process.env.AUTHORISED_CHAT);
	const mongoClient = await initMongo();
	const options = await configure(mongoClient);
	let updater = new UpdateHold(mongoClient);
	//await updater.updater()
	const app = startserver();
	await botinit(bot, updater, authchat, options);
	app.post("/sync", async (req, res) => {
		if (req.headers.calledby == "manualcall") {
			console.log("Got manual sync request.");
			res.status(200).send("Syncing anime...");
			await syncresponser(bot, authchat, updater, options, false, undefined);
		} else if (req.headers.calledby == "croncall") {
			console.log("Got automatic sync request.");
			res.status(200).send("Syncing anime...");
			await syncresponser(bot, authchat, updater, options, true, undefined);
		} else return res.sendStatus(401);
	});
}

spinup();
