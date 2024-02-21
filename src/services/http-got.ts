import * as zlib from "zlib";
import Files from "./files";
import logger from "./logger";
import { isValidUrl } from "../utils/validators";

const CACHE_REQUESTS = true;

class HttpGot {
	private readonly fs: Files;
	private got: any;

	constructor() {
		this.fs = new Files();
	}

	private async initialize(): Promise<void> {
		this.got = (await import("got")).got;
	}

	public async fetch(url: string, useCache = false): Promise<string> {
		if (!isValidUrl(url)) {
			logger.error("Could not do the request: invalid url: " + url);
			return null;
		}
		if (!this.got) {
			await this.initialize();
		}

		try {
			const fileName = this.parseUrlToCacheFileName(url);

			if (CACHE_REQUESTS || useCache) {
				this.fs.createDirectoryIfNotExists(this.parseUrlToCacheDirectory(url));
				if (this.fs.fileExists(fileName)) {
					logger.info("HTTP response from detected cache: " + fileName);
					return this.fs.readFile(fileName).toString();
				}
			}
			logger.info("HTTP request for: " + url);
			const response = await this.got.get(url, {
				resolveBodyOnly: false,
				decompress: true,
				https: {
					rejectUnauthorized: false,
				},
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Cache-Control": "no-cache",
					"Accept-Encoding": "gzip, deflate, br",
					Accept: "*/*",
				},
			});
			logger.info("HTTP response received for: " + url);

			let result: string;
			if (this.isGzip(response.rawBody)) {
				logger.info("HTTP response is GZIP: " + url);
				const uncompressed = zlib.gunzipSync(Buffer.from(response.rawBody));
				logger.info("HTTP response unzipped: " + url);
				result = uncompressed?.toString() || null;
			} else {
				result = response?.body?.toString();
			}
			if (CACHE_REQUESTS || useCache) {
				logger.info("HTTP response cache store: " + fileName);
				this.fs.writeFile(fileName, result);
			}
			return result;
		} catch (error) {
			logger.error("Request error:", error);
			return null;
		}
	}

	public parseUrlToCacheFileName(url: string): string {
		const jsUrl = new URL(url);
		const [folder, fileName] = [jsUrl.hostname, jsUrl.pathname + jsUrl.search].map((s) =>
			s.replace(/[?.:/]/g, "_"),
		);
		return `http-got/${folder}/${fileName}`;
	}

	public parseUrlToCacheDirectory(url: string): string {
		return this.parseUrlToCacheFileName(url).split("/").slice(0, 2).join("/");
	}

	public async cleanDirectoryCache(domainUrl: string): Promise<void> {
		const directory = this.parseUrlToCacheDirectory(domainUrl);
		await this.fs.deleteDirectory(directory);
	}

	private isGzip(buf: Buffer): boolean {
		if (!buf || buf.length < 3) {
			return false;
		}
		return buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08;
	}
}

const httpGot = new HttpGot();
export default httpGot;
