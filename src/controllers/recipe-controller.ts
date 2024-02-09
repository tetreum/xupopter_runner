import Crawler, { IRecipe } from "../services/crawler";
import logger from "../services/logger";
import cloudStorage from "../services/cloud-storage";
import Files from "../services/files";
import MessageBroker, { EQueueName } from "../services/message-broker";

class RecipeController {
	private readonly queue: IRecipe[];
	private readonly crawler: Crawler;
	private readonly fs: Files;
	private readonly completedJobsBus: MessageBroker;
	private isConsuming = false;

	constructor() {
		this.queue = [];
		this.crawler = new Crawler();
		this.fs = new Files(Files.PUBLIC_FOLDER);
		this.completedJobsBus = new MessageBroker(EQueueName.xupopterCompletedJobs);
	}

	public addRecipe(recipe: IRecipe): void {
		if (!this.isValidRecipe(recipe)) {
			throw new Error("Recipe is not valid");
		}
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

				if (recipe.blocks[0].details?.type === "file") {
					const batch = recipe.blocks[0].id;
					const fileContent = this.fs.readFile(`${recipe.id}/result.json`);
					await cloudStorage.uploadFile(`${batch}.json`, fileContent);
					await this.completedJobsBus.dispatch(
						JSON.stringify({
							parent: recipe.id,
							batch,
						}),
					);
				}
			}
		}
		logger.info("Recipe Controller is idle");
		this.isConsuming = false;
	}

	private isValidRecipe(recipe: IRecipe): boolean {
		return !!recipe?.id && recipe.blocks?.length > 0 && !!recipe.blocks[0].details?.type;
	}
}

const recipeController = new RecipeController();

export default recipeController;
