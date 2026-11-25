// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';

import {globSync} from 'glob';
import ts from 'typescript';

import {parseTemplateTestId, parseTestId} from './scan.js';

/**
 * The ratchet gates NEW legacy `data-testid`s. A "legacy" testid is one that is neither grammar (`scope.name[:key][--role]`)
 * nor paired with a `data-surface` on the same element: a plain free-form id, or a non-literal/dynamic `data-testid` that
 * nothing can type-check. The committed baseline records a compact count + hash of legacy ids per file; `check` fails when
 * a file's count grows, so any new `data-testid` must be grammar or paired with `data-surface`. The baseline may only
 * shrink. Storing count + hash (not the ids) keeps the file small and merge-friendly.
 */
export type FileLegacy = {count: number; hash: string};
export type Baseline = Record<string, FileLegacy>;

function elementsWithTestId(source: ts.SourceFile): Array<{value?: string; dynamic: boolean; keyedTemplate: boolean; hasSurface: boolean}> {
    const out: Array<{value?: string; dynamic: boolean; keyedTemplate: boolean; hasSurface: boolean}> = [];
    const opening = (node: ts.Node): ts.JsxOpeningLikeElement | undefined =>
        ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
    const visit = (node: ts.Node) => {
        const el = opening(node);
        if (el) {
            let testid: ts.JsxAttribute | undefined;
            let hasSurface = false;
            for (const prop of el.attributes.properties) {
                if (ts.isJsxAttribute(prop) && prop.name.getText() === 'data-testid') {
                    testid = prop;
                }
                if (ts.isJsxAttribute(prop) && prop.name.getText() === 'data-surface') {
                    hasSurface = true;
                }
            }
            if (testid) {
                const init = testid.initializer;
                if (init && ts.isStringLiteral(init)) {
                    out.push({value: init.text, dynamic: false, keyedTemplate: false, hasSurface});
                } else if (init && ts.isJsxExpression(init) && init.expression) {
                    const expr = init.expression;
                    if (ts.isStringLiteralLike(expr)) {
                        out.push({value: expr.text, dynamic: false, keyedTemplate: false, hasSurface});
                    } else if (ts.isTemplateExpression(expr) && expr.templateSpans.length === 1) {
                        const parsed = parseTemplateTestId(expr.head.text, expr.templateSpans[0].literal.text);
                        out.push({value: expr.getText(source), dynamic: true, keyedTemplate: Boolean(parsed?.valid), hasSurface});
                    } else {
                        out.push({value: expr.getText(source), dynamic: true, keyedTemplate: false, hasSurface});
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
}

/** The legacy-testid ids in one file's source (grammar ids and surface-paired ids excluded). */
export function legacyIds(content: string, fileName = 'f.tsx'): string[] {
    if (!content.includes('data-testid')) {
        return [];
    }
    const source = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
    const ids: string[] = [];
    for (const el of elementsWithTestId(source)) {
        if (el.hasSurface) {
            continue;
        }
        if (!el.dynamic && el.value !== undefined && parseTestId(el.value).valid) {
            continue;
        }
        if (el.keyedTemplate) {
            continue;
        }
        ids.push(el.dynamic ? `<dyn:${el.value}>` : (el.value ?? ''));
    }
    return ids.sort();
}

function hashIds(ids: string[]): string {
    return createHash('sha256').update(ids.join('\n')).digest('hex').slice(0, 12);
}

function collectFiles(roots: string[], cwd: string): string[] {
    const out = new Set<string>();
    for (const root of roots) {
        for (const file of globSync('**/*.{ts,tsx,js,jsx}', {
            cwd: root,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.stories.*', '**/*.d.ts'],
        })) {
            out.add(file);
        }
    }
    return [...out].sort();
}

/** Compute the per-file legacy-testid baseline for the given webapp roots (or in-memory files for tests). */
export function computeBaseline(options: {roots: string[]; cwd: string; files?: Record<string, string>}): Baseline {
    const baseline: Baseline = {};
    const paths = options.files ? Object.keys(options.files).sort() : collectFiles(options.roots, options.cwd);
    for (const file of paths) {
        const content = options.files ? options.files[file] : readFileSync(file, 'utf8');
        const rel = options.files ? file : relative(options.cwd, file);
        const ids = legacyIds(content, rel);
        if (ids.length > 0) {
            baseline[rel] = {count: ids.length, hash: hashIds(ids)};
        }
    }
    return baseline;
}

export type RatchetDiff = {
    grown: Array<{file: string; from: number; to: number}>;
    shrunk: Array<{file: string; from: number; to: number}>;
    changed: Array<{file: string; count: number}>;
};

/** Compare a freshly computed baseline against the committed one. A file absent from the committed baseline has count 0. */
export function diffBaseline(committed: Baseline, current: Baseline): RatchetDiff {
    const grown: RatchetDiff['grown'] = [];
    const shrunk: RatchetDiff['shrunk'] = [];
    const changed: RatchetDiff['changed'] = [];
    for (const file of new Set([...Object.keys(committed), ...Object.keys(current)])) {
        const from = committed[file]?.count ?? 0;
        const to = current[file]?.count ?? 0;
        if (to > from) {
            grown.push({file, from, to});
        } else if (to < from) {
            shrunk.push({file, from, to});
        } else if (committed[file]?.hash !== current[file]?.hash && from > 0) {
            changed.push({file, count: to});
        }
    }
    const byFile = (a: {file: string}, b: {file: string}) => a.file.localeCompare(b.file);
    return {grown: grown.sort(byFile), shrunk: shrunk.sort(byFile), changed: changed.sort(byFile)};
}

/** Serialize a baseline as one file per line, keys sorted, so diffs stay small and merge conflicts are per-file. */
export function serializeBaseline(baseline: Baseline): string {
    const keys = Object.keys(baseline).sort();
    const lines = keys.map((k) => `    ${JSON.stringify(k)}: {"count": ${baseline[k].count}, "hash": ${JSON.stringify(baseline[k].hash)}}`);
    return `{\n${lines.join(',\n')}\n}\n`;
}
