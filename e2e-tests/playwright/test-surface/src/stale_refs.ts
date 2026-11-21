// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {escapeRegExp} from './ast.ts';
import {relativeToRoot, type Config} from './config.ts';
import {KEY_PLACEHOLDER} from './grammar.ts';
import type {Diagnostic, Manifest} from './manifest_types.ts';
import {templateMatcher} from './report.ts';

/** Test code: TypeScript and JavaScript, with or without JSX, as ES or CommonJS modules (not declaration files). */
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** The code files under `roots`, skipping dependencies, build output and generated page objects. */
export function codeFiles(roots: string[]): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) {
            return;
        }
        for (const e of fs.readdirSync(d, {withFileTypes: true})) {
            if (e.name === 'node_modules' || e.name === 'generated' || e.name === 'dist' || e.name.startsWith('.')) {
                continue;
            }
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (CODE_FILE.test(e.name) && !e.name.endsWith('.d.ts')) {
                out.push(p);
            }
        }
    };
    roots.forEach(walk);
    return out.sort();
}

/**
 * Testids that test code under the configured roots queries (Playwright's `getByTestId('…')` and `getByTestId(/…/)`,
 * Cypress's and Testing Library's `findByTestId` / `queryAllByTestId` and the like, `[data-testid…="…"]`) and that no
 * element in the manifest can render: usually a test left behind by a rename. The roots are the migrated test code, so
 * each is an error, as is a root that doesn't exist; they are not stored in the manifest (they depend on the tests, not
 * the app). A lookup written in full is matched exactly against every template, however short; a partial one (a
 * prefix, a regex, a template literal) only against templates whose literal part is long enough, since a mostly
 * runtime template (`{key}`, `{key}--text`) would match anything.
 */
export function staleReferences(manifest: Manifest, config: Config): Diagnostic[] {
    const sr = config.staleReferences;
    if (!sr) {
        return [];
    }
    const out: Diagnostic[] = [];
    for (const root of sr.roots) {
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            out.push({
                rule: 'stale-reference',
                severity: 'error',
                at: relativeToRoot(config, config.configPath),
                message: `staleReferences root ${relativeToRoot(config, root)} is not a directory: its tests would not be checked.`,
                fix: 'Point the root at the test directory (roots are relative to the config), or remove it.',
            });
        }
    }
    const exact = manifest.elements.flatMap((e) => {
        const pattern = templateMatcher(e.template, {minLiteral: 0});
        return pattern ? [pattern] : [];
    });
    const usable = manifest.elements.flatMap((e) => {
        const pattern = templateMatcher(e.template, {minLiteral: 8});
        return pattern ? [{template: e.template, pattern}] : [];
    });

    // sample keys of a few shapes, so a regex query like `time:\d{4}--menuitem` can match a keyed template
    const concrete = usable.flatMap((e) => (e.template.includes(KEY_PLACEHOLDER) ? ['x1', '0900', '0', '1', 'a_b'].map((k) => e.template.split(KEY_PLACEHOLDER).join(k)) : [e.template]));
    const patterns = usable.map((e) => e.pattern);
    const matchesSome = (probe: RegExp, lit?: string) => (lit !== undefined && patterns.some((t) => t.test(lit))) || concrete.some((c) => probe.test(c));

    const query = /\b(?:get|query|find)(?:All)?ByTestId\(\s*(?:(['"`])((?:(?!\1).)*)\1|\/((?:\\.|[^/\n])+)\/[a-z]*)|\[data-testid([\^$*]?)=["'`]?((?:[^"'`\]])*)/g;
    for (const file of codeFiles(sr.roots)) {
        const rel = relativeToRoot(config, file);
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(query)) {
            const [, , quoted, regex, op, attr] = m;
            let ok: boolean;
            let shown: string;
            if (regex === undefined) {
                const lit = quoted ?? attr;
                if (!lit) {
                    continue;
                }
                shown = lit;

                // a template literal's ${…} can be anything
                const body = escapeRegExp(lit).replace(/\\\$\\\{[^}]*\\\}/g, '.*');

                // `^=` is a prefix, `$=` a suffix, `*=` a substring; a lookup written in full is the testid itself
                const probe = new RegExp((op === '$' || op === '*' ? '' : '^') + body + (op === '^' || op === '*' ? '' : '$'));
                const full = !op && !lit.includes('${');
                ok = (full && exact.some((t) => t.test(lit))) || matchesSome(probe, op ? undefined : lit.replace(/\$\{[^}]*\}/g, 'x1'));
            } else {
                shown = `/${regex}/`;
                let re: RegExp;
                try {
                    re = new RegExp(regex);
                } catch {
                    continue;
                }
                ok = matchesSome(re);
            }
            if (ok) {
                continue;
            }
            const allowed = sr.allow.find((a) => a.testid === shown && (!a.file || rel.endsWith(a.file)));
            if (allowed) {
                continue;
            }
            const line = src.slice(0, m.index).split('\n').length;
            out.push({
                rule: 'stale-reference',
                severity: 'error',
                at: `${rel}:${line}`,
                message: `"${shown}" matches no testid the app renders (renamed or removed?).`,
                fix: 'Use the testid the app renders now (or the generated page objects); if this one is fine, add it to staleReferences.allow with the reason.',
            });
        }
    }
    return out;
}
