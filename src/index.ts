// spins up everything

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { FastifyInstance } from "fastify";
import { createWriteStream } from "fs-extra";
import Redis from "ioredis";
import { Pool } from "pg";
import { format } from "util";
import { initAnimeChecks, terminateAnimeChecks } from "./api/refreshAiring";
import { startserver } from "./api/server";
import { botinit } from "./bot/bot";
import * as schema from "./database/schema";

config();
if (
    process.env.BOT_TOKEN === undefined ||
    process.env.AUTHORISED_CHAT === undefined ||
    process.env.DATABASE_URL === undefined ||
    (process.env.RUN_METHOD !== "WEBHOOK" && process.env.RUN_METHOD !== "POLLING") ||
    (process.env.RENDER_EXTERNAL_URL === undefined && process.env.RUN_METHOD === "WEBHOOK") ||
    process.env.REDIS_URL === undefined
) {
    console.log("ENV VARIABLE NOT SET!");
    process.exit(1);
}

const log_file = createWriteStream("./log.log", { flags: "w" });
const log_stdout = process.stdout;
const log_stderr = process.stderr;

console.log = function (...d: unknown[]) {
    const time = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
    });
    log_file.write(`${time}: ${format(...d)}\n`);
    log_stdout.write(`${time}: ${format(...d)}\n`);
};

console.error = function (...d: unknown[]) {
    const time = new Date().toLocaleString("en-IN", {
        timeZone: process.env.TZ,
    });
    log_file.write(`${time}: ${format(...d)}\n`);
    log_stderr.write(`${time}: ${format(...d)}\n`);
};

export let server: FastifyInstance;
startserver()
    .then((serv) => {
        server = serv;
    })
    .catch((e) => console.error(e));

// Create PostgreSQL connection pool
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Export drizzle db instance
export const db = drizzle(pool, { schema });

class RedisClient extends Redis {
    constructor(redisUrl: string) {
        super(redisUrl);
    }
}
export const redis = new RedisClient(process.env.REDIS_URL);
redis.on("error", (err) => console.error(`REDIS ERROR: ${err}`));

async function runMigrations() {
    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully");
}

async function spinup() {
    await runMigrations();

    await import("./workers/anime-checks.worker");
    await import("./workers/notifications.worker");
    await import("./workers/scraper.worker");

    console.log("BullMQ workers initialized");

    botinit();
    await initAnimeChecks();
}

async function shutdown() {
    console.log("Attempting graceful shutdown...");

    const { animeChecksWorker } = await import("./workers/anime-checks.worker");
    const { notificationWorker } = await import("./workers/notifications.worker");
    const { scraperWorker } = await import("./workers/scraper.worker");

    await Promise.all([
        animeChecksWorker.close(),
        notificationWorker.close(),
        scraperWorker.close(),
    ]);
    console.log("Workers closed...");

    await pool.end();
    console.log("Database connection closed...");
    await redis.quit(() => console.log("Redis connection closed..."));
    terminateAnimeChecks(() => console.log("Anime checks cleared..."));
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
