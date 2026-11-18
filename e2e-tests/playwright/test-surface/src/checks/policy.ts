// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CheckOptions} from '../checks.ts';
import type {AllowEntry, StrictException} from '../config.ts';
import {allowCovers} from '../grammar.ts';
import type {Diagnostic, Loc} from '../manifest_types.ts';

/** Whether a finding at `at` (for `template`, its value brought `via` other files) is an error rather than a warning. */
export type StrictAt = (at: Loc, template?: string, via?: Loc[]) => boolean;

/** Where a diagnostic comes from: its place, and the places its testid's value came through. */
const provenance = (d: Diagnostic): Loc[] => [d.at, ...(d.via ?? [])];

/**
 * Strict by path or by template: under a strict path (unless a strict exception covers the place or a value's
 * provenance, `via`), or under a strict template scope.
 */
export function strictAtFor(opts: Pick<CheckOptions, 'strictPaths' | 'strictScopes' | 'strictExceptions'>): StrictAt {
    const exceptions = opts.strictExceptions ?? [];

    // a diagnostic is the excepted path's when it is there, or when the testid's value came through it (`via`)
    const exceptionFor = (locs: Loc[]) => exceptions.find((e) => locs.some((l) => l.startsWith(e.path)));
    return (at, template, via = []) => (opts.strictPaths.some((p) => at.startsWith(p)) && !exceptionFor([at, ...via])) || (template !== undefined && opts.strictScopes.some((s) => template.startsWith(s)));
}

/**
 * `checks.allow`: matching errors become warnings carrying the reason; an entry that matches nothing is reported, so
 * the list can't go stale. An entry matches on the diagnostic's rule and template (a keyed template covers each of
 * its keys), never on its wording.
 */
export function applyAllow(out: Diagnostic[], allow: AllowEntry[], configAt: string) {
    for (const a of allow) {
        let used = false;
        for (const d of out) {
            if (d.rule === a.rule && d.template !== undefined && allowCovers(a.template, d.template)) {
                used = true;
                if (d.severity === 'error') {
                    d.severity = 'warning';
                    d.waived = {by: 'allow', reason: a.reason};
                }
            }
        }
        if (!used) {
            out.push({rule: 'allow', severity: 'warning', at: configAt, message: `checks.allow entry for "${a.template}" (${a.rule}) no longer matches anything.`, fix: 'Remove it.'});
        }
    }
}

/**
 * `checks.strictExceptions`: what a strict path would report as errors there is a warning carrying the reason; an
 * entry with nothing left to report is itself reported, so the list only shrinks.
 */
export function applyStrictExceptions(out: Diagnostic[], exceptions: StrictException[], configAt: string) {
    for (const e of exceptions) {
        const here = out.filter((d) => provenance(d).some((l) => l.startsWith(e.path)));
        for (const d of here) {
            if (d.severity === 'warning' && !d.waived) {
                d.waived = {by: 'strict-exception', reason: e.reason};
            }
        }
        if (!here.length) {
            out.push({rule: 'strict-exceptions', severity: 'warning', at: configAt, message: `checks.strictExceptions entry for "${e.path}" no longer has anything to report.`, fix: 'Remove it: the path passes strict.'});
        }
    }
}
