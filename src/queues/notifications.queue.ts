import { Queue } from "bullmq";
import { NotificationJobData } from "../interfaces";
import { getRedisConnection } from "./redis-config";

export const notificationsQueue = new Queue<NotificationJobData>(
  "notifications",
  {
    connection: getRedisConnection(),
  },
);

notificationsQueue.on("error", (err) => {
  console.error(`Notifications Queue Error: ${err}`);
});

console.log("Notifications queue initialized");
