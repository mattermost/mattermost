// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const {createServer} = require('http');
const {URLSearchParams} = require('url');

const PORT = Number(process.env.PORT) || 3010;

if (process.argv[2]) {
    process.title = process.argv[2];
}

// Each language lists all other languages as targets so the Mattermost autotranslation
// service considers every pair translatable when it queries GET /languages.
const LANGUAGE_CODES = ['en', 'es', 'fr', 'de'];
const LANGUAGE_NAMES = {en: 'English', es: 'Spanish', fr: 'French', de: 'German'};

const LANGUAGES = LANGUAGE_CODES.map((code) => ({
    code,
    name: LANGUAGE_NAMES[code],
    targets: LANGUAGE_CODES.filter((c) => c !== code),
}));

// Source language to return from /translate and /detect when source=auto. Set via POST /__control/source.
// Applies to all messages until changed. Default 'es'. Both /detect and /translate use this value.
let sourceLanguage = 'es';

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('application/x-www-form-urlencoded')) {
                // Parse form-encoded body (LibreTranslate accepts both JSON and form data)
                try {
                    const params = new URLSearchParams(body);
                    const obj = {};
                    for (const [key, value] of params.entries()) {
                        obj[key] = value;
                    }
                    resolve(obj);
                } catch (e) {
                    reject(e);
                }
            } else {
                // Default: parse as JSON
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    setCorsHeaders(res);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
    const method = req.method;
    const path = req.url.split('?')[0];

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[mock-libretranslate] ${method} ${path}`);

    if (method === 'GET' && path === '/') {
        sendJson(res, 200, {
            message: 'LibreTranslate mock',
            endpoints: ['GET /', 'POST /translate', 'POST /detect', 'GET /languages', 'POST /__control/source'],
        });
        return;
    }

    if (method === 'POST' && path === '/__control/source') {
        let body;
        try {
            body = await parseBody(req);
        } catch {
            sendJson(res, 400, {error: 'Invalid body'});
            return;
        }
        if (typeof body.language === 'string') {
            sourceLanguage = body.language;
        }
        console.log(`[mock-libretranslate] source language set to: ${sourceLanguage}`);
        sendJson(res, 200, {ok: true, language: sourceLanguage});
        return;
    }

    if (method === 'GET' && path === '/languages') {
        sendJson(res, 200, LANGUAGES);
        return;
    }

    if (method === 'POST' && path === '/detect') {
        let body;
        try {
            body = await parseBody(req);
        } catch {
            sendJson(res, 400, {error: 'Invalid body'});
            return;
        }
        console.log(`[mock-libretranslate] detect: q="${(body.q || '').slice(0, 40)}..." → ${sourceLanguage}`);
        sendJson(res, 200, [{language: sourceLanguage, confidence: 95}]);
        return;
    }

    if (method === 'POST' && path === '/translate') {
        let body;
        try {
            body = await parseBody(req);
        } catch {
            sendJson(res, 400, {error: 'Invalid body'});
            return;
        }

        const q = body.q || '';
        const source = body.source || 'auto';
        const target = body.target || 'en';

        // Determine the actual source language for comparison
        const actualSource = source === 'auto' ? sourceLanguage : source;

        // Only "translate" if source differs from target (matches real LibreTranslate behavior)
        const translatedText = actualSource === target ? q : `${q} [translated to ${target}]`;

        console.log(
            `[mock-libretranslate] translate: source=${actualSource} target=${target} → "${translatedText.slice(0, 60)}..."`,
        );

        const response = {translatedText};
        if (source === 'auto') {
            response.detectedLanguage = {language: sourceLanguage, confidence: 90};
        }
        sendJson(res, 200, response);
        return;
    }

    console.log(`[mock-libretranslate] 404: ${method} ${path}`);
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`LibreTranslate mock listening on port ${PORT}!`);
});
