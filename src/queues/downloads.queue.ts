import { Queue } from "bullmq";
import { DownloadJobData } from "../interfaces";
import { getRedisConnection } from "./redis-config";

export const downloadsQueue = new Queue<DownloadJobData>("downloads", {
    connection: getRedisConnection(),
    defaultJobOptions: {
        removeOnComplete: {
            count: 100,
            age: 24 * 3600,
        },
        removeOnFail: {
            count: 50,
        },
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
    },
});

downloadsQueue.on("error", (err) => {
    console.error(`Downloads Queue Error: ${err}`);
});

console.log("Downloads queue initialized");
