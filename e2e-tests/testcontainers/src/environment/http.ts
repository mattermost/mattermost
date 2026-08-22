// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import http, {IncomingMessage} from 'http';

export interface HttpResponse {
    success: boolean;
    body?: string;
    token?: string;
    error?: string;
}

/**
 * Make an HTTP POST request.
 * @param host Hostname
 * @param port Port number
 * @param path URL path
 * @param body Request body
 * @param headers Request headers
 * @returns Result object with success status, response body, token (from header), and optional error
 */
export function httpPost(
    host: string,
    port: number,
    path: string,
    body: string,
    headers: Record<string, string> = {},
): Promise<HttpResponse> {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Length': Buffer.byteLength(body),
                ...headers,
            },
        };

        const req = http.request(options, (res: IncomingMessage) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                // Extract token from response header (used by login endpoint)
                const token = res.headers['token'] as string | undefined;

                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({success: true, body: responseBody, token});
                } else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });

        req.on('error', (err: Error) => {
            resolve({success: false, error: err.message});
        });

        req.write(body);
        req.end();
    });
}

/**
 * Make an HTTP GET request.
 */
export function httpGet(
    host: string,
    port: number,
    path: string,
    headers: Record<string, string> = {},
): Promise<HttpResponse> {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'GET',
            headers,
        };

        const req = http.request(options, (res: IncomingMessage) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({success: true, body: responseBody});
                } else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });

        req.on('error', (err: Error) => {
            resolve({success: false, error: err.message});
        });

        req.end();
    });
}

/**
 * Make an HTTP PUT request.
 */
export function httpPut(
    host: string,
    port: number,
    path: string,
    body: string,
    headers: Record<string, string> = {},
): Promise<HttpResponse> {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'PUT',
            headers: {
                'Content-Length': Buffer.byteLength(body),
                ...headers,
            },
        };

        const req = http.request(options, (res: IncomingMessage) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({success: true, body: responseBody});
                } else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });

        req.on('error', (err: Error) => {
            resolve({success: false, error: err.message});
        });

        req.write(body);
        req.end();
    });
}
