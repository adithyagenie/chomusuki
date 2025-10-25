import { Worker, Job } from 'bullmq';
import { ScraperJobData, i_NyaaResponse } from '../interfaces';
import { downloadsQueue } from '../queues/downloads.queue';
import { notificationsQueue } from '../queues/notifications.queue';
import { db } from '../index';
import { airingupdates, anime, users } from '../database/schema';
import { eq, inArray } from 'drizzle-orm';
import axios, { AxiosResponse } from 'axios';
import aniep from 'aniep';
import { getxdcc } from '../api/subsplease-xdcc';
import { b, fmt } from '@grammyjs/parse-mode';
import { getRedisConnection } from '../queues/redis-config';

async function processScraper(job: Job<ScraperJobData>) {
    const { alid, episode, jpname, enname, optnames } = job.data;
    
    console.log(`Scraping sources for ${jpname} Episode ${episode}`);
    
    try {
        let query = `"${jpname}"|"${enname}"`;
        if (optnames && optnames.length > 0) {
            optnames.forEach((name) => (query += `|"${name}"`));
        }
        query += ` 1080p "- ${String(episode).padStart(2, '0')}"`;
        
        console.log(`Scraper query: ${query}`);
        
        let res: AxiosResponse<i_NyaaResponse[]>;
        res = await axios.get<i_NyaaResponse[]>(
            `${process.env.NYAA_API_URL}/user/SubsPlease?q=${query}`
        );
        
        if (res.status !== 200 || res.data.length === 0) {
            console.log('SubsPlease not found, trying Erai-raws...');
            res = await axios.get<i_NyaaResponse[]>(
                `${process.env.NYAA_API_URL}/user/Erai-raws?q=${query}`
            );
        }
        
        if (res.status !== 200 || res.data.length === 0) {
            console.error(`No sources found for ${jpname} Episode ${episode}`);
            throw new Error('No sources found');
        }
        
        const filteredResults = res.data.filter((result) => {
            const title = result.title.toLowerCase();
            return (
                aniep(title) === episode &&
                (title.includes(jpname.toLowerCase()) ||
                    title.includes(enname.toLowerCase()) ||
                    optnames.map((p) => p.toLowerCase()).some((q) => title.includes(q)))
            );
        });
        
        if (filteredResults.length === 0) {
            console.error(`No matching results for ${jpname} Episode ${episode}`);
            throw new Error('No matching results');
        }
        
        const selectedRelease = filteredResults[0];
        console.log(`Found release: ${selectedRelease.title}`);
        
        const xdccInfo = await getxdcc(selectedRelease.title);
        
        const subscribersResult = await db.select({ userid: airingupdates.userid })
            .from(airingupdates)
            .where(eq(airingupdates.alid, alid));
        
        if (subscribersResult.length === 0 || !subscribersResult[0].userid) {
            console.log(`No subscribers found for ${jpname}`);
            return { success: true, anime: jpname, episode, subscribers: 0 };
        }
        
        const subscribers = subscribersResult[0].userid;
        
        const imageResult = await db.select({ fileid: anime.fileid })
            .from(anime)
            .where(eq(anime.alid, alid));
        
        const imageFileId = imageResult[0]?.fileid;
        
        const chatIdsResult = await db.select({ userid: users.userid, chatid: users.chatid })
            .from(users)
            .where(inArray(users.userid, subscribers));
        
        const notificationMessage = fmt`Episode ${episode} of ${b}${jpname}${b} is now available for download!`;
        
        for (const user of chatIdsResult) {
            if (!user.chatid) continue;
            
            await notificationsQueue.add(
                `notification-${user.userid}-${alid}-${episode}`,
                {
                    userid: user.userid,
                    chatid: user.chatid,
                    message: notificationMessage.text,
                    anime: jpname,
                    episode,
                    alid,
                    imageFileId,
                }
            );
        }
        
        console.log(`Created ${chatIdsResult.length} notification jobs for ${jpname} Episode ${episode}`);
        
        return {
            success: true,
            anime: jpname,
            episode,
            subscribers: chatIdsResult.length,
            hasXDCC: xdccInfo !== undefined && xdccInfo.packnum !== 0,
            hasTorrent: !!selectedRelease.file,
        };
    } catch (error) {
        console.error(`Scraper failed for ${jpname} Episode ${episode}:`, error);
        throw error;
    }
}

export const scraperWorker = new Worker<ScraperJobData>(
    'episode-scraper',
    processScraper,
    {
        connection: getRedisConnection(),
        concurrency: 3,
    }
);

scraperWorker.on('completed', (job) => {
    console.log(`Scraper job ${job.id} completed`);
});

scraperWorker.on('failed', (job, err) => {
    console.error(`Scraper job ${job?.id} failed:`, err.message);
});

scraperWorker.on('error', (err) => {
    console.error('Scraper worker error:', err);
});

console.log('Scraper worker started');
