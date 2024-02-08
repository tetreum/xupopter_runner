import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import router from "./routes/routes";
import logger from "./services/logger";
import MW from "./middlewares/middlewares";

dotenv.config({ path: "./config/.env" });
const app = express();
const port = 8089;

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

// token not set, accept the first request as owner
if (typeof process.env.JWT_ACCESS_SECRET === "undefined") {
	throw "JWT_ACCESS_SECRET is not set";
}

// API routes
app.use("/", MW.log, router);

// Handle Errors
app.use(MW.errorHandler);

app.listen(port, () => {
	logger.info(`Server running at http://localhost:${port}`);
});

logger.info("ENV: ", process.env.NODE_ENV);
