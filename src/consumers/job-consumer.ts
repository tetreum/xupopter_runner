import MessageBroker, { EQueueName } from "../services/message-broker";
import { IRecipe } from "../services/crawler";
import recipeController from "../controllers/recipe-controller";
import logger from "../services/logger";

export default class JobConsumer {
	private readonly jobsBus: MessageBroker;

	constructor() {
		this.jobsBus = new MessageBroker(EQueueName.xupopterJobs);

		this.jobsBus.consume((msg) => {
			try {
				this.jobsBus.channel().ack(msg);
				const recipe = JSON.parse(msg.content.toString()) as IRecipe;
				logger.info("Received message", { recipe });
				recipeController.addRecipe(recipe);
			} catch (error) {
				logger.error("Invalid recipe", error);
			}
		});
	}
}
