// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { URL } = require("node:url");

function createRouter() {
    const routes = new Map();

    function add(method, path, handler, meta = {}) {
        routes.set(`${method}:${path}`, { handler, meta });
    }

    async function handle(req, res, context) {
        const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const key = `${req.method}:${pathname}`;
        let route = routes.get(key);

        // Backward compatibility: normalize underscores to hyphens for legacy Cypress paths
        if (!route) {
            const normalizedPath = pathname.replace(/_/g, "-");
            route = routes.get(`${req.method}:${normalizedPath}`);
        }

        if (!route) {
            sendJSON(res, 404, { error: "Not found", path: pathname });
            return;
        }

        try {
            const body = req.method === "POST" ? await parseBody(req) : null;
            const query = Object.fromEntries(searchParams);
            await route.handler({ req, res, body, query, context, meta: route.meta });
        } catch (err) {
            console.error(`Error handling ${key}:`, err.message);
            sendJSON(res, 500, { error: "Internal server error" });
        }
    }

    function listServices() {
        return [...routes.entries()].map(([key, { meta }]) => {
            const colonIndex = key.indexOf(":");
            const method = key.slice(0, colonIndex);
            const path = key.slice(colonIndex + 1);
            return {
                method,
                path,
                description: meta.description || "",
                type: meta.type || "",
            };
        });
    }

    return {
        get: (path, handler, meta) => add("GET", path, handler, meta),
        post: (path, handler, meta) => add("POST", path, handler, meta),
        handle,
        listServices,
    };
}

async function parseBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString();
    if (!raw) {
        return {};
    }

    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
        return Object.fromEntries(new URLSearchParams(raw));
    }
    return JSON.parse(raw);
}

function sendJSON(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
    res.writeHead(status, { "Content-Type": "text/plain" });
    res.end(text);
}

function redirect(res, url) {
    res.writeHead(302, { Location: url });
    res.end();
}

module.exports = { createRouter, sendJSON, sendText, redirect };
