import { MediaSearchEntry } from "anilist-node";
import { redis } from "../index";

export async function addReqCache(query: string, pagenum: number, response: MediaSearchEntry) {
    try {
        await redis.set(`alcache_${query}_${pagenum}`, JSON.stringify(response));
        await redis.expire(`alcache_${query}_${pagenum}`, 5 * 60 * 60);
    } catch (e) {
        console.error(`REDIS ERROR: ${e}`);
    }
}

export async function fetchReqCache(query: string, pagenum: number) {
    try {
        const c = await redis.get(`alcache_${query}_${pagenum}`);
        if (c === undefined || c === null) return undefined;
        try {
            return JSON.parse(c) as MediaSearchEntry;
        } catch {
            console.error(
                `Unable to parse redis cache alcache_${query}_${pagenum}. Resetting cache.`
            );
            await redis.del(`alcache_${query}_${pagenum}`);
            return undefined;
        }
    } catch (e) {
        console.error(`REDIS ERROR: ${e}`);
        return undefined;
    }
}
