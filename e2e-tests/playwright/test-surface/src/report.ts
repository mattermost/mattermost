// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {escapeRegExp} from './ast.ts';
import {cmp} from './compare.ts';
import {KEY_PLACEHOLDER} from './grammar.ts';
import type {Diagnostic, Manifest} from './manifest_types.ts';
import type {ScanResult, ScanStats} from './scan.ts';

export function writeIfChanged(file: string, text: string): boolean {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) {
        return false;
    }
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text);
    return true;
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');

/**
 * Error counts per rule and the sizes of the configured exception lists, with warning and truncation counts for provenance.
 */
export function diagnosticCounts(stats: ScanStats, diagnostics: Diagnostic[] = [], checks?: {allow: unknown[]; strictExceptions: unknown[]; keyFields?: {allow: Array<{freeForm?: boolean}>}}): {ceilings: Record<string, number>; warnings: Record<string, number>; errors: Record<string, number>} {
    const n = (k: string) => (typeof stats[k] === 'number' ? stats[k] as number : 0);
    const warnings: Record<string, number> = {};
    for (const d of diagnostics.filter((x) => x.severity === 'warning').sort((a, b) => cmp(a.rule, b.rule))) {
        warnings[d.rule] = (warnings[d.rule] ?? 0) + 1;
    }
    const errors: Record<string, number> = {};
    for (const diagnostic of diagnostics.filter((d) => d.severity === 'error')) {
        errors[diagnostic.rule] = (errors[diagnostic.rule] ?? 0) + 1;
    }
    return {
        errors,
        ceilings: {
            ...(checks ? {allow: checks.allow.length, strictExceptions: checks.strictExceptions.length} : {}),
            keyFields: checks?.keyFields?.allow.length ?? 0,
            freeFormKeyFields: checks?.keyFields?.allow.filter((entry) => entry.freeForm).length ?? 0,
            truncatedTestIdSites: n('truncatedTestIdSites'),
            strictExceptionWarnings: diagnostics.filter((d) => d.severity === 'warning' && d.waived?.by === 'strict-exception').length,
        },
        warnings,
    };
}

export function summary(result: ScanResult, diagnostics: Diagnostic[]): string {
    const s = result.stats;
    const n = (k: string) => (typeof s[k] === 'number' ? s[k] as number : 0);
    const byRule = new Map<string, {error: number; warning: number}>();
    for (const d of diagnostics) {
        const r = byRule.get(d.rule) ?? {error: 0, warning: 0};
        r[d.severity]++;
        byRule.set(d.rule, r);
    }
    const lines = [
        `program: ${n('files')} files in scope, ${n('components')} components with usages`,
        `testid sites: ${n('sites')} (${n('domSites')} on DOM elements, ${n('componentSites')} on components [${n('forwardedComponentSites')} forwarded], ${n('objectSites')} object props)`,
        `DOM sites resolved: ${n('domResolved')}/${n('domSites')} (${pct(n('domResolved'), n('domSites'))}); from props ${n('domFromPropsResolved')}/${n('domFromProps')} (${pct(n('domFromPropsResolved'), n('domFromProps'))})`,
        `elements: ${n('elements')} templates, ${n('grammarElements')} follow the grammar; ${n('elementsWithRole')} with an ARIA role`,
        `  render conditions ${n('elementsWithConditions')}`,
        `client: ${n('apiCalls')} ${result.urlVersion ?? 'API'} fetches, ${n('matchedToOpenAPI')} match an OpenAPI operation (${pct(n('matchedToOpenAPI'), n('apiCalls'))}); ${result.specGaps.length} endpoints missing from the spec`,
        `diagnostics: ${diagnostics.filter((d) => d.severity === 'error').length} errors, ${diagnostics.filter((d) => d.severity === 'warning').length} warnings`,
        ...[...byRule.entries()].sort().map(([r, c]) => `  ${r.padEnd(12)} ${String(c.error).padStart(5)} errors ${String(c.warning).padStart(5)} warnings`),
        `timings ms: ${JSON.stringify(s.timings)}`,
    ];
    return lines.join('\n');
}

