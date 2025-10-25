import { Queue } from "bullmq";
import { AnimeCheckJobData } from "../interfaces";
import { getRedisConnection } from "./redis-config";

export const animeChecksQueue = new Queue<AnimeCheckJobData>("anime-checks", {
    connection: getRedisConnection(),
});

animeChecksQueue.on("error", (err) => {
    console.error(`Anime Checks Queue Error: ${err}`);
});

console.log("Anime checks queue initialized");
