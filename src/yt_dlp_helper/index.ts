export class YtDlpHelper {
	static hasYtDlp: boolean | null = null;

	static async checkYtDlp(): Promise<boolean> {
		if (this.hasYtDlp !== null) {
			return this.hasYtDlp;
		}
		try {
			const { execSync } = await import('child_process');
			execSync('which yt-dlp', { encoding: 'utf-8', stdio: 'pipe' });
			this.hasYtDlp = true;
		} catch {
			this.hasYtDlp = false;
		}
		return this.hasYtDlp;
	}

	static async fetchTranscriptViaYtDlp(
		videoUrl: string,
		lang: string,
	): Promise<{ xml: string; lang: string; langName: string }> {
		if (!/^[a-zA-Z0-9-]+$/.test(lang)) {
			throw new Error(`Invalid language code: '${lang}'. Only letters, digits, and hyphens are allowed.`);
		}
		const { execFileSync, execSync } = await import('child_process');
		const tmpDir = execSync('mktemp -d', { encoding: 'utf-8' }).trim();
		try {
			execFileSync(
				'yt-dlp',
				[
					'--write-sub',
					'--sub-lang',
					lang,
					'--sub-format',
					'srv1',
					'--skip-download',
					'-o',
					`${tmpDir}/sub`,
					videoUrl,
				],
				{ encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] },
			);
			const { readdirSync, readFileSync } = await import('fs');
			const files = readdirSync(tmpDir).filter((f: string) => f.endsWith('.srv1'));
			if (files.length === 0) {
				throw new Error('yt-dlp did not produce subtitle files');
			}
			const file = files[0];
			const xml = readFileSync(`${tmpDir}/${file}`, 'utf-8');
			const matchedLang = file.match(/\.([^.]+)\.srv1$/)?.[1] ?? lang;
			return { xml, lang: matchedLang, langName: matchedLang };
		} finally {
			const { rmSync } = await import('fs');
			rmSync(tmpDir, { recursive: true, force: true });
		}
	}
}
