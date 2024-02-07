import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import logger from "../services/logger";
import jwt from "jsonwebtoken";
import httpStatus from "http-status";

export default class MW {
	public static log(req: Request, res: Response, next: NextFunction) {
		logger.info(`${req.method} ${req.url}`);
		next();
	}

	public static auth(req: Request, res: Response, next: NextFunction) {
		if (!req.headers.authorization) {
			return res.status(httpStatus.UNAUTHORIZED).json({ error: "Authorization header is missing" });
		}
		try {
			const token = req.headers.authorization.split(" ")[1];
			jwt.verify(token, process.env.JWT_ACCESS_SECRET);
			next();
		} catch (e) {
			res.status(httpStatus.UNAUTHORIZED).send("Invalid Auth");
		}
	}

	public static errorHandler(err: any, req, res, next): ErrorRequestHandler {
		console.error(err.stack);
		return res.status(500).send(err.message || "Unknown error occurred");
	}

	public static reqSearchParams(requiredParams: string[] = []) {
		return this.detectMissingParams(requiredParams, "query");
	}

	public static reqBodyParams(requiredParams: string[] = []) {
		return this.detectMissingParams(requiredParams, "body");
	}

	public static detectMissingParams(requiredParams: string[] = [], origin: string) {
		return (req: Request, res: Response, next: NextFunction) => {
			const requestParams: string[] = Object.keys(req[origin]);
			const difference = requiredParams.filter((x) => !requestParams.includes(x));
			if (difference.length > 0) {
				return res.status(400).json({
					error: "missing_params",
					result: difference,
				});
			}
			next();
		};
	}
}
