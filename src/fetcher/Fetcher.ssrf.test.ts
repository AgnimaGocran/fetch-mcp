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

describe('Fetcher - SSRF protection', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
		Fetcher.hasYtDlp = false;
		// Default: resolve all hostnames to a public IP so existing tests aren't affected
		dns.promises.lookup = (async () => ({ address: '93.184.216.34', family: 4 })) as any;
	});

	const mockRequest = {
		url: 'https://example.com',
		headers: { 'Custom-Header': 'Value' },
	};

	it('should block file:// URLs', async () => {
		const result = await Fetcher.html({ url: 'file:///etc/passwd' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('disallowed protocol "file:"');
	});

	it('should block data: URLs', async () => {
		const result = await Fetcher.html({ url: 'data:text/html,<h1>hi</h1>' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('disallowed protocol "data:"');
	});

	it('should block ftp: URLs', async () => {
		const result = await Fetcher.html({ url: 'ftp://example.com/file' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('disallowed protocol "ftp:"');
	});

	it('should block IPv6 loopback http://[::1]/', async () => {
		const result = await Fetcher.html({ url: 'http://[::1]/' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('private address');
	});

	it('should block redirects to private IPs', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			url: 'http://127.0.0.1/internal',
			text: jest.fn().mockResolvedValueOnce('secret'),
		});

		const result = await Fetcher.html({ url: 'https://example.com' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('private address');
		// Should NOT be double-wrapped with "Failed to fetch" prefix
		expect(result.content[0].text).not.toContain('Failed to fetch');
	});

	it('should allow redirects to public URLs', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			url: 'https://cdn.example.com/page',
			text: jest.fn().mockResolvedValueOnce('<html>ok</html>'),
		});

		const result = await Fetcher.html({ url: 'https://example.com' });
		expect(result.isError).toBe(false);
		expect(result.content[0].text).toBe('<html>ok</html>');
	});
});

describe('Fetcher - DNS rebinding SSRF protection', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
	});

	it('should block hostnames that resolve to private IPs', async () => {
		const lookupSpy = spyOn(dns.promises, 'lookup').mockResolvedValueOnce({
			address: '127.0.0.1',
			family: 4,
		} as any);

		const result = await Fetcher.html({ url: 'https://evil.example.com' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('resolved to private IP');
		expect(result.content[0].text).toContain('DNS rebinding');
		lookupSpy.mockRestore();
	});

	it('should block post-redirect hostnames that resolve to private IPs', async () => {
		const lookupSpy = spyOn(dns.promises, 'lookup')
			.mockResolvedValueOnce({ address: '93.184.216.34', family: 4 } as any) // pre-fetch: public
			.mockResolvedValueOnce({ address: '10.0.0.1', family: 4 } as any); // post-redirect: private

		mockFetch.mockResolvedValueOnce({
			ok: true,
			url: 'https://internal.evil.com/secret',
			text: jest.fn().mockResolvedValueOnce('secret data'),
		});

		const result = await Fetcher.html({ url: 'https://example.com' });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('resolved to private IP');
		lookupSpy.mockRestore();
	});

	it('should allow hostnames that resolve to public IPs', async () => {
		const lookupSpy = spyOn(dns.promises, 'lookup').mockResolvedValueOnce({
			address: '93.184.216.34',
			family: 4,
		} as any);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockResolvedValueOnce('<html>ok</html>'),
		});

		const result = await Fetcher.html({ url: 'https://example.com' });
		expect(result.isError).toBe(false);
		lookupSpy.mockRestore();
	});
});
