import { describe, it, expect, jest, afterAll, beforeEach } from 'bun:test';
import { Fetcher } from './index';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();

afterAll(() => {
	globalThis.fetch = originalFetch;
});

describe('Fetcher - unit tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
		Fetcher.hasYtDlp = false;
	});

	const mockRequest = {
		url: 'https://example.com',
		headers: { 'Custom-Header': 'Value' },
	};

	const mockHtml = `
    <html>
      <head>
        <title>Test Page</title>
        <script>console.log('This should be removed');</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test paragraph.</p>
      </body>
    </html>
  `;

	describe('html', () => {
		it('should return the raw HTML content', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(mockHtml),
			});

			const result = await Fetcher.html(mockRequest);
			expect(result).toEqual({
				content: [{ type: 'text', text: mockHtml }],
				isError: false,
			});
		});

		it('should handle errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await Fetcher.html(mockRequest);
			expect(result).toEqual({
				content: [
					{
						type: 'text',
						text: 'Failed to fetch https://example.com: Network error',
					},
				],
				isError: true,
			});
		});
	});

	describe('json', () => {
		it('should parse and return JSON content', async () => {
			const mockJson = { key: 'value' };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockJson)),
			});

			const result = await Fetcher.json(mockRequest);
			expect(result).toEqual({
				content: [{ type: 'text', text: JSON.stringify(mockJson) }],
				isError: false,
			});
		});

		it('should handle errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Invalid JSON'));

			const result = await Fetcher.json(mockRequest);
			expect(result).toEqual({
				content: [
					{
						type: 'text',
						text: 'Failed to fetch https://example.com: Invalid JSON',
					},
				],
				isError: true,
			});
		});
	});

	describe('txt', () => {
		it('should handle errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Parsing error'));

			const result = await Fetcher.txt(mockRequest);
			expect(result).toEqual({
				content: [
					{
						type: 'text',
						text: 'Failed to fetch https://example.com: Parsing error',
					},
				],
				isError: true,
			});
		});
	});

	describe('readable', () => {
		const articleHtml = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Hello World</h1>
            <p>This is the main article content that should be extracted by Readability. It needs to be long enough for Readability to consider it real content, so here is some additional text to pad it out a bit more.</p>
          </article>
          <footer>Footer stuff</footer>
        </body>
      </html>
    `;

		it('should return readable content as markdown', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce(articleHtml),
			});

			const result = await Fetcher.readable(mockRequest);
			expect(result.isError).toBe(false);
			expect(result.content[0].text).toContain('Hello World');
		});

		it('should return error when Readability cannot parse', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce('<html><body></body></html>'),
			});

			const result = await Fetcher.readable(mockRequest);
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Failed to parse readable content');
		});

		it('should handle fetch errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await Fetcher.readable(mockRequest);
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Failed to fetch https://example.com: Network error');
		});
	});

	describe('markdown', () => {
		it('should handle errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Conversion error'));

			const result = await Fetcher.markdown(mockRequest);
			expect(result).toEqual({
				content: [
					{
						type: 'text',
						text: 'Failed to fetch https://example.com: Conversion error',
					},
				],
				isError: true,
			});
		});
	});

	describe('proxy', () => {
		it('should pass proxy option to fetch when provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce('<html>ok</html>'),
			});

			await Fetcher.html({ url: 'https://example.com', proxy: 'http://proxy:8080' });
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[1]).toHaveProperty('proxy', 'http://proxy:8080');
		});

		it('should not include proxy option when not provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				text: jest.fn().mockResolvedValueOnce('<html>ok</html>'),
			});

			await Fetcher.html({ url: 'https://example.com' });
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[1]).not.toHaveProperty('proxy');
		});
	});

	describe('response size limit', () => {
		it('should reject responses with Content-Length exceeding limit', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: { get: (h: string) => (h === 'content-length' ? '999999999999' : null) },
				text: jest.fn().mockResolvedValueOnce('data'),
			});

			const result = await Fetcher.html(mockRequest);
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Response too large');
		});

		it('should allow responses within size limit', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: { get: (h: string) => (h === 'content-length' ? '100' : null) },
				text: jest.fn().mockResolvedValueOnce('<html>ok</html>'),
			});

			const result = await Fetcher.html(mockRequest);
			expect(result.isError).toBe(false);
		});
	});
});
