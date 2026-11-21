#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Screenshots, video and Playwright traces stay off. Exit 0 pass, 1 fail, 2 usage.
//   assert_no_capture.mjs [--config <playwright.config.ts>]   screenshot, video and trace are 'off' in the config
//                                                              (default explorer-proto/playwright.config.ts) and the
//                                                              repo `chrome` project does not set them
//   assert_no_capture.mjs --export <dir>                      no png/jpg/webm/mp4/zip/trace/har file and no symlink
// Both run when neither flag is given.
import fs from 'node:fs';
import path from 'node:path';

import {annotate, EXIT, isMain, parseArgs, REPO_ROOT} from './lib.mjs';

const KEYS = ['screenshot', 'video', 'trace'];
const CAPTURE_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.webm',
    '.mp4',
    '.zip',
    '.trace',
    '.network',
    '.har',
]);
const BASE_CONFIG = 'e2e-tests/playwright/playwright.config.ts';

function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function checkConfig(text) {
    const problems = [];
    const code = stripComments(text);
    for (const key of KEYS) {
        const values = [...code.matchAll(new RegExp(`\\b${key}\\s*:\\s*([^,}\\n]+)`, 'g'))].map((m) => m[1].trim());
        if (values.length === 0) {
            problems.push(`${key} is not set to 'off'`);
        }
        for (const value of values) {
            if (!/^(['"])off\1$/.test(value)) {
                problems.push(`${key} is ${value}, not 'off'`);
            }
        }
    }
    return problems;
}

export function checkBaseChromeProject(text) {
    const block = /const chromeUse\s*=\s*\{[\s\S]*?\n\};/.exec(stripComments(text));
    if (!block) {
        return ['the chrome project settings cannot be read, so they cannot be shown to leave capture off'];
    }
    return KEYS.filter((key) => new RegExp(`\\b${key}\\s*:`).test(block[0])).map(
        (key) => `the chrome project sets ${key}`,
    );
}

export function checkExport(dir) {
    const problems = [];
    let files = 0;
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const full = path.join(current, entry.name);
            const rel = path.relative(dir, full).split(path.sep).join('/');
            if (entry.isSymbolicLink()) {
                problems.push(`symbolic link ${rel}`);
            } else if (entry.isDirectory()) {
                walk(full);
            } else {
                files++;
                if (CAPTURE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                    problems.push(`capture file ${rel}`);
                }
            }
        }
    };
    if (!fs.existsSync(dir)) {
        return {problems: ['the export directory does not exist'], files};
    }
    walk(dir);
    return {problems, files};
}

function main() {
    const {flags} = parseArgs(process.argv.slice(2));
    const both = !flags.config && !flags.export;
    const problems = [];

    if (flags.config || both) {
        const config = path.resolve(flags.config || path.join(REPO_ROOT, 'explorer-proto/playwright.config.ts'));
        try {
            problems.push(...checkConfig(fs.readFileSync(config, 'utf8')).map((p) => `config: ${p}`));
        } catch {
            problems.push('config: the Playwright config cannot be read');
        }
        try {
            problems.push(
                ...checkBaseChromeProject(fs.readFileSync(path.join(REPO_ROOT, BASE_CONFIG), 'utf8')).map(
                    (p) => `config: ${p}`,
                ),
            );
        } catch {
            problems.push('config: the repo Playwright config cannot be read');
        }
    }
    let files = null;
    if (flags.export) {
        const result = checkExport(path.resolve(flags.export));
        files = result.files;
        problems.push(...result.problems.map((p) => `export: ${p}`));
    }

    for (const problem of problems) {
        annotate('error', 'exploratory capture', problem);
    }
    const scope = [flags.config || both ? 'config' : null, flags.export ? `export (${files} files)` : null]
        .filter(Boolean)
        .join(' and ');
    process.stdout.write(`no capture: ${problems.length === 0 ? 'PASS' : 'FAIL'} (${scope})\n`);
    return problems.length === 0 ? EXIT.OK : EXIT.FAIL;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
