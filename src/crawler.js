const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const publicFolder = "./public";

let turnOffTimer = null;

module.exports = class Crawler {

    getLogger (recipe) {
        const filename = path.join(publicFolder, recipe.id, 'info.log');
        return winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
              new winston.transports.Console({
                format: winston.format.printf(log => "[" + log.timestamp + "] " + log.message),
              }),
              new winston.transports.File({ filename })
            ]
        });
    }

    async run (recipe) {
        const logger = await this.getLogger(recipe);
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        let data = [];

        logger.info("Running recipe " + recipe.name);
        let pageNumber = 1;
        let crawledDataCount = 0;

        for (let i = 0; i < recipe.blocks.length; i++) {
            let block = recipe.blocks[i];

            switch (block.type) {
                case "start":
                    logger.info("Going to " + block.details.source);
                    await page.goto(block.details.source);
                    break;
                case "input":
                    logger.info("Writting " + block.details.text + " on " + block.details.selector);
                    await page.type(block.details.selector, block.details.text);
                    break;
                case "click":
                    logger.info("Clicking on " + block.details.selector);
                    await page.click(block.details.selector);
                    break;
                case "paginate":
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
                        await this.delay(5);
                    }

                    const startingBlockI = recipe.blocks.findIndex(b => b.id === block.details.startBlock);

                    if (!startingBlockI) {
                        throw "Starting block not found " + block.details.startBlock;
                    }
                    i = startingBlockI - 1; // reset the crawler back to that block

                    break;
                case "extract":
                    logger.info("Extracting " + block.details.property + " from " + block.details.selector);

                    try {
                        await page.waitForSelector(block.details.selector);
                    } catch (e) {
                        if (e instanceof puppeteer.errors.TimeoutError) {
                            logger.info("Failed to find " + block.details.selector);
                            continue;
                        }
                    }

                    data = await page.evaluate((block, data, indexOffset) => {
                        document.querySelectorAll(block.details.selector).forEach((entry, i) => {
                            i += indexOffset;

                            if (typeof data[i] === "undefined") {
                                data[i] = {};
                            }
                            let val;
        
                            switch (block.details.property) {
                                case "src":
                                    val = entry.src;
                                    break;
                                case "value":
                                    val = entry.value;
                                    break;
                                case "text":
                                    val = entry.innerText;
                                    break;
                                case "html":
                                    val = entry.innerHTML;
                                    break;
                            }
        
                            data[i][block.details.name] = val;
                        });
                        return data;
                    }, block, data, crawledDataCount);
                    break;
            }
        }

        logger.info("Recipe " + recipe.name + " finished with " + data.length + " results");
        fs.writeFileSync(path.join(publicFolder, recipe.id, "result.json"), JSON.stringify(data, null, 2));

        page.close();
    }

    delay(seconds) {
        return new Promise(function(resolve) { 
            setTimeout(resolve, seconds * 1000);
        });
     }

    async getBrowser () {
        if (typeof this.browser === "undefined") {
            this.browser = await puppeteer.launch();
        }

        this.resetTurnOffTimer();

        return this.browser;
    }

    resetTurnOffTimer () {
        if (turnOffTimer !== null) {
            clearTimeout(turnOffTimer);
        }
        turnOffTimer = setTimeout(() => {
            this.turnOff();
        }, 1000 * 60 * 15);
    }

    async turnOff () {
        if (typeof this.browser === "undefined") {
            return;
        }

        console.log("Turning off browser to free resources");

        await this.browser.close();
        this.browser = undefined;
        turnOffTimer = null;
    }
}