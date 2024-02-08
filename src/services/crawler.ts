import puppeteer from "puppeteer-extra";
import { Browser, Page, TimeoutError } from "puppeteer";
import path from "path";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import logger from "../services/logger";
import { delay } from "../utils/random";
import Files from "./files";
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
	item,
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
	private turnOffTimer = null;
	private browser: Browser;

	constructor() {
		this.fs = new Files("/usr/src/app/public");
	}

	public async run(recipe: IRecipe) {
		logger.info("Running recipe " + recipe.name);

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
							await page.goto(block.details.source);
						} else if (block.details.type === "file") {
							logger.info("Downloading file: " + block.details.source);
							await httpGot.fetch(block.details.source, true);
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

			if (recipe.expectedOutput === ERecipeExpectedOutput.item && data.length > 1) {
				const item = data[0];
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
				data = item;

				logger.info("Recipe " + recipe.name + " finished");
			} else {
				logger.info("Recipe " + recipe.name + " finished with " + data.length + " results");
			}

			this.fs.writeFile(this.publicPathFor(recipe.id, "result.json"), JSON.stringify(data, null, 2));
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
