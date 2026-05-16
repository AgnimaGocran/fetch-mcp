import isPrivateIp from 'private-ip';
import * as dns from 'node:dns';

export class UrlValidator {
	static validateUrl(url: string): void {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			throw new Error(
				`Fetcher blocked URL with disallowed protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are allowed.`,
			);
		}
		const hostname = parsedUrl.hostname;
		const bareHostname = hostname.startsWith('[') && hostname.endsWith(']')
			? hostname.slice(1, -1)
			: hostname;
		if (bareHostname === 'localhost' || isPrivateIp(bareHostname)) {
			throw new Error(
				`Fetcher blocked request to private address "${bareHostname}". This prevents SSRF attacks where a local MCP server could access privileged internal services.`,
			);
		}
	}

	static async validateResolvedIp(url: string): Promise<void> {
		const hostname = new URL(url).hostname;
		const bareHostname = hostname.startsWith('[') && hostname.endsWith(']')
			? hostname.slice(1, -1)
			: hostname;
		try {
			const { address } = await dns.promises.lookup(bareHostname);
			if (isPrivateIp(address)) {
				throw new Error(
					`Fetcher blocked request: hostname '${bareHostname}' resolved to private IP '${address}'. This prevents DNS rebinding SSRF attacks.`,
				);
			}
		} catch (e) {
			if (e instanceof Error && e.message.includes('Fetcher blocked')) throw e;
			// DNS lookup failures (e.g. non-resolvable hostnames) are not SSRF — let fetch handle them
		}
	}
}
