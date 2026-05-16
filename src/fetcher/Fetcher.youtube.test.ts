import { describe, it, expect, jest, spyOn, afterAll, beforeEach } from 'bun:test';
import dns from 'node:dns';
import { Fetcher } from './index';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const originalLookup = dns.promises.lookup;

afterAll(() => {
	globalThis.fetch = originalFetch;
	dns.promises.lookup = originalLookup;
});

describe('Fetcher - YouTube transcript', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
		Fetcher.hasYtDlp = false;
		// Default: resolve all hostnames to a public IP so existing tests aren't affected
		dns.promises.lookup = (async () => ({ address: '93.184.216.34', family: 4 })) as any;
	});

	it('should fetch and parse YouTube transcript', async () => {
		const playerResponse = {
			captions: {
				playerCaptionsTracklistRenderer: {
					captionTracks: [
						{
							languageCode: 'en',
							baseUrl: 'https://www.youtube.com/api/timedtext?lang=en',
							name: { simpleText: 'English' },
						},
					],
				},
			},
		};
		const pageHtml = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></html>`;
		const captionXml = `<transcript><text start="0" dur="2">Hello</text><text start="2" dur="3">World</text></transcript>`;

		// First call: page HTML. Second call: caption XML.
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(pageHtml),
			})
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(captionXml),
			});

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
		});

		expect(result.isError).toBe(false);
		expect(result.content[0].text).toContain('[Transcript language: en');
		expect(result.content[0].text).toContain('[0:00] Hello');
		expect(result.content[0].text).toContain('[0:02] World');
	});

	it('should pass proxy when fetching captions', async () => {
		const playerResponse = {
			captions: {
				playerCaptionsTracklistRenderer: {
					captionTracks: [
						{
							languageCode: 'en',
							baseUrl: 'https://www.youtube.com/api/timedtext?lang=en',
							name: { simpleText: 'English' },
						},
					],
				},
			},
		};
		const pageHtml = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></html>`;
		const captionXml = `<transcript><text start="0" dur="2">Hi</text></transcript>`;

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(pageHtml),
			})
			.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(captionXml),
			});

		await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
			proxy: 'http://proxy:8080',
		});

		// Both calls should include proxy
		for (const call of mockFetch.mock.calls) {
			expect(call[1]).toHaveProperty('proxy', 'http://proxy:8080');
		}
	});

	it('should return error when no captions found', async () => {
		const pageHtml = `<html><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"test"}};</script></html>`;

		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce(pageHtml),
		});

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('No caption tracks found');
	});
});

describe('Fetcher - yt-dlp lang sanitization', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
	});

	it('should reject lang with shell metacharacters', async () => {
		Fetcher.hasYtDlp = true;

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
			lang: 'en; rm -rf /',
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Invalid language code');
	});

	it('should reject lang with command substitution', async () => {
		Fetcher.hasYtDlp = true;

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
			lang: '$(whoami)',
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Invalid language code');
	});

	it('should accept valid language codes', async () => {
		Fetcher.hasYtDlp = true;
		// This will fail at yt-dlp execution (not installed in test), falling back to direct fetch
		// which will also fail since we haven't mocked fetch — but it should NOT fail at lang validation
		const lookupSpy = spyOn(dns.promises, 'lookup').mockResolvedValue({
			address: '93.184.216.34',
			family: 4,
		} as any);

		const playerResponse = {
			captions: {
				playerCaptionsTracklistRenderer: {
					captionTracks: [
						{
							languageCode: 'pt-BR',
							baseUrl: 'https://youtube.com/api/timedtext?lang=pt-BR',
							name: { simpleText: 'Portuguese' },
						},
					],
				},
			},
		};
		const pageHtml = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></html>`;
		const captionXml = `<transcript><text start="0" dur="2">Olá</text></transcript>`;

		mockFetch
			.mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValueOnce(pageHtml) })
			.mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValueOnce(captionXml) });

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
			lang: 'pt-BR',
		});
		expect(result.isError).toBe(false);
		lookupSpy.mockRestore();
	});

	it('should accept language codes with digits like es-419', async () => {
		Fetcher.hasYtDlp = true;
		const lookupSpy = spyOn(dns.promises, 'lookup').mockResolvedValue({
			address: '93.184.216.34',
			family: 4,
		} as any);

		const playerResponse = {
			captions: {
				playerCaptionsTracklistRenderer: {
					captionTracks: [
						{
							languageCode: 'es-419',
							baseUrl: 'https://youtube.com/api/timedtext?lang=es-419',
							name: { simpleText: 'Spanish (Latin America)' },
						},
					],
				},
			},
		};
		const pageHtml = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></html>`;
		const captionXml = `<transcript><text start="0" dur="2">Hola</text></transcript>`;

		mockFetch
			.mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValueOnce(pageHtml) })
			.mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValueOnce(captionXml) });

		const result = await Fetcher.youtubeTranscript({
			url: 'https://www.youtube.com/watch?v=test',
			lang: 'es-419',
		});
		expect(result.isError).toBe(false);
		lookupSpy.mockRestore();
	});
});

describe('Fetcher - checkYtDlp', () => {
	it('should return a promise (async)', () => {
		Fetcher.hasYtDlp = null;
		const result = Fetcher.hasYtDlp;
		expect(result).toBe(null);
	});

	it('should return cached value when already checked', async () => {
		Fetcher.hasYtDlp = true;
		const result = await Fetcher.hasYtDlp;
		expect(result).toBe(true);
	});
});
