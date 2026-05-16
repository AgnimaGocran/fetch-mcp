import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import type { RequestPayload } from '@/request_payload';
import type { YouTubeTranscriptPayload } from '@/youtube_transcript_payload';
import { downloadLimit, maxResponseBytes } from '@/config';
import { YouTubeTranscript } from '@/youtube_transcript/index';
import { UrlValidator } from '@/url_validator/index';
import { ResponseReader } from '@/response_reader/index';
import { YtDlpHelper } from '@/yt_dlp_helper/index';

export class Fetcher {
	private static async _fetch({
		url,
		headers,
		proxy,
	}: RequestPayload): Promise<Response> {
		UrlValidator.validateUrl(url);
		// await UrlValidator.validateResolvedIp(url); // Disabled due to false positives in some environments
		let response: Response;
		try {
			response = await fetch(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					...headers,
				},
				// Note: proxy is a Bun-specific fetch option. On Node.js, this option is silently ignored.
				// To use a proxy on Node.js, you would need an HTTP agent library like http-proxy-agent.
				...(proxy ? { proxy } : {}),
			} as RequestInit);
		} catch (e: unknown) {
			if (e instanceof Error) {
				throw new Error(`Failed to fetch ${url}: ${e.message}`);
			}
			throw new Error(`Failed to fetch ${url}: Unknown error`);
		}

		if (response.url && response.url !== url) {
			UrlValidator.validateUrl(response.url);
			// await UrlValidator.validateResolvedIp(response.url); // Disabled due to false positives in some environments
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: HTTP error: ${response.status}`);
		}

		const contentLength = response.headers?.get?.('content-length');
		if (contentLength && parseInt(contentLength, 10) > maxResponseBytes) {
			throw new Error(`Response too large: ${contentLength} bytes exceeds ${maxResponseBytes} byte limit`);
		}

		return response;
	}

	static async html(requestPayload: RequestPayload) {
		try {
			const response = await this._fetch(requestPayload);
			let html = await ResponseReader.readResponseText(response);

			// Apply length limits
			html = ResponseReader.applyLengthLimits(
				html,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return { content: [{ type: 'text', text: html }], isError: false };
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}

	static async json(requestPayload: RequestPayload) {
		try {
			const response = await this._fetch(requestPayload);
			const text = await ResponseReader.readResponseText(response);
			const json = JSON.parse(text);
			let jsonString = JSON.stringify(json);

			// Apply length limits
			jsonString = ResponseReader.applyLengthLimits(
				jsonString,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return {
				content: [{ type: 'text', text: jsonString }],
				isError: false,
			};
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}

	static async txt(requestPayload: RequestPayload) {
		try {
			const response = await this._fetch(requestPayload);
			const html = await ResponseReader.readResponseText(response);

			const dom = new JSDOM(html, { runScripts: 'outside-only' });
			const document = dom.window.document;

			const scripts = document.getElementsByTagName('script');
			const styles = document.getElementsByTagName('style');
			Array.from(scripts).forEach((script) => script.remove());
			Array.from(styles).forEach((style) => style.remove());

			const text = document.body.textContent || '';
			let normalizedText = text.replace(/\s+/g, ' ').trim();

			// Apply length limits
			normalizedText = ResponseReader.applyLengthLimits(
				normalizedText,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return {
				content: [{ type: 'text', text: normalizedText }],
				isError: false,
			};
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}

	private static async fetchTranscriptDirect(
		requestPayload: YouTubeTranscriptPayload,
	): Promise<{ xml: string; lang: string; langName: string }> {
		const response = await this._fetch(requestPayload);
		const html = await ResponseReader.readResponseText(response);

		const playerResponse = YouTubeTranscript.extractPlayerResponse(html);
		const tracks = YouTubeTranscript.getCaptionTracks(playerResponse);

		const lang = requestPayload.lang ?? 'en';
		// TODO: Add proper type for caption track from YouTube API
		const track = tracks.find((t: any) => t.languageCode === lang) ?? tracks[0];

		const captionUrl = track.baseUrl + (track.baseUrl.includes('fmt=') ? '' : '&fmt=srv1');
		const captionResponse = await this._fetch({
			url: captionUrl,
			headers: requestPayload.headers,
			proxy: requestPayload.proxy,
		});

		const xml = await ResponseReader.readResponseText(captionResponse);
		return {
			xml,
			lang: track.languageCode,
			langName: track.name?.simpleText ?? 'Unknown',
		};
	}

	static async youtubeTranscript(requestPayload: YouTubeTranscriptPayload) {
		try {
			const lang = requestPayload.lang ?? 'en';

			// Validate lang before attempting anything — this is a security check that must not be swallowed
			if (!/^[a-zA-Z0-9-]+$/.test(lang)) {
				throw new Error(`Invalid language code: '${lang}'. Only letters, digits, and hyphens are allowed.`);
			}

			let result: { xml: string; lang: string; langName: string };

			if (await YtDlpHelper.checkYtDlp()) {
				try {
					result = await YtDlpHelper.fetchTranscriptViaYtDlp(requestPayload.url, lang);
				} catch {
					result = await this.fetchTranscriptDirect(requestPayload);
				}
			} else {
				result = await this.fetchTranscriptDirect(requestPayload);
			}

			const lines = YouTubeTranscript.parseTranscriptXml(result.xml);
			const header = `[Transcript language: ${result.lang} — ${result.langName}]\n\n`;
			let transcript = header + lines.join('\n');

			transcript = ResponseReader.applyLengthLimits(
				transcript,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return { content: [{ type: 'text', text: transcript }], isError: false };
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}

	static async readable(requestPayload: RequestPayload) {
		try {
			const response = await this._fetch(requestPayload);
			const html = await ResponseReader.readResponseText(response);

			const dom = new JSDOM(html, { url: requestPayload.url, runScripts: 'outside-only' });
			const reader = new Readability(dom.window.document);
			const article = reader.parse();

			if (!article) {
				throw new Error('Failed to parse readable content from the page');
			}

			const turndownService = new TurndownService();
			let content = turndownService.turndown(article.content ?? '');

			content = ResponseReader.applyLengthLimits(
				content,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return { content: [{ type: 'text', text: content }], isError: false };
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}

	static async markdown(requestPayload: RequestPayload) {
		try {
			const response = await this._fetch(requestPayload);
			const html = await ResponseReader.readResponseText(response);
			const turndownService = new TurndownService();
			let markdown = turndownService.turndown(html);

			// Apply length limits
			markdown = ResponseReader.applyLengthLimits(
				markdown,
				requestPayload.max_length ?? downloadLimit,
				requestPayload.start_index ?? 0,
			);

			return { content: [{ type: 'text', text: markdown }], isError: false };
		} catch (error) {
			return {
				content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
				isError: true,
			};
		}
	}
}
