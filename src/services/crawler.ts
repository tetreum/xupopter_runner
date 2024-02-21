import puppeteer from "puppeteer-extra";
import { Browser, Page, TimeoutError } from "puppeteer";
import path from "path";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import logger from "../services/logger";
import { deepClone, delay } from "../utils/random";
import Files from "./files";
import fs from "fs";
import httpGot from "./http-got";

export enum EBlockType {
	start = "start",
	input = "input",
	click = "click",
	screenshot = "screenshot",
	saveHtml = "save-html",
	jsonSchema = "jsonschema",
	paginate = "paginate",
	extract = "extract",
}

export enum ERecipeExpectedOutput {
	item = "item",
	list = "list",
}

interface IRecipeBlock {
	id: string;
	type: EBlockType;
	details: Record<string, any>;
}

export interface IRecipe {
	id: string;
	name: string;
	blocks: IRecipeBlock[];
	expectedOutput: ERecipeExpectedOutput;
}

puppeteer.use(StealthPlugin());

export default class Crawler {
	private readonly fs: Files;
	private readonly fsTmp: Files;
	private turnOffTimer = null;
	private browser: Browser;

	constructor() {
		this.fs = new Files("/usr/src/app/public");
		this.fsTmp = new Files();
	}

	public async run(recipe: IRecipe, index?: number, pointer?: fs.WriteStream) {
		logger.info("Running recipe " + recipe.name);

		const resultFilePath = this.publicPathFor(recipe.id, "result.json");
		this.fs.createDirectoryIfNotExists(recipe.id);
		await this.getBrowser();
		const page: Page = await this.browser.newPage();
		let data = [];

		let pageNumber = 1;
		let crawledDataCount = 0;

		try {
			for (let i = 0; i < recipe.blocks.length; i++) {
				const block = recipe.blocks[i];
				switch (block.type) {
					case EBlockType.start:
						if (block.details.type === "url") {
							logger.info("Going to: " + block.details.source);
							const response = await page.goto(block.details.source);
							if (response.status() === 404) {
								logger.info("Page not found: " + block.details.source);
								return;
							}
						} else if (block.details.type === "file") {
							logger.info("Downloading file: " + block.details.source);
							this.fs.deleteFile(resultFilePath);
							await httpGot.fetch(block.details.source, true);
							const fileName = httpGot.parseUrlToCacheFileName(block.details.source);
							const urlsCount = await this.fsTmp.countFileLines(fileName);
							const writePointer = this.fs.newWritePointer(resultFilePath);

							for (let i = 0; i < urlsCount; i++) {
								const url = await this.fsTmp.readLine(fileName, i + 1);
								const clonedRecipe = deepClone<IRecipe>(recipe);
								clonedRecipe.blocks[0].details.type = "url";
								clonedRecipe.blocks[0].details.source = url;

								await this.run(clonedRecipe, i, writePointer);
							}
							this.fs.deleteDirectory(fileName);
							return;
						}
						break;

					case EBlockType.input:
						logger.info("Writing " + block.details.text + " on " + block.details.selector);
						await page.type(block.details.selector, block.details.text);
						break;

					case EBlockType.click:
						logger.info("Clicking on " + block.details.selector);
						await page.click(block.details.selector);
						break;

					case EBlockType.screenshot:
						logger.info("Screenshotting");
						await page.screenshot({
							path: this.publicPathFor(`${Files.PUBLIC_FOLDER}/${recipe.id}`, `screenshot_${i}.jpg`),
							fullPage: true,
						});
						break;

					case EBlockType.saveHtml:
						logger.info("Saving html");
						const html = await page.content();
						this.fs.writeFile(this.publicPathFor(recipe.id, "document.html"), html);
						break;

					case EBlockType.jsonSchema:
						logger.info("Looking for json schema of type: " + block.details.type);
						try {
							await page.waitForSelector('[type="application/ld+json"]');
						} catch (e) {
							if (e instanceof TimeoutError) {
								logger.info("Failed to find '[type=\"application/ld+json\"]'");
								continue;
							}
						}

						data = await page.evaluate(
							(block, data) => {
								for (const el of document.querySelectorAll('[type="application/ld+json"]')) {
									const json = JSON.parse(el.textContent);
									if (json["@type"] !== block.details.type) {
										continue;
									}
									data[0] = json;
								}
								return data;
							},
							block,
							data,
						);

						// Take specified URL instead of the schema URL
						if (!!data?.[0]) {
							data[0].url = recipe.blocks[0].details.source;
						}
						break;

					case EBlockType.paginate:
						if (crawledDataCount === data.length) {
							logger.info("No more pages to crawl");
							continue;
						}
						crawledDataCount = data.length;

						pageNumber++;
						logger.info("Moving to page " + pageNumber);

						if (typeof block.details.selector !== "undefined") {
							await page.click(block.details.selector);

							logger.info("Waiting 5 seconds - " + page.url());
							await delay(5);
						}

						const startingBlockI = recipe.blocks.findIndex((b) => b.id === block.details.startBlock);

						if (!startingBlockI) {
							throw "Starting block not found " + block.details.startBlock;
						}
						i = startingBlockI - 1; // reset the crawler back to that block
						break;

					case EBlockType.extract:
						logger.info("Extracting " + block.details.property + " from " + block.details.selector);

						try {
							await page.waitForSelector(block.details.selector);
						} catch (e) {
							if (e instanceof TimeoutError) {
								logger.info("Failed to find " + block.details.selector);
								continue;
							}
						}

						data = await page.evaluate(
							(block, data, indexOffset) => {
								document.querySelectorAll(block.details.selector).forEach((entry, i) => {
									i += indexOffset;

									if (typeof data[i] === "undefined") {
										data[i] = {};
									}
									let val;

									switch (block.details.property) {
										case "text":
											val = entry.innerText;
											break;
										case "html":
											val = entry.innerHTML;
											break;
										default:
											val = entry[block.details.property];
											break;
									}

									data[i][block.details.name] = val;
								});
								return data;
							},
							block,
							data,
							crawledDataCount,
						);
						break;
				}
			}

			if (recipe.expectedOutput === ERecipeExpectedOutput.item) {
				const item = data[0];
				if (data.length > 1) {
					for (const [i, entry] of data.entries()) {
						if (i === 0) {
							continue;
						}
						for (const [k, v] of Object.entries(entry)) {
							if (!Array.isArray(item[k])) {
								item[k] = [item[k]];
							}
							item[k].push(v);
						}
					}
				}
				data = item;
				logger.info("Recipe " + recipe.name + " finished");
			} else {
				logger.info("Recipe " + recipe.name + " finished with " + data.length + " results");
			}

			if (typeof index !== "undefined") {
				pointer.write(JSON.stringify(data) + "\n");
			} else {
				this.fs.writeFile(resultFilePath, JSON.stringify(data, null, 2));
			}
		} catch (error) {
			logger.error("Crawler error: ", error);
		} finally {
			await page.close();
		}
	}

	private publicPathFor(recipeId: string, fileName: string) {
		return path.join(recipeId, fileName);
	}

	private async getBrowser() {
		if (typeof this.browser === "undefined") {
			this.browser = await puppeteer.launch({
				ignoreHTTPSErrors: true,
				headless: true,
				userDataDir: `${Files.TEMP_FOLDER}/crawler`,
			});
		}
		this.resetTurnOffTimer();
	}

	private resetTurnOffTimer() {
		if (this.turnOffTimer !== null) {
			clearTimeout(this.turnOffTimer);
		}
		this.turnOffTimer = setTimeout(
			async () => {
				await this.turnOff();
			},
			1000 * 60 * 15,
		);
	}

	private async turnOff() {
		if (typeof this.browser === "undefined") {
			return;
		}
		logger.info("Turning off browser to free resources");
		await this.browser.close();
		this.browser = undefined;
		this.turnOffTimer = null;
	}
}
