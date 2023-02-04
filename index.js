const http = require("http");
const handler = require("./src/handler");
const config = require('./conf.json');
const serveStatic = require('serve-static');

var serve = serveStatic('public', { index: ['index.html', 'index.htm'] })

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

server.listen(config.port, config.host, () => {
    console.log(`Server is running on http://${config.host}:${config.port}`);
});