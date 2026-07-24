// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

// A tiny file server that serves the contents of the `asset` directory for use by tests for things like link previews
// and Markdown images that need an external server which the MM server can contact.
//
// Run standalone with `npm run start:file-server-mock`, or fork it from a spec. When forked with an IPC channel,
// it posts a {type: 'listening', port} message once it is ready so the parent can learn the port (use PORT=0 to get
// an ephemeral one).

const {createServer} = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3011;
const ASSET_DIR = process.env.ASSET_DIR || path.join(__dirname, 'asset');

if (process.argv[2]) {
    process.title = process.argv[2];
}

const CONTENT_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json',
    '.zip': 'application/zip',
};

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
}

const server = createServer((req, res) => {
    const method = req.method;
    let requestPath;
    try {
        requestPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (err) {
        console.log(`[mock-file-server] Invalid request URL ${req.url.split('?')[0]}:`, err);
        res.writeHead(400);
        res.end();
        return;
    }

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[mock-file-server] ${method} ${requestPath}`);

    if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
    }

    // Resolve the requested file within ASSET_DIR, rejecting anything that escapes it (path traversal).
    const relativePath = requestPath.replace(/^\/+/, '');
    const filePath = path.join(ASSET_DIR, relativePath);
    if (filePath !== ASSET_DIR && !filePath.startsWith(ASSET_DIR + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            console.log(`[mock-file-server] 404: ${requestPath}`);
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        setCorsHeaders(res);
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);

        if (method === 'HEAD') {
            res.writeHead(200);
            res.end();
            return;
        }

        res.writeHead(200);
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`File server serving ${ASSET_DIR} on port ${actualPort}!`);

    // Let the parent process know the server is ready and which port it's on
    if (process.send) {
        process.send({type: 'listening', port: actualPort});
    }
});
