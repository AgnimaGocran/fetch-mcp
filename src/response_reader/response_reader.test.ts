import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { ResponseReader } from './index';
import { maxResponseBytes } from '@/config';

describe('ResponseReader', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('readResponseText', () => {
		it('returns text directly when response has no body', async () => {
			const mockResponse = {
				body: null,
				text: jest.fn().mockResolvedValue('test content'),
			} as unknown as Response;

			const result = await ResponseReader.readResponseText(mockResponse);
			expect(result).toBe('test content');
		});

		it('reads response body when present', async () => {
			const mockReader = {
				read: jest.fn()
					.mockResolvedValueOnce({ done: false, value: new Uint8Array([72, 101, 108, 108, 111]) })
					.mockResolvedValueOnce({ done: true, value: new Uint8Array([]) }),
				cancel: jest.fn(),
			};

			const mockResponse = {
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			} as unknown as Response;

			const result = await ResponseReader.readResponseText(mockResponse);
			expect(result).toBe('Hello');
			expect(mockReader.cancel).toHaveBeenCalled();
		});

		it('throws error when response exceeds max bytes', async () => {
			const largeChunk = new Uint8Array(maxResponseBytes + 1);
			const mockReader = {
				read: jest.fn().mockResolvedValue({ done: false, value: largeChunk }),
				cancel: jest.fn(),
			};

			const mockResponse = {
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			} as unknown as Response;

			await expect(ResponseReader.readResponseText(mockResponse)).rejects.toThrow('Response too large');
		});

		it('cancels reader even when error occurs', async () => {
			const mockReader = {
				read: jest.fn().mockRejectedValue(new Error('Read error')),
				cancel: jest.fn(),
			};

			const mockResponse = {
				body: {
					getReader: jest.fn().mockReturnValue(mockReader),
				},
			} as unknown as Response;

			await expect(ResponseReader.readResponseText(mockResponse)).rejects.toThrow('Read error');
			expect(mockReader.cancel).toHaveBeenCalled();
		});
	});

	describe('applyLengthLimits', () => {
		it('truncates text to max_length', () => {
			const text = 'A'.repeat(100);
			const result = ResponseReader.applyLengthLimits(text, 50, 0);
			expect(result).toHaveLength(50);
		});

		it('skips start_index characters', () => {
			const text = 'abcdefghij';
			const result = ResponseReader.applyLengthLimits(text, 10, 3);
			expect(result).toBe('defghij');
		});

		it('returns empty when start_index exceeds length', () => {
			const text = 'short';
			const result = ResponseReader.applyLengthLimits(text, 10, 100);
			expect(result).toBe('');
		});

		it('returns full content when max_length is 0 (unlimited)', () => {
			const text = 'A'.repeat(100);
			const result = ResponseReader.applyLengthLimits(text, 0, 0);
			expect(result).toBe(text);
		});

		it('handles combined start_index and max_length', () => {
			const text = 'abcdefghij';
			const result = ResponseReader.applyLengthLimits(text, 3, 2);
			expect(result).toBe('cde');
		});

		it('returns empty when max_length is 0 and start_index exceeds length', () => {
			const text = 'short';
			const result = ResponseReader.applyLengthLimits(text, 0, 100);
			expect(result).toBe('');
		});
	});
});
