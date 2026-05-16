import { describe, it, expect, jest, beforeEach, afterEach } from 'bun:test';
import dns from 'node:dns';
import { UrlValidator } from './index';

const originalLookup = dns.promises.lookup;

describe('UrlValidator', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		dns.promises.lookup = originalLookup;
	});

	describe('validateUrl', () => {
		it('allows http URLs', () => {
			expect(() => UrlValidator.validateUrl('http://example.com')).not.toThrow();
		});

		it('allows https URLs', () => {
			expect(() => UrlValidator.validateUrl('https://example.com')).not.toThrow();
		});

		it('blocks file protocol', () => {
			expect(() => UrlValidator.validateUrl('file:///etc/passwd')).toThrow('disallowed protocol "file:"');
		});

		it('blocks data protocol', () => {
			expect(() => UrlValidator.validateUrl('data:text/plain,hello')).toThrow('disallowed protocol "data:"');
		});

		it('blocks ftp protocol', () => {
			expect(() => UrlValidator.validateUrl('ftp://example.com/file')).toThrow('disallowed protocol "ftp:"');
		});

		it('blocks localhost', () => {
			expect(() => UrlValidator.validateUrl('http://localhost')).toThrow('private address "localhost"');
		});

		it('blocks 127.0.0.1', () => {
			expect(() => UrlValidator.validateUrl('http://127.0.0.1')).toThrow('private address "127.0.0.1"');
		});

		it('blocks 192.168.x.x', () => {
			expect(() => UrlValidator.validateUrl('http://192.168.1.1')).toThrow('private address "192.168.1.1"');
		});

		it('blocks 10.x.x.x', () => {
			expect(() => UrlValidator.validateUrl('http://10.0.0.1')).toThrow('private address "10.0.0.1"');
		});

		it('blocks 172.16.x.x', () => {
			expect(() => UrlValidator.validateUrl('http://172.16.0.1')).toThrow('private address "172.16.0.1"');
		});

		it('allows public IP addresses', () => {
			expect(() => UrlValidator.validateUrl('http://8.8.8.8')).not.toThrow();
		});

		it('allows public domain names', () => {
			expect(() => UrlValidator.validateUrl('http://example.com')).not.toThrow();
		});

		it('handles IPv6 localhost', () => {
			expect(() => UrlValidator.validateUrl('http://[::1]')).toThrow('private address "::1"');
		});

		it('handles IPv6 private addresses', () => {
			expect(() => UrlValidator.validateUrl('http://[fe80::1]')).toThrow('private address "fe80::1"');
		});
	});

	describe('validateResolvedIp', () => {
		it('allows resolution to public IP', async () => {
			const mockLookup = jest.fn().mockResolvedValue({ address: '8.8.8.8', family: 4 });
			dns.promises.lookup = mockLookup as any;
			await UrlValidator.validateResolvedIp('http://example.com');
		});

		it('blocks resolution to private IP', async () => {
			const mockLookup = jest.fn().mockResolvedValue({ address: '192.168.1.1', family: 4 });
			dns.promises.lookup = mockLookup as any;
			await expect(UrlValidator.validateResolvedIp('http://example.com')).rejects.toThrow('DNS rebinding SSRF');
		});

		it('blocks DNS rebinding attack (public name -> private IP)', async () => {
			const mockLookup = jest.fn().mockResolvedValue({ address: '127.0.0.1', family: 4 });
			dns.promises.lookup = mockLookup as any;
			await expect(UrlValidator.validateResolvedIp('http://example.com')).rejects.toThrow('DNS rebinding SSRF');
		});

		it('does not throw on DNS lookup failure', async () => {
			const mockLookup = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
			dns.promises.lookup = mockLookup as any;
			await UrlValidator.validateResolvedIp('http://nonexistent.example');
		});

		it('does not re-throw non-SSRF errors', async () => {
			const mockLookup = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
			dns.promises.lookup = mockLookup as any;
			await UrlValidator.validateResolvedIp('http://example.com');
		});

		it('re-throws SSRF errors', async () => {
			const mockLookup = jest.fn().mockRejectedValue(new Error('Fetcher blocked request'));
			dns.promises.lookup = mockLookup as any;
			await expect(UrlValidator.validateResolvedIp('http://example.com')).rejects.toThrow('Fetcher blocked request');
		});
	});
});
