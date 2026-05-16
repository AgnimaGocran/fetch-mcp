import { describe, it, expect, jest, afterAll, beforeEach } from 'bun:test';
import { Fetcher } from './index';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();

afterAll(() => {
	globalThis.fetch = originalFetch;
});

describe('Fetcher - error handling', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		globalThis.fetch = mockFetch as any;
		Fetcher.hasYtDlp = false;
	});

	const mockRequest = {
		url: 'https://example.com',
		headers: { 'Custom-Header': 'Value' },
	};

	it('should handle non-OK responses', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
		});

		const result = await Fetcher.html(mockRequest);
		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Failed to fetch https://example.com: HTTP error: 404',
				},
			],
			isError: true,
		});
	});

	it('should handle unknown errors', async () => {
		mockFetch.mockRejectedValueOnce('Unknown error');

		const result = await Fetcher.html(mockRequest);
		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Failed to fetch https://example.com: Unknown error',
				},
			],
			isError: true,
		});
	});

	it('should produce a string text field when response processing throws a non-Error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: jest.fn().mockRejectedValueOnce('string error'),
		});

		const result = await Fetcher.html(mockRequest);
		expect(result.isError).toBe(true);
		expect(typeof result.content[0].text).toBe('string');
		expect(result.content[0].text).toBe('string error');
	});
});
