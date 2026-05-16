#!/usr/bin/env bun

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Fetcher } from '@/fetcher/index';
import type { RequestPayload } from '@/request_payload';
import type { YouTubeTranscriptPayload } from '@/youtube_transcript_payload';
import { RequestPayloadSchema } from '@/request_payload';
import { YouTubeTranscriptPayloadSchema } from '@/youtube_transcript_payload';
import { downloadLimit } from '@/config';
import pkg from '../package.json' with { type: 'json' };

const server = new McpServer({
	name: 'zcaceres/fetch',
	version: pkg.version,
});

server.registerTool(
	'fetch_html',
	{
		description: 'Fetch a website and return its unmodified contents as HTML',
		inputSchema: z.object({
			url: z.url().describe('URL of the website to fetch'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string }) => {
		const validatedArgs = RequestPayloadSchema.parse(args);
		return Fetcher.html(validatedArgs);
	},
);

server.registerTool(
	'fetch_markdown',
	{
		description: 'Fetch a website and return its contents converted to Markdown',
		inputSchema: z.object({
			url: z.url().describe('URL of the website to fetch'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string }) => {
		const validatedArgs = RequestPayloadSchema.parse(args);
		return Fetcher.markdown(validatedArgs);
	},
);

server.registerTool(
	'fetch_txt',
	{
		description: 'Fetch a website, convert the content to plain text (no HTML)',
		inputSchema: z.object({
			url: z.url().describe('URL of the website to fetch'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string }) => {
		const validatedArgs = RequestPayloadSchema.parse(args);
		return Fetcher.txt(validatedArgs);
	},
);

server.registerTool(
	'fetch_json',
	{
		description: 'Fetch a JSON file from a URL',
		inputSchema: z.object({
			url: z.url().describe('URL of the JSON to fetch'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string }) => {
		const validatedArgs = RequestPayloadSchema.parse(args);
		return Fetcher.json(validatedArgs);
	},
);

server.registerTool(
	'fetch_readable',
	{
		description: 'Fetch a website and return its main content parsed by Mozilla Readability, converted to Markdown. Strips away navigation, ads, and boilerplate. Ideal for articles and blog posts.',
		inputSchema: z.object({
			url: z.url().describe('URL of the website to fetch'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string }) => {
		const validatedArgs = RequestPayloadSchema.parse(args);
		return Fetcher.readable(validatedArgs);
	},
);

server.registerTool(
	'fetch_youtube_transcript',
	{
		description: 'Fetch a YouTube video page and extract its captions/transcript',
		inputSchema: z.object({
			url: z.url().describe('URL of the YouTube video'),
			headers: z.record(z.string(), z.string()).optional().describe('Optional headers to include in the request'),
			max_length: z.number().int().min(0).optional().default(downloadLimit).describe(`Maximum number of characters to return (default: ${downloadLimit})`),
			start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index (default: 0)'),
			proxy: z.url().optional().describe("Optional proxy URL (e.g. 'http://proxy:8080')"),
			lang: z.string().optional().default('en').describe("Language code for captions (default: 'en')"),
		}),
	},
	async (args: { url?: string; headers?: Record<string, string>; max_length?: number; start_index?: number; proxy?: string; lang?: string }) => {
		const validatedArgs = YouTubeTranscriptPayloadSchema.parse(args);
		return Fetcher.youtubeTranscript(validatedArgs);
	},
);

function isMainModule(): boolean {
	try {
		const scriptPath = fileURLToPath(import.meta.url);
		const argPath = realpathSync(process.argv[1]);
		return scriptPath === argPath;
	} catch {
		return process.argv[1]?.endsWith('/index.js') || process.argv[1]?.endsWith('/mcp-fetch-server') || process.argv[1]?.endsWith('/fetch-server') || false;
	}
}

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

if (isMainModule()) {
	main().catch((error) => {
		console.error('Fatal error in main():', error);
		process.exit(1);
	});
}
