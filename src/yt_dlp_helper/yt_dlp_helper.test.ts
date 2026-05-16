import { describe, it, expect, jest, beforeEach, afterEach } from 'bun:test';
import { YtDlpHelper } from './index';

describe('YtDlpHelper', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		YtDlpHelper.hasYtDlp = null;
	});

	afterEach(() => {
		YtDlpHelper.hasYtDlp = null;
	});

	describe('checkYtDlp', () => {
		it('returns cached value on subsequent calls', async () => {
			YtDlpHelper.hasYtDlp = true;
			const result = await YtDlpHelper.checkYtDlp();
			expect(result).toBe(true);
		});

		it('returns cached false value on subsequent calls', async () => {
			YtDlpHelper.hasYtDlp = false;
			const result = await YtDlpHelper.checkYtDlp();
			expect(result).toBe(false);
		});
	});

	describe('fetchTranscriptViaYtDlp', () => {
		it('validates language code before fetching', async () => {
			await expect(
				YtDlpHelper.fetchTranscriptViaYtDlp('https://youtube.com/watch?v=test', 'en; rm -rf /')
			).rejects.toThrow('Invalid language code');
		});

		it('rejects language code with command substitution', async () => {
			await expect(
				YtDlpHelper.fetchTranscriptViaYtDlp('https://youtube.com/watch?v=test', '$(whoami)')
			).rejects.toThrow('Invalid language code');
		});

		it('accepts valid language codes', async () => {
			try {
				await YtDlpHelper.fetchTranscriptViaYtDlp('https://youtube.com/watch?v=test', 'en');
			} catch (e) {
				expect((e as Error).message).not.toContain('Invalid language code');
			}
		});

		it('accepts language codes with digits', async () => {
			try {
				await YtDlpHelper.fetchTranscriptViaYtDlp('https://youtube.com/watch?v=test', 'es-419');
			} catch (e) {
				expect((e as Error).message).not.toContain('Invalid language code');
			}
		});
	});
});
