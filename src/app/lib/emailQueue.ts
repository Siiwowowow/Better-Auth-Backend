/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from 'bullmq';
import { envVars } from '../config/env.js';

// Parse REDIS_URL
let redisUrl = envVars.REDIS_URL;
redisUrl = redisUrl.replace(/^["']|["']$/g, '').trim();
if (redisUrl.startsWith('redis-cli -u ')) {
  redisUrl = redisUrl.replace('redis-cli -u ', '').trim();
}

const parsedUrl = new URL(redisUrl);

export const connectionOptions = {
  host: parsedUrl.hostname,
  port: parseInt(parsedUrl.port || '6379', 10),
  username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Create the emailQueue instance
export const emailQueue = new Queue('emailQueue', {
  connection: connectionOptions
});

export interface EmailJobData {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, any>;
}

/**
 * Add an email job to the queue
 */
export const addEmailJob = async (data: EmailJobData) => {
  try {
    const job = await emailQueue.add('sendEmail', data, {
      attempts: 3, // Retry up to 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 5000 // Wait 5 seconds before first retry
      },
      removeOnComplete: true, // Auto clean up successful jobs to save memory
      removeOnFail: false // Keep failed jobs for debugging
    });
    console.log(`[BullMQ] Added email job for ${data.to} (Job ID: ${job.id})`);
    return job;
  } catch (error) {
    console.error(`[BullMQ] Failed to add email job for ${data.to}:`, error);
    throw error;
  }
};
