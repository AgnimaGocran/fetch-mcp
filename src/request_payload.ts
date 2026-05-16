import { z } from 'zod';
import { downloadLimit } from './config';

export const RequestPayloadSchema = z.object({
	url: z.url(),
	headers: z.record(z.string(), z.string()).optional(),
	max_length: z.number().int().min(0).optional().default(downloadLimit),
	start_index: z.number().int().min(0).optional().default(0),
	proxy: z.url().optional(),
});

// Make sure TypeScript treats the fields as optional with defaults
export type RequestPayload = {
	url: string;
	headers?: Record<string, string>;
	max_length?: number;
	start_index?: number;
	proxy?: string;
};