/** One diagnostic as printed: where, the rule, what is wrong, and how to fix it. */
export function formatDiagnostic(d: Diagnostic): string {
    const mark = d.severity === 'error' ? '✗' : '!';
    const waived = d.waived ? ` ${d.waived.by === 'allow' ? 'Allowed' : 'Not strict'}: ${d.waived.reason}` : '';
    return `${mark} ${d.at}  [${d.rule}]\n  ${d.message}${waived}${d.fix ? `\n  ${d.fix}` : ''}`;
}

/** Report files for people: spec gaps, unresolved/unscoped testids, duplicates, everything else. */
export function writeReports(dir: string, result: ScanResult, diagnostics: Diagnostic[], unrendered: Array<{testId: string; files: string[]}> = [], checks?: {allow: unknown[]; strictExceptions: unknown[]}) {
    fs.mkdirSync(dir, {recursive: true});
    const write = (name: string, lines: string[]) => fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n');
    write('summary.txt', [summary(result, diagnostics), `Not reachable from the configured entries: ${result.notReachableFiles?.length ?? 0} files (not_reachable.txt)`]);
    write('counts.json', [JSON.stringify(diagnosticCounts(result.stats, diagnostics, checks), null, 2)]);

    // every diagnostic, warnings included, for CI to keep as an artifact (the manifest doesn't hold them)
    write('diagnostics.json', [JSON.stringify(diagnostics, null, 2)]);

    // the exact places behind the manifest's `file#Component` names
    const locations = Object.fromEntries(result.manifest.elements.map((e) => [e.template, {at: [e.component.at, ...(e.alsoAt ?? [])], via: [...new Set(e.instances.map((i) => i.via.join(' < ')).filter(Boolean))]}]));
    write('locations.json', [JSON.stringify(locations, null, 2)]);
    write('not_reachable.txt', ['Test ids in files not reachable from the configured entries:', ...(result.notReachableFiles ?? [])]);
    write('spec_gaps.txt', result.specGaps.map((g) => `${g.client}: ${g.verb} ${g.path}`));
    write('unrendered_test_ids.txt', unrendered.map((u) => `${u.testId}\n    ${u.files.join('\n    ')}`));
    const rules = [...new Set(diagnostics.map((d) => d.rule))].sort();
    for (const r of rules) {
        write(`diagnostics_${r.replace(/[^a-z]+/g, '_')}.txt`, diagnostics.filter((d) => d.rule === r).map(formatDiagnostic));
    }
}

/**
 * The testids a template renders, as a regular expression (`{key}` is one or more characters). Null for a template
 * that is mostly runtime data, so it would match nearly anything: one that starts with its key, or whose literal text
 * is shorter than `minLiteral`.
 */
export function templateMatcher(template: string, {minLiteral = 0} = {}): RegExp | null {
    const literals = template.split(KEY_PLACEHOLDER);
    if (literals.length > 1 && (!literals[0] || literals.join('').length < minLiteral)) {
        return null;
    }
    return new RegExp('^' + literals.map(escapeRegExp).join('.+') + '$');
}

/**
 * Testids that unit tests query but no template in the manifest produces. An absence check on one
 * (`expect(queryByTestId('x')).not.toBeInTheDocument()`) can't fail: the usual trace of a rename
 * that missed a test. Testids a mock in the same test file renders are left out.
 */
export function unrenderedTestIds(manifest: Manifest, files: Array<{path: string; text: string}>): Array<{testId: string; files: string[]}> {
    const patterns = manifest.elements.map((e) => templateMatcher(e.template)).filter((p): p is RegExp => p !== null);
    const found = new Map<string, Set<string>>();
    const query = /(?:get|query|find)(?:All)?ByTestId\(\s*['"]([^'"]+)['"]\s*\)|\[data-testid="([^"]+)"\]/g;
    for (const f of files) {
        // a mock in the test itself renders it (`jest.mock(..., () => <div data-testid='x'/>)`)
        const rendered = new Set([...f.text.matchAll(/(?<!\[)data-testid['"]?\s*[=:]\s*\{?\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
        for (const m of f.text.matchAll(query)) {
            const id = m[1] ?? m[2];
            if (!rendered.has(id) && !patterns.some((p) => p.test(id))) {
                const s = found.get(id) ?? new Set<string>();
                s.add(f.path);
                found.set(id, s);
            }
        }
    }
    return [...found.entries()].sort((a, b) => cmp(a[0], b[0])).map(([testId, fs2]) => ({testId, files: [...fs2].sort()}));
}
