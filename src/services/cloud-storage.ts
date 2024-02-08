import { Storage } from "@google-cloud/storage";
import logger from "./logger";

const BUCKET_NAME = "xupopter";

class CloudStorage {
	private storage: Storage;

	constructor() {
		this.storage = new Storage();
	}

	public async uploadFile(filePath: string, fileContent: Buffer): Promise<void> {
		try {
			await this.storage.bucket(BUCKET_NAME).file(filePath).save(fileContent);
			logger.info("File uploaded to Cloud Storage: " + filePath);
		} catch (error) {
			logger.info("Upload file to Cloud Storage failed!", error);
		}
	}

	public async fileExists(filePath: string): Promise<boolean> {
		try {
			const [exists] = await this.storage.bucket(BUCKET_NAME).file(filePath).exists();
			return exists;
		} catch (e) {
			logger.error("Could not check if file exists: " + filePath, e);
			return false;
		}
	}

	public async downloadFile(filePath: string): Promise<Buffer> {
		try {
			const [file] = await this.storage.bucket(BUCKET_NAME).file(filePath).download();
			return file;
		} catch (e) {
			logger.error("Could not download the file: " + filePath, e);
			return null;
		}
	}

	public getFilePublicUrl(filePath: string): string {
		return `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
	}
}

const cloudStorage = new CloudStorage();
export default cloudStorage;
