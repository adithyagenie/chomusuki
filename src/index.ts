// spins up everything

import { config } from "dotenv";
import { botinit } from "./bot/bot";
import { startserver } from "./api/server";
import { createWriteStream } from "fs-extra";
import { format } from "util";
import { PrismaClient } from "@prisma/client";
import { pendingEndpoint } from "./bot/helpers/anime/a_pending";
import { initCron } from "./api/refreshAiring";
import { MediaSearchEntry } from "anilist-node";

config();
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

const log_file = createWriteStream("./log.txt", { flags: "w" });
const log_stdout = process.stdout;
const log_stderr = process.stderr;

console.log = function(d: string) {
	const time = new Date().toLocaleString("en-IN", {
		timeZone: "Asia/Kolkata"
	});
	log_file.write(`${time}: ${format(d)}\n`);
	log_stdout.write(`${time}: ${format(d)}\n`);
};

console.error = function(d: string) {
	const time = new Date().toLocaleString("en-IN", {
		timeZone: "Asia/Kolkata"
	});
	log_file.write(`${time}: ${format(d)}\n`);
	log_stderr.write(`${time}: ${format(d)}\n`);
};

export const app = startserver();
export const db = new PrismaClient();
export const requestCache: {
	query: string;
	pg: number;
	response: MediaSearchEntry;
	timestamp: number;
}[] = [];

async function spinup() {
	pendingEndpoint(app);
	botinit();
	await initCron();
	app.post("/sync", async (req, res) => {
		if (req.headers.calledby == "manualcall") {
			console.log("Got manual sync request.");
			res.status(200).send("Syncing anime...");
			//await syncresponser(false, undefined);
		} else if (req.headers.calledby == "croncall") {
			console.log("Got automatic sync request.");
			res.status(200).send("Syncing anime...");
			//await syncresponser(true, undefined);
		} else return res.sendStatus(401);
	});
}

spinup().catch((e) => console.error(e));
