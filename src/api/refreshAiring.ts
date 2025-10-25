import { animeChecksQueue } from '../queues/anime-checks.queue';
import { getNumber } from "../database/animeDB";
import { db } from "../index";
import { anime, airingupdates } from "../database/schema";
import { eq } from "drizzle-orm";

async function scheduleAnimeCheck(alid: number, aniname: string, next_ep_air: number, next_ep_num: number) {
    console.log(
        `Scheduling anime check for ${aniname} - ${next_ep_num} at ${new Date(
            next_ep_air * 1000
        ).toLocaleString()}`
    );
    
    const delay = (next_ep_air * 1000) - Date.now();
    
    if (delay < 0) {
        console.error(`Time to schedule is in the past for ${aniname}. Skipping...`);
        return;
    }
    
    const subscribersResult = await db.select({ userid: airingupdates.userid })
        .from(airingupdates)
        .where(eq(airingupdates.alid, alid));
    
    const subscribers = subscribersResult.length > 0 && subscribersResult[0].userid 
        ? subscribersResult[0].userid 
        : [];
    
    const animeDetails = await db.select({
        jpname: anime.jpname,
        enname: anime.enname,
    })
    .from(anime)
    .where(eq(anime.alid, alid));
    
    if (animeDetails.length === 0) {
        console.error(`Anime ${alid} not found in database`);
        return;
    }
    
    const details = animeDetails[0];
    
    await animeChecksQueue.add(
        `check-${alid}-ep${next_ep_num}`,
        {
            alid,
            episode: next_ep_num,
            jpname: details.jpname,
            enname: details.enname,
            subscribers,
        },
        {
            delay,
            jobId: `check-${alid}-ep${next_ep_num}`,
        }
    );
    
    console.log(`Anime check job scheduled for ${aniname} Episode ${next_ep_num}`);
}

async function reInitAnimeChecks() {
    console.log("Initializing anime check jobs for all airing anime...");
    
    const airingAnime = await db.select({
        jpname: anime.jpname,
        next_ep_air: anime.next_ep_air,
        alid: anime.alid,
        next_ep_num: anime.next_ep_num
    })
    .from(anime)
    .where(eq(anime.status, "RELEASING"));
    
    await animeChecksQueue.obliterate({ force: true });
    
    let scheduledCount = 0;
    for (const animeData of airingAnime) {
        if (animeData.next_ep_air !== null && animeData.next_ep_num !== null) {
            await scheduleAnimeCheck(
                animeData.alid,
                animeData.jpname,
                animeData.next_ep_air,
                Number(animeData.next_ep_num)
            );
            scheduledCount++;
        }
    }
    
    console.log(`Scheduled ${scheduledCount} anime check jobs`);
}

export async function terminateAnimeChecks(callback: () => void) {
    console.log("Terminating anime check jobs...");
    await animeChecksQueue.obliterate({ force: true });
    callback();
}

export async function initAnimeChecks() {
    await reInitAnimeChecks();
    
    await animeChecksQueue.add(
        'periodic-refresh',
        {
            alid: 0,
            episode: 0,
            jpname: 'REFRESH_JOB',
            enname: '',
            subscribers: [],
        },
        {
            repeat: {
                pattern: '0 * * * *',
            },
            jobId: 'periodic-refresh',
        }
    );
    
    console.log("Anime checks initialized with hourly refresh");
}
