// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

/**
 * Log a message with timestamp to stderr.
 * Format: [ISO8601] [tc] message
 *
 * @param message The message to log
 */
export function log(message: string): void {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    process.stderr.write(`[${timestamp}] [tc] ${message}\n`);
}

// Default output directory for all testcontainers artifacts
const DEFAULT_OUTPUT_DIR = '.tc.out';

// Subdirectory for container logs within outputDir
const LOGS_SUBDIR = 'logs';

// Configured output directory (can be set via setOutputDir or TC_OUTPUT_DIR env var)
let outputDir: string | null = null;

/**
 * Get the output directory path.
 * Priority: setOutputDir() > TC_OUTPUT_DIR env var > default (.tc.out in cwd)
 */
export function getOutputDir(): string {
    if (outputDir) {
        return outputDir;
    }
    if (process.env.TC_OUTPUT_DIR) {
        return process.env.TC_OUTPUT_DIR;
    }
    return path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
}

/**
 * Set the output directory path.
 * @param dir Directory path for testcontainers output
 */
export function setOutputDir(dir: string): void {
    outputDir = dir;
}

/**
 * Get the log directory path (always <outputDir>/logs).
 */
export function getLogDir(): string {
    return path.join(getOutputDir(), LOGS_SUBDIR);
}

/**
 * Ensure the log directory exists.
 */
function ensureLogDir(): void {
    const dir = getLogDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

/**
 * Create a log consumer that writes to a file.
 * @param containerName Name of the container (used for the log file name)
 * @returns A log consumer function for testcontainers
 */
export function createFileLogConsumer(containerName: string): (stream: NodeJS.ReadableStream) => void {
    ensureLogDir();
    const logFile = path.join(getLogDir(), `${containerName}.log`);

    // Clear the log file at start
    fs.writeFileSync(logFile, '');

    return (stream: NodeJS.ReadableStream) => {
        stream.on('data', (chunk) => {
            const line = chunk.toString();
            fs.appendFileSync(logFile, line);
        });
        stream.on('err', (chunk) => {
            const line = `[ERR] ${chunk.toString()}`;
            fs.appendFileSync(logFile, line);
        });
    };
}
