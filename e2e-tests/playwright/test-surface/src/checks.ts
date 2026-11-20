// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {strip} from './ast.ts';
import {cmp, cmpLoc} from './compare.ts';
import type {AllowEntry, KeyFieldAllow, KeyValue, PluginConfig, StrictException} from './config.ts';
import {allowCovers, isGrammarError, KEY_PLACEHOLDER, toWord} from './grammar.ts';
import {MAX_TEMPLATE_VALUES} from './limits.ts';
import type {AriaRole, Diagnostic, Element, Loc, Manifest, RuleName} from './manifest_types.ts';
import {entryDriverFits, requiresRoleFit} from './role_table.ts';
import {alwaysReturns} from './scan/elements.ts';
import {isUnscoped, readHostSlots, type Emission, type ScanResult, type Site} from './scan.ts';
import {typescript} from './typescript.ts';
import {templateOf, TOO_MANY_VALUES} from './values.ts';

import {TEST_ID_ROLES, type TestIdRole} from '../lint/grammar.js';

export type CheckOptions = {

    /** Template prefixes where grammar diagnostics are errors. Elsewhere they are warnings. */
    strictScopes: string[];

    /** Files (repo-relative prefixes) where legacy testids are errors. */
    strictPaths: string[];

    /** Allowed files or folders under a strict path that stay warnings, each with its reason. */
    strictExceptions?: StrictException[];

    /** Maximum distinct warnings covered by strict path exceptions; lower it as legacy findings are fixed. */
    strictExceptionWarningCeiling?: number;

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

/** The roles an element may have for a suffix besides the suffix itself (a `--button` may be a toggle button…). */
const ROLE_EQUIV: Partial<Record<TestIdRole, readonly AriaRole[]>> = {
    togglebutton: ['button'],
    textbox: ['searchbox'],
    searchbox: ['textbox'],
    menuitem: ['menuitemcheckbox', 'menuitemradio'],
};

const isTestIdRole = (role: string): role is TestIdRole => (TEST_ID_ROLES as readonly string[]).includes(role);

/** Roles of content a user doesn't operate: `--text` fits them, and they need no suffix. */
const NON_INTERACTIVE = new Set<AriaRole | null>([null, 'none', 'presentation', 'text', 'img', 'list', 'listitem', 'heading', 'grid', 'table', 'cell', 'columnheader', 'row', 'gridcell', 'status', 'alert', 'tooltip', 'separator', 'region', 'form', 'navigation', 'dialog', 'alertdialog', 'menu', 'tabpanel', 'progressbar', 'main', 'banner', 'complementary', 'contentinfo', 'log', 'feed', 'group', 'article']);

/** Runs every check over a scan; returns its diagnostics and the scan's own, sorted (they aren't part of the manifest). */
export function runChecks(input: ScanResult, opts: CheckOptions): Diagnostic[] {
    const reachable = input.isReachable ?? (() => true);
    const result = {...input,
        sites: input.sites.filter((site) => reachable(site.at)).map((site) => ({...site, values: site.values.filter((value) => reachable(site.at, value.via))})),
        emissions: input.emissions.filter((emission) => reachable(emission.site.at, emission.via)),
        manifest: {...input.manifest, elements: input.manifest.elements.filter((element) => !element.unreachable)},
    };
    const out: Diagnostic[] = result.diagnostics.filter((diagnostic) => reachable(diagnostic.at, diagnostic.via));
    const exceptions = opts.strictExceptions ?? [];

    // a diagnostic is the excepted path's when it is there, or when the testid's value came through it (`via`)
    const exceptionFor = (locs: Loc[]) => exceptions.find((e) => locs.some((l) => l.startsWith(e.path)));
    const strictAt: StrictAt = (at, template, via = []) => (opts.strictPaths.some((p) => at.startsWith(p)) && !exceptionFor([at, ...via])) || (template !== undefined && opts.strictScopes.some((s) => template.startsWith(s)));
    const push: Push = (rule, strict, at, message, fix, about = {}) => {
        const {template, key, via} = about;
        out.push({rule, severity: strict ? 'error' : 'warning', at, message, ...(fix ? {fix} : {}), ...(template === undefined ? {} : {template}), ...(key ? {key} : {}), ...(via?.length ? {via} : {})});
    };

    checkSites(result.sites, push, strictAt);
    const usedKeyFields = new Set<KeyFieldAllow>();
    checkEmissions(result.emissions, push, strictAt, opts, usedKeyFields);
    const usedKeyValues = new Set(result.emissions.flatMap((emission) => (emission.value.k === 'pat' ? emission.value.parts.flatMap((part) => (typeof part !== 'string' && part.gap.keyValueEntry ? [part.gap.keyValueEntry] : [])) : [])));
    for (const entry of opts.keyValues ?? []) {
        if (!usedKeyValues.has(entry)) {
            push('allow', true, opts.configAt, `keyValues entry for ${entry.function} in ${entry.module} no longer matches any key.`, 'Remove it.');
        }
    }
    for (const a of (opts.keyFields?.allow ?? []).filter((x) => !usedKeyFields.has(x))) {
        push('allow', true, opts.configAt, `checks.keyFields.allow entry for ${a.entity}.${a.field}${a.module ? ` in ${a.module}` : ''} no longer matches any key.`, 'Remove it.');
    }
    checkDuplicates(result.emissions, push, strictAt, result.usageNodeAt, result.propRenderUses, result.uniqueMountChain);
    checkPluginSlots(result.manifest, opts.pluginSlots ?? null, opts.configAt, push);
    for (const el of result.manifest.elements) {
        if (el.key?.kind === 'string') {
            push('key-origin', true, el.component.at, `Key of "${el.template}" remains an unresolved string without a strict origin.`, 'Resolve the key at its mount to an id, fixed set or index.', {template: el.template});
        }
        if (el.grammar && !el.scope.length && !result.manifest.elements.some((other) => other.grammar && other.scope[0] === el.name)) {
            push('unscoped', false, el.component.at, `"${el.template}" has no declared parts or children.`, 'Declare members beneath the scope to include it in the surface report.', {template: el.template});
        }
    }
    if (opts.plugin) {
        checkPlugin(result.manifest, push, strictAt, opts.plugin, opts.configAt);
    }
    applyAllow(out, opts.allow ?? [], opts.configAt);
    applyStrictExceptions(out, exceptions, (d) => [d.at, ...(d.via ?? [])], opts.configAt);

    const seen = new Set<string>();
    const checked = out.
        filter((d) => {
            const k = `${d.at}|${d.rule}|${d.message}`;
            if (seen.has(k)) {
                return false;
            }
            seen.add(k);
            return true;
        }).
        sort((a, b) => cmpLoc(a.at, b.at) || cmp(a.rule, b.rule) || cmp(a.message, b.message));
    const excepted = checked.filter((d) => d.severity === 'warning' && d.waived?.by === 'strict-exception').length;
    if (opts.strictExceptionWarningCeiling !== undefined) {
        const ceiling = opts.strictExceptionWarningCeiling;
        if (!Number.isSafeInteger(ceiling) || ceiling < 0) {
            checked.push({rule: 'input', severity: 'error', at: opts.configAt, message: 'checks.strictExceptionWarningCeiling must be a nonnegative safe integer.'});
        } else if (excepted > ceiling) {
            checked.push({rule: 'strict-exceptions', severity: 'error', at: opts.configAt, message: `${excepted} excepted warnings exceed checks.strictExceptionWarningCeiling (${ceiling}).`, fix: 'Fix the additional findings; lower the ceiling when legacy warnings are removed.'});
        }
    }
    return checked;
}

/** What a diagnostic is about, beside where: the testid template, its literal key, the usage chain it came through. */
type About = {template?: string; key?: string | null; via?: Loc[]};
type StrictAt = (at: Loc, template?: string, via?: Loc[]) => boolean;

type Push = (rule: RuleName, strict: boolean, at: Loc, message: string, fix?: string, about?: About) => void;

/**
 * `checks.allow`: matching errors become warnings carrying the reason; an entry that matches nothing is reported, so
 * the list can't go stale. An entry matches on the diagnostic's rule and template (a keyed template covers each of
 * its keys), never on its wording.
 */
function applyAllow(out: Diagnostic[], allow: AllowEntry[], configAt: string) {
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
function applyStrictExceptions(out: Diagnostic[], exceptions: StrictException[], provenance: (d: Diagnostic) => Loc[], configAt: string) {
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

/** Whether a slot's template (`*.` for any scope) names a rendered template. */
export function slotMatches(slotTemplate: string, template: string): boolean {
    return slotTemplate.startsWith('*.') ? template.endsWith(slotTemplate.slice(1)) : template === slotTemplate;
}

/** The published plugin slot contract and what the webapp renders agree, both ways (always errors: plugins depend on it). */
function checkPluginSlots(manifest: Manifest, declarations: CheckOptions['pluginSlots'], configAt: string, push: Push) {
    if (!declarations || !Object.keys(declarations).length) {
        return;
    }
    for (const [slot, declaration] of Object.entries(declarations).sort((a, b) => cmp(a[0], b[0]))) {
        const rendered = manifest.elements.filter((e) => slotMatches(declaration.template, e.template));
        const at = `${configAt}#pluginSlots.${slot}`;
        if (!rendered.length) {
            push('plugin-slots', true, at, `Plugin slot "${slot}" (${declaration.template}) is in the published contract, but the webapp no longer renders it.`, 'Render the slot\'s testid again, or remove it from the contract (a breaking change for plugin test packages).', {template: declaration.template});
        }
        for (const e of rendered) {
            const pluginId = (e.key?.kind === 'id' && e.key.value === 'plugin') || (e.key?.kind === 'entity' && e.key.field === 'id' && (/Plugin/).test(e.key.entity ?? ''));
            if (!(pluginId && e.role)) {
                push('plugin-slots', true, e.component.at, `Plugin slot "${slot}" (${e.template}) must be keyed by the raw plugin id and carry a role suffix, but its key is ${e.key ? `a ${e.key.kind} (${e.key.type})` : 'missing'}.`, 'Render the plugin entity id directly as the key and add its --role suffix.', {template: e.template});
            }
        }
    }
    for (const e of manifest.elements) {
        if (e.key?.kind === 'entity' && e.key.field === 'id' && (/Plugin/).test(e.key.entity ?? '') && !Object.values(declarations).some((slot) => slotMatches(slot.template, e.template))) {
            push('plugin-slots', true, e.component.at, `"${e.template}" is keyed by plugin but isn't in the published plugin slot contract.`, 'Add it to the configured plugin slot contract.', {template: e.template});
        }
    }
}

/**
 * Plugin mode: the plugin's testids live under `plugins.<key>` (host slots carry the host's testids), and
 * every host version it supports still renders the slots its registry calls fill (always errors).
 */
function checkPlugin(manifest: Manifest, push: Push, strictAt: StrictAt, plugin: PluginConfig, configAt: string) {
    const scope = plugin.scope;
    for (const e of manifest.elements) {
        if (e.grammar && e.template !== scope && !e.template.startsWith(scope + '.')) {
            push('plugin-scope', strictAt(e.component.at, e.template), e.component.at, `"${e.template}" is outside the plugin's scope "${scope}".`, `Prefix it: "${scope}.${e.template}".`, {template: e.template});
        }
    }
    for (const host of plugin.hosts) {
        const read = readHostSlots(host.report, configAt);
        if ('diagnostic' in read) {
            push('input', true, read.diagnostic.at, read.diagnostic.message, read.diagnostic.fix);
            continue;
        }
        const slots = new Map(read.slots.map((s) => [s.slot, s.template]));
        if (!slots.size) {
            push('plugin-compat', true, configAt, `Host ${host.name}: no plugin slots in ${host.report}.`, 'Point plugin.host.reports at the host surface report.');
            continue;
        }
        for (const used of manifest.plugin?.slotsUsed ?? []) {
            for (const slot of used.slots) {
                const expected = plugin.slotContract[slot]?.template;
                const actual = slots.get(slot);
                if (!actual) {
                    push('plugin-compat', true, used.at, `${used.method}() fills the "${slot}" slot, which host ${host.name} doesn't render.`, `Drop ${host.name} from the supported hosts (raise min_server_version), or stop relying on the slot there.`);
                } else if (expected && actual !== expected) {
                    push('plugin-compat', true, used.at, `${used.method}() fills the "${slot}" slot with template "${expected}", but host ${host.name} declares "${actual}".`, 'Use the host slot template or stop relying on the slot in this host version.');
                }
            }
        }
    }
}

function checkSites(sites: Site[], push: Push, strictAt: StrictAt) {
    for (const s of sites) {
        if (s.forwarded) {
            continue;
        }
        const shown = s.values.map(templateOf).find((t): t is string => t !== null) ?? s.expr?.getText() ?? '';
        for (const v of s.values) {
            const via = v.via?.length ? ` (via ${v.via[0]})` : '';
            if (v.k === 'unres' && v.why === TOO_MANY_VALUES) {
                // eslint-disable-next-line no-template-curly-in-string
                push('truncated', strictAt(s.at), s.at, `"${shown}" can take more than ${MAX_TEMPLATE_VALUES} values${via}; the rest are left out (${v.at}).`, 'Key the testid by one value (`:${id}`) instead of a product of lists, or split it into separate testids.', {template: shown, via: v.via});
            } else if (v.k === 'unres' && v.why === 'missing-template-value') {
                push('undefined', strictAt(s.at, shown, v.via ?? []), s.at, `"${shown}" has a missing interpolation${via} at ${v.at}; it would render the text "undefined".`, 'Make sure the value is always set, or render no testid when it is missing.', {template: shown, via: v.via});
            } else if (v.k === 'unres' || v.k === 'computed') {
                // eslint-disable-next-line no-template-curly-in-string
                push('unresolved', false, s.at, `testid value can't be read statically${via}: ${v.k === 'unres' ? v.why : 'computed'} at ${v.at}.`, 'Build the testid from literals and `:${key}` data, or pass a literal down.', {via: v.via});
            } else if (isUnscoped(v)) {
                // eslint-disable-next-line no-template-curly-in-string
                push('unscoped', strictAt(s.at, undefined, v.via ?? []), s.at, `testid is made entirely of runtime data${via}.`, 'Write the scope and name as literals; runtime data may only fill the key: `scope.name:${value}`.', {via: v.via});
            }
        }
    }
}

function checkEmissions(emissions: Emission[], pushAt: Push, strictAt: StrictAt, opts: CheckOptions, usedKeyFields?: Set<KeyFieldAllow>) {
    for (const e of emissions) {
        const at = e.site.at;
        const strict = strictAt(at, e.template, e.via);
        const push: Push = (rule, isStrict, where, message, fix) => pushAt(rule, isStrict, where, message, fix, {template: e.template, key: e.key, via: e.via});
        if (isUnscoped(e.value)) {
            continue;
        }
        if ((/(^|[^A-Za-z])undefined([^A-Za-z]|$)/).test(e.template) || e.key === 'undefined') {
            push('undefined', strict, at, `"${e.template}" can render the text "undefined"${e.key === 'undefined' ? ' as its key' : ''}${e.via.length ? ` (via ${e.via[0]})` : ''}.`, 'Make sure the value is always set, or render no testid when it is missing.');
        }
        if (isGrammarError(e.parsed)) {
            const suggestion = suggest(e.template, e.landing.aria.role);
            push(e.parsed.rule, strict, at, e.parsed.message, e.parsed.fix + (suggestion ? ` Suggested: "${suggestion}".` : ''));
            continue;
        }
        const role = e.landing.aria.role;
        const suffix = e.parsed.role;
        if (requiresRoleFit(suffix) && suffix) {
            const entryFit = entryDriverFits(suffix, e.landing.textEntry);
            if (entryFit === true) {
                // Typing operates on the native/editable element, independent of its ARIA role.
            } else if (entryFit === false) {
                push('role-fit', strict, at, `"${e.template}" is on a <${tagText(e)}> that does not support the driver's text entry.`, 'Use a fillable native control or contenteditable element.');
            } else if (e.landing.aria.unresolvedRole) {
                for (const known of new Set(e.landing.aria.knownRoles ?? [])) {
                    if (!fits(suffix, known)) {
                        push('role-fit', strict, at, `"${e.template}" can render with role ${known} (<${tagText(e)}>).`, `Render an element with role ${suffix}.`);
                    }
                }
                push('unresolved', false, at, `The role of "${e.template}" cannot be read from its declared props at this mount.`, `Resolve the ${suffix} driver's state/input role at the source.`);
            } else if (role && !fits(suffix, role)) {
                const fit = roleSuffixFor(role);
                push('role-fit', strict, at, `"${e.template}" is on a ${role} (<${tagText(e)}>).`, fit ? `Use --${fit}, or render an element with role ${suffix}.` : `Render an element with role ${suffix}.`);
            } else if (!role && e.landing.tag) {
                push('role-fit', strict, at, `"${e.template}" is on a <${tagText(e)}> with no readable state/input role.`, `Render a native control or an element with role ${suffix}.`);
            }
        }
        if (e.parsed.hasKey) {
            const gaps = e.value.k === 'pat' ? e.value.parts.filter((part) => typeof part !== 'string').map((part) => part.gap) : [];
            const safe = gaps.every((gap) => gap.kind === 'set' || gap.kind === 'number' || (gap.kind === 'id' && !gap.freeForm) || (gap.kind === 'entity' && !opts.keyFields?.allow.some((field) => field.entity === gap.entity && field.field === gap.field && field.freeForm) && !(/Plugin/).test(gap.entity ?? '')));
            const values = [...(e.key === null ? [] : [e.key]), ...gaps.flatMap((gap) => gap.values ?? [])];
            const ambiguous = values.some((value) => TEST_ID_ROLES.some((role) => value.endsWith(`--${role}`)));
            const source = e.site.expr && strip(e.site.expr);
            const literalSuffix = source && typescript.isTemplateExpression(source) ? source.templateSpans.at(-1)!.literal.text : null;
            const writtenRole = literalSuffix === null ? Boolean(suffix) : TEST_ID_ROLES.some((role) => literalSuffix.endsWith(`--${role}`));
            const keyBecameRole = Boolean(suffix && literalSuffix !== null && !writtenRole);
            if (!writtenRole && (!safe || ambiguous || keyBecameRole)) {
                push('key-origin', strict, at, `Key of "${e.template}" needs a role suffix to delimit its raw value.`, 'Append a known --role suffix.');
            }
            const expression = e.site.expr && strip(e.site.expr);
            if (expression && typescript.isTemplateExpression(expression)) {
                const marker = '\u0000';
                const text = expression.head.text + expression.templateSpans.map((span) => marker + span.literal.text).join('');
                const colon = text.indexOf(':');
                if (colon >= 0) {
                    const suffix = e.parsed.role ? `--${e.parsed.role}` : '';
                    const key = text.slice(colon + 1, suffix ? -suffix.length : undefined);
                    if (key.includes(marker) && key !== marker) {
                        push('key-origin', strict, at, `Key of "${e.template}" is assembled from multiple pieces.`, 'Use exactly one interpolation containing an id, set member or index.');
                    }
                }
            }
        }
        for (const g of (e.value.k === 'pat' ? e.value.parts : [])) {
            const allowed = typeof g === 'string' ? undefined : opts.keyFields?.allow.find((entry) => {
                const origin = g.gap.fieldEntry;
                return origin ? entry.entity === origin.entity && entry.field === origin.field && entry.module === origin.module && entry.value === origin.value && Boolean(entry.keys) === Boolean(origin.keys) : !entry.module && entry.entity === g.gap.entity && entry.field === g.gap.field;
            });
            if (allowed) {
                usedKeyFields?.add(allowed);
            }
            if (typeof g !== 'string' && g.gap.kind === 'string') {
                push('key-origin', true, at, `key of "${e.template}" is an open string (${g.gap.expr}: ${g.gap.type}${g.gap.from ? `, from ${g.gap.from}` : ''}).`, 'Key from a fixed set (literal union / as const), an entity id (channel.id), or type it.');
            }

            // an entity field that isn't id-like (a status's `text`, an option's `value`) may not identify the entity,
            // or may change with the language: only allowed ones pass
            if (typeof g !== 'string' && (g.gap.kind === 'entity' || g.gap.kind === 'id') && g.gap.entity && g.gap.field && opts.keyFields && !opts.keyFields.pattern.test(g.gap.field)) {
                if (!allowed) {
                    push('key-origin', strict, at, `key of "${e.template}" is ${g.gap.entity}.${g.gap.field} (${g.gap.expr}), which isn't an id-like field: it may not tell items apart, or may change with the language.`, `Key by an id-like field (${opts.keyFields.pattern.source}), or add {"entity": "${g.gap.entity}", "field": "${g.gap.field}", "reason": …} to checks.keyFields.allow.`);
                }
            }
        }
    }
}

function tagText(e: Emission): string {
    const tag = e.landing.tag ?? e.site.tag;
    return tag ? tag.tagName.getText() : '?';
}

function fits(suffix: TestIdRole, role: AriaRole): boolean {
    if (suffix === role) {
        return true;
    }
    if (suffix === 'text') {
        return NON_INTERACTIVE.has(role);
    }
    return (ROLE_EQUIV[suffix] ?? []).includes(role);
}

/** The suffix for an element's role: the role itself when it is a testid role, `text` for read-only content, else none. */
export function roleSuffixFor(role: AriaRole | null): TestIdRole | null {
    if (!role) {
        return null;
    }
    if (isTestIdRole(role)) {
        return role;
    }
    return NON_INTERACTIVE.has(role) ? 'text' : null;
}

/** A grammar-conforming suggestion for a legacy testid. */
export function suggest(template: string, role: AriaRole | null): string | null {
    const [path] = template.split(KEY_PLACEHOLDER);
    const words = path.split(/[.\-:]+|__/).map(toWord).filter(Boolean);
    if (!words.length) {
        return null;
    }
    const hasKey = template.includes(KEY_PLACEHOLDER);
    const scope = words.length > 1 ? words.slice(0, -1).join('.') : '<scope>';
    const name = words[words.length - 1];
    const r = role && !NON_INTERACTIVE.has(role) ? `--${role}` : '';
    return `${scope}.${name}${hasKey ? `:${KEY_PLACEHOLDER}` : ''}${r}`;
}

/**
 * Two emissions are exclusive when, at the first file their usage chains share, the nodes they render
 * through sit in different branches (`flag ? <A/> : <B/>`, an early return before one of them).
 */
function exclusiveAlongChains(a: Emission, b: Emission, usageNodeAt: (loc: Loc) => ts.Node | undefined, propUses: ScanResult['propRenderUses'], uniqueMountChain?: ScanResult['uniqueMountChain']): boolean {
    const chain = (e: Emission) => {
        const nodes = [e.site.node, ...e.via.map(usageNodeAt).filter((node): node is ts.Node => Boolean(node))];
        return [...nodes, ...(uniqueMountChain?.(nodes[nodes.length - 1]) ?? [])];
    };
    const ca = chain(a);
    const cb = chain(b);

    // A caller-built element renders at the receiver's prop read, not at its creation position.
    const throughProp = (left: ts.Node[], right: ts.Node[]) => right.some((mount, index) => {
        const uses = left.map((creation) => propUses(creation, mount)).find((nodes) => nodes?.length);
        if (!uses) {
            return false;
        }
        const outer = right.slice(index + 1);
        const shared = left.filter((node) => outer.includes(node));
        if (outer.length && !shared.length) {
            return false;
        }
        const targets = right.slice(0, index);
        return targets.some((target) => uses.every((use) => enclosingFunction(use) === enclosingFunction(target) && exclusive(use, target)));
    });
    if (throughProp(ca, cb) || throughProp(cb, ca)) {
        return true;
    }
    for (const x of ca) {
        for (const y of cb.filter((node) => node.getSourceFile() === x.getSourceFile())) {
            if (x === y) {
                return false;
            }
            if (exclusive(x, y)) {
                return true;
            }

            // render helpers (`createDMIntro()` in one arm, `createGMIntro()` in another): compare the calls that lead to each, within one function
            const lx = helperCalls(x);
            const ly = helperCalls(y);
            if (lx.some((p) => ly.some((q) => p !== q && enclosingFunction(p) === enclosingFunction(q) && exclusive(p, q)))) {
                return true;
            }
        }
    }
    return false;
}

function enclosingFunction(n: ts.Node): ts.Node | undefined {
    let p = n.parent;
    while (p && !typescript.isFunctionLike(p)) {
        p = p.parent;
    }
    return p;
}

/** The name of a plain render helper declared by `fn` (`function intro()`, `const intro = () =>`, a class method), else undefined. */
function helperName(fn: ts.Node): ts.Identifier | undefined {
    if ((typescript.isFunctionDeclaration(fn) || typescript.isMethodDeclaration(fn)) && fn.name && typescript.isIdentifier(fn.name)) {
        return fn.name;
    }
    if ((typescript.isArrowFunction(fn) || typescript.isFunctionExpression(fn)) && (typescript.isVariableDeclaration(fn.parent) || typescript.isPropertyDeclaration(fn.parent)) && typescript.isIdentifier(fn.parent.name)) {
        return fn.parent.name;
    }
    return undefined;
}

const referencesByFile = new WeakMap<ts.SourceFile, Map<string, ts.Identifier[]>>();

function referencesTo(name: ts.Identifier): ts.Identifier[] {
    const sf = name.getSourceFile();
    let refs = referencesByFile.get(sf);
    if (!refs) {
        const m = new Map<string, ts.Identifier[]>();
        const v = (n: ts.Node) => {
            if (typescript.isIdentifier(n)) {
                m.set(n.text, [...(m.get(n.text) ?? []), n]);
            }
            typescript.forEachChild(n, v);
        };
        v(sf);
        refs = m;
        referencesByFile.set(sf, refs);
    }
    return (refs.get(name.text) ?? []).filter((r) => r !== name);
}

/**
 * `n`, then the call that runs the render helper it sits in, and that helper's caller, and so on: only while
 * the helper's one reference in its file is a call (`intro()` / `this.intro()`), so a helper used twice, or
 * passed along, stops the walk.
 */
function helperCalls(n: ts.Node): ts.Node[] {
    const out = [n];
    const seen = new Set<ts.Node>();
    for (let fn = enclosingFunction(n); fn && !seen.has(fn); fn = enclosingFunction(out[out.length - 1])) {
        seen.add(fn);
        const name = helperName(fn);
        const refs = name ? referencesTo(name) : [];
        if (refs.length !== 1) {
            break;
        }
        const ref = refs[0];
        const callee = typescript.isPropertyAccessExpression(ref.parent) && ref.parent.name === ref && ref.parent.expression.kind === typescript.SyntaxKind.ThisKeyword ? ref.parent : ref;
        if (!typescript.isCallExpression(callee.parent) || callee.parent.expression !== callee) {
            break;
        }
        out.push(callee.parent);
    }
    return out;
}

/** Same template from two places: fine in mutually exclusive branches of one component with the same role; otherwise an error. */
function checkDuplicates(emissions: Emission[], push: Push, strictAt: StrictAt, usageNodeAt: (loc: Loc) => ts.Node | undefined, propUses: ScanResult['propRenderUses'], uniqueMountChain?: ScanResult['uniqueMountChain']) {
    const byKey = new Map<string, Emission[]>();
    for (const e of emissions) {
        // a key filled at run time is compared by its template: two sites that render together can give the same key
        const runtimeKey = e.value.k !== 'lit' && e.key === null && !isGrammarError(e.parsed) && e.template.includes(KEY_PLACEHOLDER) && e.template.split(KEY_PLACEHOLDER)[0].endsWith(':');
        if (e.value.k !== 'lit' && e.key === null && !runtimeKey) {
            continue;
        }
        const k = e.key === null ? e.template : `${e.template}=${e.key}`;
        byKey.set(k, [...(byKey.get(k) ?? []), e]);
    }
    for (const [k, list] of byKey) {
        const nodes = [...new Map(list.map((e) => [e.site.node, e])).values()];
        if (nodes.length < 2) {
            continue;
        }
        const grammar = !isGrammarError(nodes[0].parsed);
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const sameFile = a.site.node.getSourceFile() === b.site.node.getSourceFile();

                // runtime keys collide when the two sites render in one JSX tree (two lists side by side); sites built
                // apart (another component, a variable one branch reassigns, a method picked elsewhere) are alternatives
                // the scan can't tell from concurrent ones
                if (a.key === null && a.value.k !== 'lit' && !inOneJsxTree(a.site.node, b.site.node)) {
                    continue;
                }
                if (list.filter((e) => e.site.node === a.site.node).every((left) => list.filter((e) => e.site.node === b.site.node).every((right) => exclusiveAlongChains(left, right, usageNodeAt, propUses, uniqueMountChain)))) {
                    const suffix = grammar && !isGrammarError(a.parsed) ? a.parsed.role : null;
                    if (a.landing.tag && b.landing.tag && a.landing.aria.role !== b.landing.aria.role && requiresRoleFit(suffix) && !(suffix && [a.landing, b.landing].every((landing) => entryDriverFits(suffix, landing.textEntry) ?? Boolean(landing.aria.role && fits(suffix, landing.aria.role))))) {
                        push('duplicates', strictAt(a.site.at, k) || strictAt(b.site.at, k), a.site.at, `"${k}" is used in exclusive branches with different roles (${a.landing.aria.role} at ${a.site.at}, ${b.landing.aria.role} at ${b.site.at}).`, 'Use the same element kind in both branches, or give them different names.', {template: a.template, key: a.key, via: a.via});
                    }
                    continue;
                }
                push('duplicates', strictAt(a.site.at, k) || strictAt(b.site.at, k), a.site.at, `"${k}" is also used by ${b.site.at}${sameFile ? ', and both can render together' : ''}.`, 'Give each element its own name, or scope them (`modal_a.save--button`, `modal_b.save--button`).', {template: a.template, key: a.key, via: a.via});
            }
        }
    }
}

/**
 * Whether `node` renders only by returning from inside `container`: a `return` holds it with no function between
 * that return and the container, so it leaves the container's own function (a return inside a callback leaves the
 * callback, which may run anywhere).
 */
function returnedFrom(node: ts.Node, container: ts.Node): boolean {
    let returned = false;
    for (let n: ts.Node | undefined = node; n && n !== container; n = n.parent) {
        if (typescript.isFunctionLike(n)) {
            returned = false;
        } else if (typescript.isReturnStatement(n)) {
            returned = true;
        }
    }
    return returned;
}

/** Whether two nodes sit in one JSX tree: their nearest common ancestor is a JSX element or fragment. */
function inOneJsxTree(a: ts.Node, b: ts.Node): boolean {
    const ancestors = new Set<ts.Node>();
    for (let n: ts.Node | undefined = a; n; n = n.parent) {
        ancestors.add(n);
    }
    let common: ts.Node | undefined = b;
    while (common && !ancestors.has(common)) {
        common = common.parent;
    }
    return Boolean(common) && (typescript.isJsxElement(common!) || typescript.isJsxFragment(common!));
}

/** Whether two nodes in one file are in different arms of a branch (ternary, if/else, early return, switch). */
export function exclusive(a: ts.Node, b: ts.Node): boolean {
    const anc = new Set<ts.Node>();
    for (let n: ts.Node | undefined = a; n; n = n.parent) {
        anc.add(n);
    }
    let common: ts.Node | undefined = b;
    while (common && !anc.has(common)) {
        common = common.parent;
    }
    if (!common) {
        return false;
    }
    const c = common;
    const armOf = (x: ts.Node) => {
        let n = x;
        while (n.parent && n.parent !== c) {
            n = n.parent;
        }
        return n;
    };
    if (typescript.isConditionalExpression(c)) {
        const aa = armOf(a);
        const bb = armOf(b);
        return aa !== bb && aa !== c.condition && bb !== c.condition;
    }
    if (typescript.isIfStatement(c)) {
        const aa = armOf(a);
        const bb = armOf(b);
        return aa !== bb && aa !== c.expression && bb !== c.expression;
    }
    if (typescript.isBlock(c) || typescript.isSourceFile(c) || typescript.isCaseClause(c)) {
        const sa = armOf(a);
        const sb = armOf(b);

        // an earlier `if` the later statement can't run with: the earlier node renders only by returning from inside
        // it, or the arm holding it always leaves. A return elsewhere in the `if` that may be skipped doesn't count.
        const [first, earlier] = sa.pos < sb.pos ? [sa, a] : [sb, b];
        if (typescript.isIfStatement(first)) {
            const arm = [first.thenStatement, first.elseStatement].find((st) => st && earlier.pos >= st.pos && earlier.end <= st.end);
            if (returnedFrom(earlier, first) || (arm && alwaysReturns(arm))) {
                return true;
            }
        }
    }
    if (typescript.isCaseBlock(c)) {
        return true;
    }

    // guarded by contradicting conditions: `if (!compact) {…}` and `else if (archived && compact) {…}`
    if (contradict(guards(a, c), guards(b, c))) {
        return true;
    }

    // different functions of one component (e.g. render helpers chosen by a switch) count as exclusive only via the above
    return false;
}

type Atom = {text: string; neg: boolean};

/** The conditions a node runs under, below `stop`, as atoms: `a && !b` in a then-arm gives a, !b; an else-arm negates a single atom. */
function guards(n: ts.Node, stop: ts.Node): Atom[] {
    const out: Atom[] = [];
    const atom = (e: ts.Expression, neg: boolean): Atom => {
        let x = e;
        let negated = neg;
        while (typescript.isParenthesizedExpression(x) || (typescript.isPrefixUnaryExpression(x) && x.operator === typescript.SyntaxKind.ExclamationToken)) {
            if (typescript.isPrefixUnaryExpression(x)) {
                negated = !negated;
                x = x.operand;
            } else {
                x = x.expression;
            }
        }
        return {text: x.getText(), neg: negated};
    };
    const conjuncts = (e: ts.Expression): ts.Expression[] => {
        const x = typescript.isParenthesizedExpression(e) ? e.expression : e;
        return typescript.isBinaryExpression(x) && x.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken ? [...conjuncts(x.left), ...conjuncts(x.right)] : [x];
    };
    for (let c = n; c.parent && c !== stop; c = c.parent) {
        const p = c.parent;
        if (typescript.isIfStatement(p) && c === p.thenStatement) {
            out.push(...conjuncts(p.expression).map((e) => atom(e, false)));
        } else if (typescript.isIfStatement(p) && c === p.elseStatement && conjuncts(p.expression).length === 1) {
            out.push(atom(p.expression, true));
        } else if (typescript.isConditionalExpression(p) && c === p.whenTrue) {
            out.push(...conjuncts(p.condition).map((e) => atom(e, false)));
        } else if (typescript.isBinaryExpression(p) && p.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken && c === p.right) {
            out.push(...conjuncts(p.left).map((e) => atom(e, false)));
        }
    }
    return out;
}

function contradict(a: Atom[], b: Atom[]): boolean {
    return a.some((x) => b.some((y) => x.text === y.text && x.neg !== y.neg));
}

/** Elements that would get the same generated member name in one scope (checked by the generator too). */
export function memberCollisions(elements: Element[], nameOf: (e: Element) => string): Diagnostic[] {
    const byScope = new Map<string, Map<string, Element>>();
    const out: Diagnostic[] = [];
    for (const e of elements) {
        if (!e.grammar) {
            continue;
        }
        const s = e.scope.join('.');
        const names = byScope.get(s) ?? new Map<string, Element>();
        byScope.set(s, names);
        const n = nameOf(e);
        const prev = names.get(n);
        if (prev && prev.template !== e.template) {
            out.push({rule: 'collisions', severity: 'error', at: e.component.at, message: `"${e.template}" and "${prev.template}" (${prev.component.at}) both generate ${s}.${n}.`, fix: 'Rename one of them.', template: e.template});
        }
        names.set(n, e);
    }
    return out;
}
