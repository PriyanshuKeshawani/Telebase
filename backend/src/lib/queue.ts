import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';

export const uploadQueue = new Queue('upload-queue', { connection: redis });
export const downloadQueue = new Queue('download-queue', { connection: redis });

// The workers will be initialized in a separate file to keep things clean.
