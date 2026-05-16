import { z } from 'zod';
import { downloadLimit } from './config';

export const YouTubeTranscriptPayloadSchema = z.object({
	url: z.url(),
	headers: z.record(z.string(), z.string()).optional(),
	max_length: z.number().int().min(0).optional().default(downloadLimit),
	start_index: z.number().int().min(0).optional().default(0),
	proxy: z.url().optional(),
	lang: z.string().optional().default('en'),
});

export type YouTubeTranscriptPayload = {
	url: string;
	headers?: Record<string, string>;
	max_length?: number;
	start_index?: number;
	proxy?: string;
	lang?: string;
};
