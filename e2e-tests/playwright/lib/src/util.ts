// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import fs from 'node:fs';

import {v4 as uuidv4} from 'uuid';

const second = 1000;
const minute = 60 * 1000;

export const duration = {
    half_sec: second / 2,
    one_sec: second,
    two_sec: second * 2,
    four_sec: second * 4,
    ten_sec: second * 10,
    half_min: minute / 2,
    one_min: minute,
    two_min: minute * 2,
    four_min: minute * 4,
};

/**
 * Explicit `wait` should not normally used but made available for special cases.
 * @param {number} ms - duration in millisecond
 * @return {Promise} promise with timeout
 */
export const wait = async (ms = 0) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * @param {Number} length - length on random string to return, e.g. 7 (default)
 * @return {String} random string
 */
export function getRandomId(length = 7): string {
    const MAX_SUBSTRING_INDEX = 27;

    return uuidv4()
        .replace(/-/g, '')
        .substring(MAX_SUBSTRING_INDEX - length, MAX_SUBSTRING_INDEX);
}

// Default team is meant for sysadmin's primary team,
// selected for compatibility with existing local development.
// It should not be used for testing.
export const defaultTeam = {name: 'ad-1', displayName: 'eligendi', type: 'O'};

export const illegalRe = /[/?<>\\:*|":&();]/g;
export const simpleEmailRe = /\S+@\S+\.\S+/;

export function hexToRgb(hex: string): string {
    // Remove the # if present
    hex = hex.replace(/^#/, '');

    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Return the RGB string
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Finds the playwright root directory by searching for playwright.config.ts.
 * Searches in e2e-tests folder first, then e2e-tests/playwright folder.
 * @returns The path to the playwright root directory or null if not found.
 */
export function findPlaywrightRoot(): string | null {
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    // Walk up from current directory
    while (currentDir !== root) {
        // First, check if playwright.config.ts exists in e2e-tests folder
        const e2eTestsPath = path.join(currentDir, 'e2e-tests');
        const e2eTestsConfigPath = path.join(e2eTestsPath, 'playwright.config.ts');
        if (fs.existsSync(e2eTestsConfigPath)) {
            return e2eTestsPath;
        }

        // Then, check if playwright.config.ts exists in e2e-tests/playwright folder
        const e2ePlaywrightPath = path.join(currentDir, 'e2e-tests', 'playwright');
        const e2ePlaywrightConfigPath = path.join(e2ePlaywrightPath, 'playwright.config.ts');
        if (fs.existsSync(e2ePlaywrightConfigPath)) {
            return e2ePlaywrightPath;
        }

        currentDir = path.dirname(currentDir);
    }

    return null;
}

/**
 * Resolves the directory path.
 * Tries to find directory at the playwright root, falls back to current working directory.
 * @returns The resolved directory path.
 */
export function resolvePlaywrightPath(dir: string): string {
    const playwrightRoot = findPlaywrightRoot();
    if (playwrightRoot) {
        return path.join(playwrightRoot, dir);
    }
    // Fall back to current working directory
    return path.join(process.cwd(), dir);
}
