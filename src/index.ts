// spins up everything

import { config } from "dotenv";
import { botinit } from "./bot/bot";
import { createWriteStream } from "fs-extra";
import { format } from "util";
import { PrismaClient } from "@prisma/client";
import { initCron, terminateCron } from "./api/refreshAiring";
import { MediaSearchEntry } from "anilist-node";
import IORedis from "ioredis";
import { FastifyInstance } from "fastify";
import { startserver } from "./api/server";

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

console.log = function (...d: unknown[]) {
    const time = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
    });
    log_file.write(`${time}: ${format(...d)}\n`);
    log_stdout.write(`${time}: ${format(...d)}\n`);
};

console.error = function (...d: unknown[]) {
    const time = new Date().toLocaleString("en-IN", {
        timeZone: process.env.TZ
    });
    log_file.write(`${time}: ${format(...d)}\n`);
    log_stderr.write(`${time}: ${format(...d)}\n`);
};


export let server: FastifyInstance;
startserver().then((serv) => {server = serv;}).catch(e => console.error(e));
export const db = new PrismaClient();
export const redis = new IORedis("redis://localhost:6379/0");
export const requestCache: {
    query: string;
    pg: number;
    response: MediaSearchEntry;
    timestamp: number;
}[] = [];

async function spinup() {
    botinit();
    await initCron();
}

async function shutdown() {
    console.log("Attempting graceful shutdown...");
    await db.$disconnect();
    console.log("Database connection closed...");
    await redis.quit(() => console.log("Redis connection closed..."));
    terminateCron(() => console.log("Cron Jobs cleared..."));
    await new Promise<void>((resolve) => {
        server.close(() => {
            console.log("Server has been shutdown...");
            resolve();
        });
    });
    await new Promise<void>((resolve) => {
        log_file.close(() => {
            console.log("Closing log file...");
            resolve();
        });
    });
    process.stdout.write("Shutting down...");
}

spinup().catch((e) => console.error(e));
process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
});
process.on("SIGTERM", shutdown);