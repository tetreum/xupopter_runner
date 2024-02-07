import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import os from "os";
import logger from "./logger";

const execPromise = promisify(exec);

class Files {
	public static PUBLIC_FOLDER = "/usr/src/app/public";
	public static TEMP_FOLDER = os.tmpdir();

	private readonly basePath: string;

	constructor(basePath?: string) {
		this.basePath = basePath || Files.TEMP_FOLDER;
	}

	public readFile(fileName: string): Buffer | null {
		const filePath = this.getAbsolutePath(fileName);
		if (this.fileExists(fileName)) {
			return fs.readFileSync(filePath);
		}
		return null;
	}

	public writeFile(fileName: string, content: string): void {
		const filePath = this.getAbsolutePath(fileName);
		return fs.writeFileSync(filePath, content);
	}

	public deleteFile(fileName: string): void {
		const filePath = this.getAbsolutePath(fileName);
		if (this.fileExists(fileName)) {
			fs.unlinkSync(filePath);
		}
	}

	public fileExists(path: string): boolean {
		const filePath = this.getAbsolutePath(path);
		return fs.existsSync(filePath);
	}

	public createDirectoryIfNotExists(directoryName: string): void {
		const directoryPath = this.getAbsolutePath(directoryName);
		try {
			fs.mkdirSync(directoryPath, { recursive: true });
		} catch (e) {
			logger.error("Could not create non existing directory", e);
		}
	}

	public async deleteDirectory(directoryName: string): Promise<void> {
		const directory = this.getAbsolutePath(directoryName);
		await execPromise(`rm -rf ${directory}`);
	}

	public getAbsolutePath(fileName: string): string {
		return path.join(this.basePath, fileName);
	}
}

export default Files;
