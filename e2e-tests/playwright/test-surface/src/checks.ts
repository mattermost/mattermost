// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The checks over a scan, as a pipeline: keep what is reachable, run every rule (`checks/rules.ts`), apply
 * `checks.allow` and `checks.strictExceptions` (`checks/policy.ts`), then keep one diagnostic per place, rule and
 * message (an error wins) in a stable order. Whether two testid sites can render together, which the duplicates
 * rule asks, is `checks/exclusive.ts`.
 */

import {applyAllow, applyStrictExceptions, strictAtFor} from './checks/policy.ts';
import {RULES} from './checks/rules.ts';
import {cmp, cmpLoc} from './compare.ts';
import type {AllowEntry, KeyFieldAllow, KeyValue, PluginConfig, StrictException} from './config.ts';
import type {Diagnostic} from './manifest_types.ts';
import type {ScanResult} from './scan.ts';

export {exclusive} from './checks/exclusive.ts';
export {slotMatches, suggest} from './checks/rules.ts';
export {roleSuffixFor} from './role_table.ts';

export type CheckOptions = {

    /** Template prefixes where grammar diagnostics are errors. Elsewhere they are warnings. */
    strictScopes: string[];

    /** Files (repo-relative prefixes) where legacy testids are errors. */
    strictPaths: string[];

    /** Allowed files or folders under a strict path that stay warnings, each with its reason. */
    strictExceptions?: StrictException[];

    /** Allowed exceptions: a rule's error on one testid becomes a warning that carries the reason. */
    allow?: AllowEntry[];

    /** Entity fields that may key a testid: id-like names, and allowed others. */
    keyFields?: {pattern: RegExp; allow: KeyFieldAllow[]};
    keyValues?: KeyValue[];

    /** Plugin mode: the plugin's key and the host versions it supports. */
    plugin?: PluginConfig | null;

    /** The declared host plugin slot contract, independent of the report's generated shape. */
    pluginSlots?: Record<string, {template: string; registry?: string[]}> | null;

    /** Where config entries are reported (the config file, relative to the root). */
    configAt: string;
};

/** Runs every check over a scan; returns its diagnostics and the scan's own, sorted (they aren't part of the manifest). */
export function runChecks(input: ScanResult, opts: CheckOptions): Diagnostic[] {
    const scan = reachableOnly(input);
    const ctx = {scan, opts, strictAt: strictAtFor(opts)};
    const out = [...scan.diagnostics, ...RULES.flatMap((rule) => rule(ctx))];
    applyAllow(out, opts.allow ?? [], opts.configAt);
    applyStrictExceptions(out, opts.strictExceptions ?? [], opts.configAt);
    return finalize(out);
}

/** The scan without what its entries can't reach: sites, values, emissions, elements and the scan's own diagnostics. */
function reachableOnly(input: ScanResult): ScanResult {
    const reachable = input.isReachable ?? (() => true);
    return {...input,
        sites: input.sites.filter((site) => reachable(site.at)).map((site) => ({...site, values: site.values.filter((value) => reachable(site.at, value.via))})),
        emissions: input.emissions.filter((emission) => reachable(emission.site.at, emission.via)),
        manifest: {...input.manifest, elements: input.manifest.elements.filter((element) => !element.unreachable)},
        diagnostics: input.diagnostics.filter((diagnostic) => reachable(diagnostic.at, diagnostic.via)),
    };
}

/** One diagnostic per place, rule and message (an error wins over a warning with the same key), sorted. */
function finalize(out: Diagnostic[]): Diagnostic[] {
    const unique = new Map<string, Diagnostic>();
    for (const d of out) {
        const k = `${d.at}|${d.rule}|${d.message}`;
        const kept = unique.get(k);
        if (!kept || (kept.severity !== 'error' && d.severity === 'error')) {
            unique.set(k, d);
        }
    }
    return [...unique.values()].sort((a, b) => cmpLoc(a.at, b.at) || cmp(a.rule, b.rule) || cmp(a.message, b.message));
}
