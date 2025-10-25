import amqp from 'amqplib';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

/**
 * Initialize RabbitMQ connection
 */
export async function initRabbitMQ() {
    try {
        const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        connection = await amqp.connect(rabbitUrl);
        channel = await connection.createChannel();
        
        // Create queues
        await channel.assertQueue('downloads', { durable: true });
        await channel.assertQueue('notifications', { durable: true });
        await channel.assertQueue('anime-checks', { durable: true });
        
        console.log('RabbitMQ connected');
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        throw error;
    }
}

/**
 * Send download job to queue
 */
export async function queueDownload(data: any) {
    if (!channel) throw new Error('RabbitMQ not initialized');
    
    channel.sendToQueue(
        'downloads',
        Buffer.from(JSON.stringify(data)),
        { persistent: true }
    );
}

/**
 * Close RabbitMQ connection
 */
export async function closeRabbitMQ() {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('RabbitMQ connection closed');
}
