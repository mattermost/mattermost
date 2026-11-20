#!/usr/bin/env node
// Scans stdin (no args or "-") or files/directories for MM_LICENSE, entirely in memory.
// Prints only PASS/FAIL and a file count. Exit: 0 PASS, 1 FAIL, 2 MM_LICENSE unset.
import fs from 'node:fs';
import path from 'node:path';

const SUBSTRING_LENGTH = 24;
// Any leaked fragment of at least LENGTH + STRIDE - 1 characters contains one full needle.
const SUBSTRING_STRIDE = 12;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function buildNeedles(secret) {
    const values = new Set([secret, secret.trim(), secret.replace(/\s+/g, '')]);
    const compact = secret.replace(/\s+/g, '');
    if (compact.length > SUBSTRING_LENGTH) {
        for (let i = 0; i + SUBSTRING_LENGTH <= compact.length; i += SUBSTRING_STRIDE) {
            values.add(compact.slice(i, i + SUBSTRING_LENGTH));
        }
        values.add(compact.slice(-SUBSTRING_LENGTH));
    }
    return [...values].filter((v) => v.length > 0);
}

function collectFiles(target, out) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
        return;
    }
    if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(target)) {
            if (!SKIP_DIRS.has(entry)) {
                collectFiles(path.join(target, entry), out);
            }
        }
    } else if (stat.isFile()) {
        out.push(target);
    }
}

function contains(text, needles) {
    return needles.some((n) => text.includes(n));
}

function main() {
    const secret = process.env.MM_LICENSE;
    if (!secret) {
        process.stdout.write('MM_LICENSE unset\n');
        return 2;
    }
    const needles = buildNeedles(secret);
    const args = process.argv.slice(2);

    if (args.length === 0 || (args.length === 1 && args[0] === '-')) {
        const text = fs.readFileSync(0).toString('utf8');
        const hit = contains(text, needles);
        process.stdout.write(`${hit ? 'FAIL' : 'PASS'} (stdin, ${text.length > 0 ? 'non-empty' : 'empty'})\n`);
        return hit ? 1 : 0;
    }

    const files = [];
    for (const arg of args) {
        collectFiles(arg, files);
    }
    let hit = false;
    for (const file of files) {
        if (contains(fs.readFileSync(file).toString('utf8'), needles)) {
            hit = true;
        }
    }
    process.stdout.write(`${hit ? 'FAIL' : 'PASS'} (files scanned: ${files.length})\n`);
    return hit ? 1 : 0;
}

let code;
try {
    code = main();
} catch {
    process.stdout.write('FAIL (scanner error)\n');
    code = 1;
}
process.exit(code);
