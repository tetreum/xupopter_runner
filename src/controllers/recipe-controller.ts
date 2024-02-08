import Crawler, { IRecipe } from "../services/crawler";
import logger from "../services/logger";

class RecipeController {
	private readonly queue: IRecipe[];
	private readonly crawler: Crawler;
	private isConsuming = false;

	constructor() {
		this.queue = [];
		this.crawler = new Crawler();
	}

	public addRecipe(recipe: IRecipe): void {
		this.queue.push(recipe);
		logger.info("New recipe added");
		if (!this.isConsuming) {
			this.consumeQueue();
		}
	}

	private async consumeQueue(): Promise<void> {
		this.isConsuming = true;
		while (this.queue.length > 0) {
			const recipe: IRecipe = this.queue.shift(); // Take the first recipe from the queue
			if (recipe) {
				await this.crawler.run(recipe);
			}
		}
		console.log("END");
		this.isConsuming = false;
	}
}

const recipeController = new RecipeController();

export default recipeController;
