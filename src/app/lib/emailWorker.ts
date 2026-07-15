import { Worker, Job } from 'bullmq';
import { connectionOptions, EmailJobData } from './emailQueue.js';
import { sendEmail } from '../utils/email.js';

export const emailWorker = new Worker<EmailJobData>(
  'emailQueue',
  async (job: Job<EmailJobData>) => {
    const { to, subject, templateName, templateData } = job.data;
    console.log(`[BullMQ Worker] Processing email job ${job.id} for ${to}...`);
    
    // Call the existing nodemailer sendEmail helper
    await sendEmail({
      to,
      subject,
      templateName,
      templateData
    });
  },
  {
    connection: connectionOptions,
    concurrency: 2 // Process up to 2 emails concurrently
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} for ${job.data.to} completed successfully!`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} for ${job?.data.to} failed with error:`, err.message || err);
});
