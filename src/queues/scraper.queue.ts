import { Queue } from "bullmq";
import { ScraperJobData } from "../interfaces";
import { getRedisConnection } from "./redis-config";

export const scraperQueue = new Queue<ScraperJobData>("episode-scraper", {
  connection: getRedisConnection(),
});

scraperQueue.on("error", (err) => {
  console.error(`Scraper Queue Error: ${err}`);
});

console.log("Scraper queue initialized");
