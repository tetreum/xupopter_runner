const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');
const winston = require('winston');

module.exports = class Crawler {

    constructor (config) {
        this.config = config;
    }

    getLogger (recipe) {
        const filename = path.join(this.config.data_folder, recipe.id, 'info.log');
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

        for(let block of recipe.blocks) {
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
                case "extract":
                    logger.info("Extracting " + block.details.property + " from " + block.details.selector);
                    await page.waitForSelector(block.details.selector);
                    data = await page.evaluate((block, data) => {
                        document.querySelectorAll(block.details.selector).forEach((entry, i) => {
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
                    }, block, data);
                    break;
            }
        }
        logger.info("Recipe " + recipe.name + " finished with " + data.length + " results");
        fs.writeFileSync(this.config.data_folder + recipe.id + '.json', JSON.stringify(data, null, 2));
        await browser.close();
    }

    async getBrowser () {
        if (typeof this.browser === "undefined") {
            this.browser = await puppeteer.launch();
        }
        return this.browser;
    }
}