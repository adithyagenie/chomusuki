import { ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.warn("REDIS_URL not set, using default localhost:6379");
        return {
            host: "localhost",
            port: 6379,
        };
    }

    if (redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")) {
        try {
            const url = new URL(redisUrl);
            return {
                host: url.hostname,
                port: parseInt(url.port) || 6379,
                password: url.password || undefined,
                username: url.username || undefined,
                tls: redisUrl.startsWith("rediss://") ? {} : undefined,
            };
        } catch (error) {
            console.error("Failed to parse REDIS_URL:", error);
            return {
                host: "localhost",
                port: 6379,
            };
        }
    }

    const [host, portStr] = redisUrl.split(":");
    return {
        host: host || "localhost",
        port: parseInt(portStr) || 6379,
    };
}
