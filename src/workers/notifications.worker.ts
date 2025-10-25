import { Worker, Job } from 'bullmq';
import { NotificationJobData } from '../interfaces';
import { bot } from '../bot/bot';
import { InlineKeyboard } from 'grammy';
import { getRedisConnection } from '../queues/redis-config';

async function processNotification(job: Job<NotificationJobData>) {
    const { userid, chatid, message, anime, episode, alid, imageFileId } = job.data;
    
    console.log(`Processing notification for user ${userid}: ${anime} Episode ${episode}`);
    
    try {
        const keyboard = new InlineKeyboard()
            .text('📥 Download', `dlep_${alid}_${episode}`)
            .text('✅ Mark Watched', `watched_${alid}_${episode}`);
        
        if (imageFileId) {
            await bot.api.sendPhoto(Number(chatid), imageFileId, {
                caption: message,
                reply_markup: keyboard,
            });
        } else {
            await bot.api.sendMessage(Number(chatid), message, {
                reply_markup: keyboard,
            });
        }
        
        console.log(`Notification sent successfully to user ${userid}`);
        return { success: true, userid, anime, episode };
    } catch (error) {
        console.error(`Failed to send notification to user ${userid}:`, error);
        throw error;
    }
}

export const notificationWorker = new Worker<NotificationJobData>(
    'notifications',
    processNotification,
    {
        connection: getRedisConnection(),
        concurrency: 5,
        limiter: {
            max: 30,
            duration: 1000,
        },
    }
);

notificationWorker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err.message);
});

notificationWorker.on('error', (err) => {
    console.error('Notification worker error:', err);
});

console.log('Notification worker started');
