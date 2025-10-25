import { Worker, Job } from 'bullmq';
import { AnimeCheckJobData } from '../interfaces';
import { scraperQueue } from '../queues/scraper.queue';
import { animeChecksQueue } from '../queues/anime-checks.queue';
import { checkAnimeTable, getNumber } from '../database/animeDB';
import { db } from '../index';
import { anime } from '../database/schema';
import { eq } from 'drizzle-orm';
import { getRedisConnection } from '../queues/redis-config';

async function processAnimeCheck(job: Job<AnimeCheckJobData>) {
    const { alid, episode, jpname, enname, subscribers } = job.data;
    
    if (jpname === 'REFRESH_JOB') {
        console.log('Running periodic refresh of all anime checks...');
        const { initAnimeChecks } = await import('../api/refreshAiring');
        await initAnimeChecks();
        return { success: true, type: 'refresh' };
    }
    
    console.log(`Checking if ${jpname} Episode ${episode} has aired`);
    
    try {
        const animeData = await checkAnimeTable(alid, true);
        
        if (animeData === 'invalid' || animeData === 'err') {
            console.error(`Failed to fetch anime data for ${jpname} (${alid})`);
            throw new Error('Failed to fetch anime data');
        }
        
        await db.update(anime)
            .set({ last_ep: episode })
            .where(eq(anime.alid, alid));
        
        console.log(`${jpname} Episode ${episode} has aired! Triggering scraper...`);
        
        const animeDetails = await db.select({
            jpname: anime.jpname,
            enname: anime.enname,
            optnames: anime.optnames,
        })
        .from(anime)
        .where(eq(anime.alid, alid));
        
        if (animeDetails.length === 0) {
            throw new Error(`Anime ${alid} not found in database`);
        }
        
        const details = animeDetails[0];
        
        await scraperQueue.add(
            `scraper-${alid}-${episode}`,
            {
                alid,
                episode,
                jpname: details.jpname,
                enname: details.enname,
                optnames: details.optnames || [],
            },
            {
                delay: 5 * 60 * 1000,
            }
        );
        
        console.log(`Scraper job queued for ${jpname} Episode ${episode}`);
        
        if (animeData.airing === true && animeData.pull.next_ep_air) {
            const nextEpisode = getNumber(animeData.pull.next_ep_num) as number;
            const nextAiringTime = animeData.pull.next_ep_air;
            
            const delay = (nextAiringTime * 1000) - Date.now();
            
            if (delay > 0) {
                await animeChecksQueue.add(
                    `check-${alid}-ep${nextEpisode}`,
                    {
                        alid,
                        episode: nextEpisode,
                        jpname: details.jpname,
                        enname: details.enname,
                        subscribers,
                    },
                    {
                        delay,
                        jobId: `check-${alid}-ep${nextEpisode}`,
                    }
                );
                
                console.log(
                    `Scheduled next check for ${jpname} Episode ${nextEpisode} at ${new Date(
                        nextAiringTime * 1000
                    ).toLocaleString()}`
                );
            }
        } else {
            console.log(`${jpname} has finished airing`);
        }
        
        return {
            success: true,
            anime: jpname,
            episode,
            hasNextEpisode: animeData.airing === true,
        };
    } catch (error) {
        console.error(`Anime check failed for ${jpname} Episode ${episode}:`, error);
        throw error;
    }
}

export const animeChecksWorker = new Worker<AnimeCheckJobData>(
    'anime-checks',
    processAnimeCheck,
    {
        connection: getRedisConnection(),
        concurrency: 2,
    }
);

animeChecksWorker.on('completed', (job) => {
    console.log(`Anime check job ${job.id} completed`);
});

animeChecksWorker.on('failed', (job, err) => {
    console.error(`Anime check job ${job?.id} failed:`, err.message);
});

animeChecksWorker.on('error', (err) => {
    console.error('Anime checks worker error:', err);
});

console.log('Anime checks worker started');
