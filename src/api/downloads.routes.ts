import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { downloadsQueue } from '../queues/downloads.queue';

interface GetPendingParams {
    userid: string;
}

interface JobActionParams {
    jobId: string;
}

async function getPendingDownloads(
    request: FastifyRequest<{ Params: GetPendingParams }>,
    reply: FastifyReply
) {
    try {
        const userid = parseInt(request.params.userid);
        
        if (isNaN(userid)) {
            return reply.status(400).send({ error: 'Invalid user ID' });
        }
        
        const jobs = await downloadsQueue.getJobs(['waiting', 'active', 'delayed']);
        const userJobs = jobs.filter(job => job.data.userid === userid);
        
        const pendingDownloads = await Promise.all(userJobs.map(async job => ({
            jobId: job.id,
            anime: job.data.anime,
            episode: job.data.episode,
            alid: job.data.alid,
            dltype: job.data.dltype,
            xdcc: job.data.xdcc,
            torrent: job.data.torrent,
            state: await job.getState(),
            progress: job.progress,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
        })));
        
        return reply.send({
            userid,
            count: pendingDownloads.length,
            downloads: pendingDownloads,
        });
    } catch (error) {
        console.error('Error fetching pending downloads:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}

async function completeDownload(
    request: FastifyRequest<{ Params: JobActionParams }>,
    reply: FastifyReply
) {
    try {
        const { jobId } = request.params;
        const job = await downloadsQueue.getJob(jobId);
        
        if (!job) {
            return reply.status(404).send({ error: 'Job not found' });
        }
        
        await job.moveToCompleted('Download completed by PC client', '0', false);
        await job.remove();
        
        console.log(`Download job ${jobId} marked as complete`);
        
        return reply.send({
            success: true,
            jobId,
            message: 'Download marked as complete',
        });
    } catch (error) {
        console.error('Error completing download:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}

async function failDownload(
    request: FastifyRequest<{ Params: JobActionParams; Body: { reason?: string } }>,
    reply: FastifyReply
) {
    try {
        const { jobId } = request.params;
        const { reason } = request.body || {};
        
        const job = await downloadsQueue.getJob(jobId);
        
        if (!job) {
            return reply.status(404).send({ error: 'Job not found' });
        }
        
        await job.moveToFailed(new Error(reason || 'Download failed'), '0', false);
        
        console.log(`Download job ${jobId} marked as failed: ${reason || 'Unknown reason'}`);
        
        return reply.send({
            success: true,
            jobId,
            message: 'Download marked as failed',
        });
    } catch (error) {
        console.error('Error failing download:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}

async function getQueueStats(request: FastifyRequest, reply: FastifyReply) {
    try {
        const waiting = await downloadsQueue.getWaitingCount();
        const active = await downloadsQueue.getActiveCount();
        const completed = await downloadsQueue.getCompletedCount();
        const failed = await downloadsQueue.getFailedCount();
        const delayed = await downloadsQueue.getDelayedCount();
        
        return reply.send({
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + delayed,
        });
    } catch (error) {
        console.error('Error fetching queue stats:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}

export default async function downloadsRoutes(fastify: FastifyInstance) {
    fastify.get('/api/downloads/:userid/pending', getPendingDownloads);
    fastify.post('/api/downloads/:jobId/complete', completeDownload);
    fastify.post('/api/downloads/:jobId/fail', failDownload);
    fastify.get('/api/downloads/stats', getQueueStats);
}
