// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(here, '../../../..');

const require = createRequire(import.meta.url);
const tsPath = path.join(DEFAULT_REPO_ROOT, 'e2e-tests/playwright/node_modules/typescript/lib/typescript.js');

let ts;
try {
    ts = require(tsPath);
} catch (err) {
    throw new Error(
        `TypeScript compiler API not found at e2e-tests/playwright/node_modules/typescript (${err.code ?? err.message}). ` +
            'This tool adds no dependencies; it needs the already installed Playwright workspace modules.',
    );
}

export {ts};

const parseCache = new Map();

export function parseSource(absPath, text) {
    const key = absPath;
    const cached = parseCache.get(key);
    if (cached && cached.text === text) {
        return cached.sf;
    }
    let kind = ts.ScriptKind.JS;
    if (/\.(ts|mts|cts)$/.test(absPath)) {
        kind = ts.ScriptKind.TS;
    } else if (/\.tsx$/.test(absPath)) {
        kind = ts.ScriptKind.TSX;
    }
    const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, kind);
    parseCache.set(key, {text, sf});
    return sf;
}

export function readText(absPath) {
    return fs.readFileSync(absPath, 'utf8');
}

export function lineOf(sf, node) {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

export function unwrap(node) {
    let cur = node;
    while (
        cur &&
        (ts.isParenthesizedExpression(cur) ||
            ts.isAwaitExpression(cur) ||
            ts.isNonNullExpression(cur) ||
            ts.isAsExpression(cur) ||
            ts.isSatisfiesExpression(cur) ||
            ts.isTypeAssertionExpression(cur))
    ) {
        cur = cur.expression;
    }
    return cur;
}

export function isFunctionLike(node) {
    return (
        Boolean(node) && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node))
    );
}

export function propName(nameNode) {
    if (!nameNode) {
        return undefined;
    }
    if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
        return nameNode.text;
    }
    if (ts.isNoSubstitutionTemplateLiteral(nameNode)) {
        return nameNode.text;
    }
    return undefined;
}

export function objectProp(obj, name) {
    if (!obj || !ts.isObjectLiteralExpression(obj)) {
        return undefined;
    }
    for (const p of obj.properties) {
        if (ts.isPropertyAssignment(p) && propName(p.name) === name) {
            return p.initializer;
        }
        if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) {
            return p.name;
        }
    }
    return undefined;
}
