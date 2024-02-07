import winston from "winston";

const format = winston.format;

const logger = winston.createLogger({
    level: "info",
    format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({
            format: "hh:mm:ss.SSS",
        }),
        format.errors({ stack: true }),
        format.printf((info) => {
            const _info = { ...info };
            delete _info.message;
            delete _info.level;
            delete _info.timestamp;
            const meta = Object.keys(_info).length > 0 ? "\n" + JSON.stringify(_info, null, 2) : "";
            return `[${info.timestamp}] ${info.level}: ${info.message}${meta}`;
        }),
        format.colorize({ all: true }),
    ),
    transports: [
        new winston.transports.Console({
            silent: process.env.NODE_ENV === "production",
        }),
    ],
});

export default logger;
