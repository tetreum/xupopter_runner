const http = require("http");
const handler = require("./src/handler");
const serveStatic = require('serve-static');
require('dotenv').config({ path: './config/.env' });

const port = 8089;

// token not set, accept the first request as owner
if (typeof process.env.JWT_ACCESS_SECRET === "undefined") {
    throw "JWT_ACCESS_SECRET is not set";
}

const serve = serveStatic('public', { index: ['index.html', 'index.htm'] });

const server = http.createServer(function onRequest (req, res) {
    if (req.url.startsWith("/public/")) {
        req.url = req.url.replace("/public/", "/");
        serve(req, res, () => {
            res.writeHead(404);
            res.end("404");
        });
    } else {
        handler(req, res);
    }
});

server.listen(port, "localhost", () => {
    console.log(`Server is running on http://localhost:${port}`);
});
