import { Request, Response, Router } from "express";
import { IRecipe } from "../services/crawler";
import httpStatus from "http-status";
import MW from "../middlewares/middlewares";
import recipeController from "../controllers/recipe-controller";
import Files from "../services/files";

const router = Router();

router.post("/api/crawl", MW.auth, (req: Request, res: Response) => {
	const recipe: IRecipe = req.body;
	recipeController.addRecipe(recipe);
	res.status(httpStatus.OK).send("Added to Queue");
});

router.get("/public", MW.reqSearchParams(["fileName"]), (req: Request, res: Response) => {
	const fs = new Files(Files.PUBLIC_FOLDER);
	const fileName = req.query.fileName as string;
	const filePath = fs.getAbsolutePath(fileName);
	res.download(filePath, fileName.replace(/\/g/, "_"));
});

router.get("/api/health", (req: Request, res: Response) => {
	res.status(httpStatus.OK).send("ALIVE");
});

export default router;
