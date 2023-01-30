const http = require("http");
const Crawler = require("./src/crawler");
const config = require('./conf.json');
const jwt = require('jsonwebtoken');

const crawler = new Crawler(config);

const requestListener = function (req, res) {
    const token = req.headers.authorization.split(" ")[1];
    let body = '';
    let hasValidToken = false;

    try {
        hasValidToken = jwt.verify(token, config.token_secret);
    } catch (e) {
    }

    if (!hasValidToken) {
        res.writeHead(403);
        res.end("invalid_auth");
        return;
    }

    req.on('data', function(chunk) {
        body += chunk;
    });
    req.on('end', function() {
        const recipe = JSON.parse(body);

        console.log(token, recipe);
        crawler.run(recipe);
    });

    res.writeHead(200);
    res.end("ACK");
};

const server = http.createServer(requestListener);
server.listen(config.port, config.host, () => {
    console.log(`Server is running on http://${config.host}:${config.port}`);
});