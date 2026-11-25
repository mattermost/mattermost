// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync, writeFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';

import {globSync} from 'glob';
import ts from 'typescript';

/**
 * Retire legacy `data-testid`s in favour of the typed surface. `driftMap` pairs each legacy testid to the surface id on
 * the same element. Renaming the legacy testid to the surface id (in the component AND its Jest/Cypress lookups) keeps
 * the lookups working through `data-testid` while removing the arbitrary legacy spelling and the testid/surface drift.
 * Dry-run by default: it classifies every Jest/Cypress file as auto-migratable or needing hand edits and only writes
 * when `apply` is set. This proves the retirement path without mass-rewriting legacy tests.
 */
export type MigrateResult = {
    summary: {
        renamable: number;
        jestFiles: number;
        cypressFiles: number;
        autoMigratable: number;
        needsHandEdits: number;
        unrelated: number;
        filesWritten: number;
        references: number;
    };
    perFile: Array<{file: string; status: 'auto' | 'hand' | 'unrelated'; rewrites: number; blockers: string[]}>;
};

const TESTID_METHOD = /^(?:getByTestId|findByTestId|queryByTestId|findAllByTestId|getAllByTestId)$/;
const EXACT_TESTID_CSS = /\[data-testid=(?:"([^"]+)"|'([^']+)')\]/;

type Ref = {id?: string; dynamic: boolean; start: number; end: number};

/** Literal and dynamic data-testid lookups in one spec/test file. */
function findTestIdRefs(source: ts.SourceFile): Ref[] {
    const refs: Ref[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const method = ts.isPropertyAccessExpression(callee)
                ? callee.name.text
                : ts.isIdentifier(callee)
                  ? callee.text
                  : '';
            const arg = node.arguments[0];
            if (TESTID_METHOD.test(method)) {
                if (arg && ts.isStringLiteralLike(arg)) {
                    refs.push({id: arg.text, dynamic: false, start: arg.getStart(source) + 1, end: arg.getEnd() - 1});
                } else if (arg) {
                    refs.push({dynamic: true, start: arg.getStart(source), end: arg.getEnd()});
                }
            }
            const isCssGet =
                (method === 'get' && ts.isPropertyAccessExpression(callee) && callee.expression.getText(source) === 'cy') ||
                method === 'locator';
            if (isCssGet && arg && ts.isStringLiteralLike(arg)) {
                const m = EXACT_TESTID_CSS.exec(arg.text);
                if (m) {
                    const id = m[1] ?? m[2];
                    const idx = arg.text.indexOf(id);
                    refs.push({id, dynamic: false, start: arg.getStart(source) + 1 + idx, end: arg.getStart(source) + 1 + idx + id.length});
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return refs;
}

function collect(roots: string[], cwd: string, pattern: string): string[] {
    const out = new Set<string>();
    for (const root of roots) {
        for (const file of globSync(pattern, {cwd: resolve(cwd, root), absolute: true, ignore: ['**/node_modules/**', '**/dist/**']})) {
            out.add(file);
        }
    }
    return [...out].sort();
}

function rewriteLiterals(content: string, refs: Ref[], renameMap: Record<string, string>): {text: string; count: number} {
    let count = 0;
    const edits = refs
        .filter((r) => !r.dynamic && r.id !== undefined && renameMap[r.id])
        .sort((a, b) => b.start - a.start);
    let text = content;
    for (const r of edits) {
        text = text.slice(0, r.start) + renameMap[r.id!] + text.slice(r.end);
        count++;
    }
    return {text, count};
}

export function migrateTestIds(options: {
    webappRoots: string[];
    specRoots: string[];
    cwd: string;
    driftMap: Record<string, string>;
    apply: boolean;
    only?: string;
}): MigrateResult {
    const renameMap: Record<string, string> = {};
    for (const [legacy, surface] of Object.entries(options.driftMap)) {
        if (legacy !== '_doc') {
            renameMap[legacy] = surface;
        }
    }

    const jest = collect(options.webappRoots, options.cwd, '**/*.test.{ts,tsx}');
    const cypress = collect([resolve(options.cwd, 'e2e-tests/cypress/tests')], options.cwd, '**/*.{js,ts}');
    const specs = collect(options.specRoots, options.cwd, '**/*.{ts,tsx}');
    const testFiles = [...new Set([...jest, ...cypress, ...specs])];

    const perFile: MigrateResult['perFile'] = [];
    let autoMigratable = 0;
    let needsHandEdits = 0;
    let unrelated = 0;
    let filesWritten = 0;
    let references = 0;

    for (const file of testFiles) {
        if (options.only && !file.includes(options.only)) {
            continue;
        }
        const content = readFileSync(file, 'utf8');
        if (!content.includes('TestId') && !content.includes('data-testid')) {
            continue;
        }
        const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        const refs = findTestIdRefs(source);
        const rewritable = refs.filter((r) => !r.dynamic && r.id !== undefined && renameMap[r.id]);
        references += rewritable.length;
        const blockers: string[] = [];
        for (const r of refs) {
            if (r.dynamic) {
                blockers.push('dynamic lookup');
            } else if (r.id !== undefined && !renameMap[r.id] && isLegacy(r.id)) {
                blockers.push(`legacy id without a surface counterpart: ${r.id}`);
            }
        }
        let status: 'auto' | 'hand' | 'unrelated';
        if (rewritable.length === 0) {
            status = 'unrelated';
            unrelated++;
        } else if (blockers.length === 0) {
            status = 'auto';
            autoMigratable++;
        } else {
            status = 'hand';
            needsHandEdits++;
        }
        if (options.apply && status === 'auto') {
            const {text, count} = rewriteLiterals(content, refs, renameMap);
            if (count > 0) {
                writeFileSync(file, text);
                filesWritten += count > 0 ? 1 : 0;
            }
        }
        perFile.push({file: relative(options.cwd, file), status, rewrites: rewritable.length, blockers: [...new Set(blockers)]});
    }

    // When applying, also rename the legacy data-testid in webapp components to the surface id (drift -> consistent).
    if (options.apply) {
        for (const file of collect(options.webappRoots, options.cwd, '**/*.{ts,tsx}')) {
            if (options.only && !file.includes(options.only)) {
                continue;
            }
            const content = readFileSync(file, 'utf8');
            let text = content;
            for (const [legacy, surface] of Object.entries(renameMap)) {
                text = text.split(`data-testid='${legacy}'`).join(`data-testid='${surface}'`).split(`data-testid="${legacy}"`).join(`data-testid="${surface}"`);
            }
            if (text !== content) {
                writeFileSync(file, text);
                filesWritten++;
            }
        }
    }

    return {
        summary: {
            renamable: Object.keys(renameMap).length,
            jestFiles: jest.length,
            cypressFiles: cypress.length,
            autoMigratable,
            needsHandEdits,
            unrelated,
            filesWritten,
            references,
        },
        perFile,
    };
}

/** A heuristic "looks like a legacy (non-grammar) testid" so unrelated grammar refs do not count as blockers. */
function isLegacy(id: string): boolean {
    return !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+/.test(id);
}
