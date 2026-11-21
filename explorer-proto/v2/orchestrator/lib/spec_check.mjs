// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Static check of an emitted Playwright spec through the TypeScript compiler API (loaded from the Playwright
// workspace; nothing is installed). It walks the syntax tree, so comments and string contents never trigger a rule.
import {createRequire} from 'node:module';
import path from 'node:path';

import {REPO_ROOT} from './common.mjs';

const require = createRequire(import.meta.url);
const ts = require(path.join(REPO_ROOT, 'e2e-tests/playwright/node_modules/typescript/lib/typescript.js'));

const SLEEP_CALLS = new Set(['waitForTimeout', 'pause', 'setTimeout', 'sleep', 'delay']);
const SELECTOR_CALLS = new Set(['$', '$$', '$eval', '$$eval', 'querySelector', 'querySelectorAll', 'waitForSelector']);

// Selector engines of the Playwright locator syntax that are not CSS.
const NON_CSS_PREFIX = /^(?:role|text|label|placeholder|alt|title|testid|internal:[a-z-]+)(?:=|$)/i;

function calleeName(callee) {
    if (ts.isPropertyAccessExpression(callee)) {
        return callee.name.text;
    }
    return ts.isIdentifier(callee) ? callee.text : null;
}

function literalText(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    return ts.isTemplateExpression(node) ? node.head.text : null;
}

function objectHasSoft(node) {
    return (
        ts.isObjectLiteralExpression(node) &&
        node.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'soft')
    );
}

/** Returns [{rule, line, detail}] with rule one of sleep, soft_assertion, css_locator. */
export function checkSpecText(text, fileName = 'spec.ts') {
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const issues = [];
    const add = (rule, node, detail) => {
        issues.push({rule, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, detail});
    };
    const visit = (node) => {
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression);
            const target = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : null;
            const first = node.arguments[0];
            if (SLEEP_CALLS.has(name)) {
                add('sleep', node, `${name}() pauses for a fixed time`);
            } else if (name === 'soft' && target && ts.isIdentifier(target) && target.text === 'expect') {
                add('soft_assertion', node, 'expect.soft lets later assertions run after a named one fails');
            } else if (name === 'configure' && first && objectHasSoft(first)) {
                add('soft_assertion', node, 'expect.configure({soft}) makes every assertion soft');
            } else if (SELECTOR_CALLS.has(name)) {
                add('css_locator', node, `${name}() takes a selector`);
            } else if (name === 'locator' && first) {
                const value = literalText(first);
                if (value !== null && !NON_CSS_PREFIX.test(value.trim())) {
                    add('css_locator', node, 'locator() with a CSS or XPath selector');
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return issues.sort((a, b) => a.line - b.line || (a.rule < b.rule ? -1 : 1));
}
