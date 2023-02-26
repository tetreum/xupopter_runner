const jwt = require('jsonwebtoken');
const Crawler = require("./crawler");

const crawler = new Crawler();
const queue = [];

module.exports = function handler (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

    if (req.url === "/favicon.ico") {
        res.writeHead(404);
        res.end("");
        return;
    }

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
        hasValidToken = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
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
    req.on('end', async function() {
        if (req.method !== "POST") {
            return;
        }
        const recipe = JSON.parse(body);
        recipe.recipe.id = recipe.id;
        console.log(recipe);

        queue.push(recipe.id);

        await crawler.run(recipe.recipe);

        const i = queue.findIndex(e => e === recipe.id);
        queue.splice(i, 1);
    });

    res.writeHead(200);

    if (req.url === "/api/queue") {
        res.end(JSON.stringify(queue));
    } else {
        res.end("OK");
    }
};