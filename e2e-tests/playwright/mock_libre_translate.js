// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const {createServer} = require('http'); // eslint-disable-line @typescript-eslint/no-require-imports

const PORT = Number(process.env.PORT) || 3010;

if (process.argv[2]) {
    process.title = process.argv[2];
}

const LANGUAGES = [
    {code: 'en', name: 'English'},
    {code: 'es', name: 'Spanish'},
    {code: 'fr', name: 'French'},
    {code: 'de', name: 'German'},
];

// Source language to return from /translate when source=auto. Set via POST /__control/detect_queue.
// Applies to all messages until changed. Default 'es'. /detect always returns 'es'.
let sourceLanguage = 'es';

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
    const method = req.method;
    const path = req.url.split('?')[0];

    if (method === 'GET' && path === '/') {
        return sendJson(res, 200, {
            message: 'LibreTranslate mock',
            endpoints: ['GET /', 'POST /translate', 'POST /detect', 'GET /languages', 'POST /__control/detect_queue'],
        });
    }

    if (method === 'POST' && path === '/__control/source') {
        let body;
        try {
            body = await parseJsonBody(req);
        } catch {
            return sendJson(res, 400, {error: 'Invalid JSON'});
        }
        if (typeof body.language === 'string') {
            sourceLanguage = body.language;
        }
        return sendJson(res, 200, {ok: true, language: sourceLanguage});
    }

    if (method === 'GET' && path === '/languages') {
        return sendJson(res, 200, LANGUAGES);
    }

    if (method === 'POST' && path === '/detect') {
        sendJson(res, 200, [{language: sourceLanguage, confidence: 95}]);
        return;
    }

    if (method === 'POST' && path === '/translate') {
        let body;
        try {
            body = await parseJsonBody(req);
        } catch {
            return sendJson(res, 400, {error: 'Invalid JSON'});
        }

        const q = body.q || '';
        const source = body.source || 'auto';
        const target = body.target || 'en';
        const translatedText = `[${target}] ${q}`;
        const response = {translatedText};
        if (source === 'auto') {
            response.detectedLanguage = {language: sourceLanguage, confidence: 90};
        }
        sendJson(res, 200, response);
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`LibreTranslate mock listening on port ${PORT}!`);
});
