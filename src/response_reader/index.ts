import { maxResponseBytes } from '@/config';

export class ResponseReader {
	static async readResponseText(response: Response): Promise<string> {
		if (!response.body) {
			return response.text();
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let result = '';
		let bytesRead = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				bytesRead += value.byteLength;
				if (bytesRead > maxResponseBytes) {
					throw new Error(`Response too large: exceeded ${maxResponseBytes} byte limit while reading`);
				}
				result += decoder.decode(value, { stream: true });
			}
			result += decoder.decode();
			return result;
		} finally {
			reader.cancel();
		}
	}

	static applyLengthLimits(text: string, maxLength: number, startIndex: number): string {
		if (startIndex >= text.length) {
			return '';
		}

		const end = maxLength > 0 ? Math.min(startIndex + maxLength, text.length) : text.length;
		return text.substring(startIndex, end);
	}
}
