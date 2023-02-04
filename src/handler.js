const jwt = require('jsonwebtoken');
const Crawler = require("./crawler");
const config = require('../conf.json');

const crawler = new Crawler(config);

module.exports = function handler (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

    console.log(req.method + " " + req.url);

    if (req.method === "OPTIONS" || req.url === "/api/health") {
        res.writeHead(200);
        res.end("ALIVE");
        return;
    }

    if (!req.headers.authorization) {
        res.writeHead(403);
        res.end("invalid_auth");
        return;
    }

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
        recipe.recipe.id = recipe.id;
        console.log(recipe);
        crawler.run(recipe.recipe);
    });

    res.writeHead(200);
    res.end("ACK");
};