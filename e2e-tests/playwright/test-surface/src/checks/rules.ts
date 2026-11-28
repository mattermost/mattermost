// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The checks' rules, each a function from the (reachable) scan to its diagnostics, run in the order of `RULES`.
 * Severity comes from `strictAt` unless a rule always errs (plugin contracts, open-string keys, stale config).
 */

import {exclusiveAlongChains, inOneJsxTree} from './exclusive.ts';
import type {StrictAt} from './policy.ts';

import {TEST_ID_ROLES} from '../../lint/grammar.js';
import {strip} from '../ast.ts';
import type {CheckOptions} from '../checks.ts';
import {cmp} from '../compare.ts';
import type {KeyFieldAllow} from '../config.ts';
import {isGrammarError, KEY_PLACEHOLDER, toWord, type ParsedTestId} from '../grammar.ts';
import {MAX_TEMPLATE_VALUES} from '../limits.ts';
import type {AriaRole, Diagnostic, Loc, RuleName} from '../manifest_types.ts';
import {entryDriverFits, NON_INTERACTIVE, requiresRoleFit, roleFits, roleSuffixFor} from '../role_table.ts';
import {isUnscoped, readHostSlots, type Emission, type ScanResult} from '../scan.ts';
import {typescript} from '../typescript.ts';
import {templateOf, TOO_MANY_VALUES, type Gap} from '../values/index.ts';

/** What every rule reads: the scan (reachable parts only), the options, and whether a place is strict. */
export type RuleContext = {scan: ScanResult; opts: CheckOptions; strictAt: StrictAt};

export type Rule = (ctx: RuleContext) => Diagnostic[];

/** What a diagnostic is about, beside where: the testid template, its literal key, the usage chain it came through. */
type About = {template?: string; key?: string | null; via?: Loc[]};

type Push = (rule: RuleName, strict: boolean, at: Loc, message: string, fix?: string, about?: About) => void;

/** The diagnostics `report` pushes, a strict one as an error and any other as a warning. */
function collect(report: (push: Push) => void): Diagnostic[] {
    const out: Diagnostic[] = [];
    report((rule, strict, at, message, fix, about = {}) => {
        const {template, key, via} = about;
        out.push({rule, severity: strict ? 'error' : 'warning', at, message, ...(fix ? {fix} : {}), ...(template === undefined ? {} : {template}), ...(key ? {key} : {}), ...(via?.length ? {via} : {})});
    });
    return out;
}

/** A finding about one emission: reported at its site, about its template, key and usage chain. */
type EmissionPush = (rule: RuleName, strict: boolean, at: Loc, message: string, fix?: string) => void;

/** Runs `check` on each emission, with the emission's strictness and a `push` that reports about it. */
function eachEmission<E extends Emission>(emissions: E[], strictAt: StrictAt, check: (e: E, push: EmissionPush, strict: boolean) => void): Diagnostic[] {
    return collect((pushAt) => {
        for (const e of emissions) {
            const push: EmissionPush = (rule, isStrict, where, message, fix) => pushAt(rule, isStrict, where, message, fix, {template: e.template, key: e.key, via: e.via});
            check(e, push, strictAt(e.site.at, e.template, e.via));
        }
    });
}

type WellFormed = Emission & {parsed: ParsedTestId};

/** Emissions with a scope written in the source: the emission rules skip a testid made entirely of runtime data. */
const scoped = (emissions: Emission[]) => emissions.filter((e) => !isUnscoped(e.value));

/** Scoped emissions whose testid follows the grammar (role, key and field rules read the parsed testid). */
const wellFormed = (emissions: Emission[]) => scoped(emissions).filter((e): e is WellFormed => !isGrammarError(e.parsed));

/** The interpolated gaps of an emission's value. */
const gapsOf = (e: Emission): Gap[] => (e.value.k === 'pat' ? e.value.parts.flatMap((part) => (typeof part === 'string' ? [] : [part.gap])) : []);

/** Testid values: too many to list, missing interpolations, values that can't be read, values without a written scope. */
const sites: Rule = ({scan, strictAt}) => collect((push) => {
    for (const s of scan.sites) {
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
});

/** A testid that can render the text "undefined", in its template or as its key. */
const undefinedText: Rule = ({scan, strictAt}) => eachEmission(scoped(scan.emissions), strictAt, (e, push, strict) => {
    if ((/(^|[^A-Za-z_])undefined([^A-Za-z_]|$)/).test(e.template) || e.key === 'undefined') {
        push('undefined', strict, e.site.at, `"${e.template}" can render the text "undefined"${e.key === 'undefined' ? ' as its key' : ''}${e.via.length ? ` (via ${e.via[0]})` : ''}.`, 'Make sure the value is always set, or render no testid when it is missing.');
    }
});

/** A testid that doesn't follow the grammar, with a conforming suggestion. */
const grammar: Rule = ({scan, strictAt}) => eachEmission(scoped(scan.emissions), strictAt, (e, push, strict) => {
    if (isGrammarError(e.parsed)) {
        const suggestion = suggest(e.template, e.landing.aria.role);
        push(e.parsed.rule, strict, e.site.at, e.parsed.message, e.parsed.fix + (suggestion ? ` Suggested: "${suggestion}".` : ''));
    }
});

/** A state/input driver's suffix on an element whose role (or text entry) the driver can't operate. */
const roleFit: Rule = ({scan, strictAt}) => eachEmission(wellFormed(scan.emissions), strictAt, (e, push, strict) => {
    const at = e.site.at;
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
                if (!roleFits(suffix, known)) {
                    push('role-fit', strict, at, `"${e.template}" can render with role ${known} (<${tagText(e)}>).`, `Render an element with role ${suffix}.`);
                }
            }
            push('unresolved', false, at, `The role of "${e.template}" cannot be read from its declared props at this mount.`, `Resolve the ${suffix} driver's state/input role at the source.`);
        } else if (role && !roleFits(suffix, role)) {
            const fit = roleSuffixFor(role);
            push('role-fit', strict, at, `"${e.template}" is on a ${role} (<${tagText(e)}>).`, fit ? `Use --${fit}, or render an element with role ${suffix}.` : `Render an element with role ${suffix}.`);
        } else if (!role && e.landing.tag) {
            push('role-fit', strict, at, `"${e.template}" is on a <${tagText(e)}> with no readable state/input role.`, `Render a native control or an element with role ${suffix}.`);
        }
    }
});

/** A keyed testid's key: delimited by a written role suffix when its raw value could run on, and one interpolation. */
const keyOrigin: Rule = ({scan, strictAt, opts}) => eachEmission(wellFormed(scan.emissions), strictAt, (e, push, strict) => {
    const at = e.site.at;
    const suffix = e.parsed.role;
    if (e.parsed.hasKey) {
        const gaps = gapsOf(e);
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
                const roleSuffix = e.parsed.role ? `--${e.parsed.role}` : '';
                const key = text.slice(colon + 1, roleSuffix ? -roleSuffix.length : undefined);
                if (key.includes(marker) && key !== marker) {
                    push('key-origin', strict, at, `Key of "${e.template}" is assembled from multiple pieces.`, 'Use exactly one interpolation containing an id, set member or index.');
                }
            }
        }
    }
});

/** The `checks.keyFields.allow` entry a key's gap matches: by the field's declared origin, else by entity and field. */
function allowedKeyField(gap: Gap, opts: CheckOptions): KeyFieldAllow | undefined {
    return opts.keyFields?.allow.find((entry) => {
        const origin = gap.fieldEntry;
        return origin ? entry.entity === origin.entity && entry.field === origin.field && entry.module === origin.module && entry.value === origin.value && Boolean(entry.keys) === Boolean(origin.keys) : !entry.module && entry.entity === gap.entity && entry.field === gap.field;
    });
}

/** What keys a testid: never an open string, and an entity field only when it is id-like or allowed. */
const keyFields: Rule = ({scan, strictAt, opts}) => eachEmission(wellFormed(scan.emissions), strictAt, (e, push, strict) => {
    const at = e.site.at;
    for (const gap of gapsOf(e)) {
        if (gap.kind === 'string') {
            push('key-origin', true, at, `key of "${e.template}" is an open string (${gap.expr}: ${gap.type}${gap.from ? `, from ${gap.from}` : ''}).`, 'Key from a fixed set (literal union / as const), an entity id (channel.id), or type it.');
        }

        // an entity field that isn't id-like (a status's `text`, an option's `value`) may not identify the entity,
        // or may change with the language: only allowed ones pass
        if ((gap.kind === 'entity' || gap.kind === 'id') && gap.entity && gap.field && opts.keyFields && !opts.keyFields.pattern.test(gap.field)) {
            if (!allowedKeyField(gap, opts)) {
                push('key-origin', strict, at, `key of "${e.template}" is ${gap.entity}.${gap.field} (${gap.expr}), which isn't an id-like field: it may not tell items apart, or may change with the language.`, `Key by an id-like field (${opts.keyFields.pattern.source}), or add {"entity": "${gap.entity}", "field": "${gap.field}", "reason": …} to checks.keyFields.allow.`);
            }
        }
    }
});

/** `keyValues` and `checks.keyFields.allow` entries that no longer match any key (always errors, so the lists can't go stale). */
const staleKeyConfig: Rule = ({scan, opts}) => collect((push) => {
    const usedKeyValues = new Set(scan.emissions.flatMap((emission) => gapsOf(emission).flatMap((gap) => (gap.keyValueEntry ? [gap.keyValueEntry] : []))));
    for (const entry of opts.keyValues ?? []) {
        if (!usedKeyValues.has(entry)) {
            push('allow', true, opts.configAt, `keyValues entry for ${entry.function} in ${entry.module} no longer matches any key.`, 'Remove it.');
        }
    }
    const usedKeyFields = new Set(wellFormed(scan.emissions).flatMap((e) => gapsOf(e).flatMap((gap) => allowedKeyField(gap, opts) ?? [])));
    for (const a of (opts.keyFields?.allow ?? []).filter((x) => !usedKeyFields.has(x))) {
        push('allow', true, opts.configAt, `checks.keyFields.allow entry for ${a.entity}.${a.field}${a.module ? ` in ${a.module}` : ''} no longer matches any key.`, 'Remove it.');
    }
});

/** Same template from two places: fine in mutually exclusive branches of one component with the same role; otherwise an error. */
const duplicates: Rule = ({scan, strictAt}) => collect((push) => {
    const {usageNodeAt, propRenderUses: propUses, uniqueMountChain} = scan;
    const byKey = new Map<string, Emission[]>();
    for (const e of scan.emissions) {
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
        const grammatical = !isGrammarError(nodes[0].parsed);
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
                    const suffix = grammatical && !isGrammarError(a.parsed) ? a.parsed.role : null;
                    if (a.landing.tag && b.landing.tag && a.landing.aria.role !== b.landing.aria.role && requiresRoleFit(suffix) && !(suffix && [a.landing, b.landing].every((landing) => entryDriverFits(suffix, landing.textEntry) ?? Boolean(landing.aria.role && roleFits(suffix, landing.aria.role))))) {
                        push('duplicates', strictAt(a.site.at, k) || strictAt(b.site.at, k), a.site.at, `"${k}" is used in exclusive branches with different roles (${a.landing.aria.role} at ${a.site.at}, ${b.landing.aria.role} at ${b.site.at}).`, 'Use the same element kind in both branches, or give them different names.', {template: a.template, key: a.key, via: a.via});
                    }
                    continue;
                }
                push('duplicates', strictAt(a.site.at, k) || strictAt(b.site.at, k), a.site.at, `"${k}" is also used by ${b.site.at}${sameFile ? ', and both can render together' : ''}.`, 'Give each element its own name, or scope them (`modal_a.save--button`, `modal_b.save--button`).', {template: a.template, key: a.key, via: a.via});
            }
        }
    }
});

/** Whether a slot's template (`*.` for any scope) names a rendered template. */
export function slotMatches(slotTemplate: string, template: string): boolean {
    return slotTemplate.startsWith('*.') ? template.endsWith(slotTemplate.slice(1)) : template === slotTemplate;
}

/** The published plugin slot contract and what the webapp renders agree, both ways (always errors: plugins depend on it). */
const pluginSlots: Rule = ({scan: {manifest}, opts: {pluginSlots: declarations = null, configAt}}) => collect((push) => {
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
});

/** An element whose key stayed an unresolved string at its mount (always an error). */
const unresolvedKeys: Rule = ({scan: {manifest}}) => collect((push) => {
    for (const el of manifest.elements) {
        if (el.key?.kind === 'string') {
            push('key-origin', true, el.component.at, `Key of "${el.template}" remains an unresolved string without a strict origin.`, 'Resolve the key at its mount to an id, fixed set or index.', {template: el.template});
        }
    }
});

/** A scope with no declared parts or children, which the surface report leaves out (a warning). */
const emptyScopes: Rule = ({scan: {manifest}}) => collect((push) => {
    for (const el of manifest.elements) {
        if (el.grammar && !el.scope.length && !manifest.elements.some((other) => other.grammar && other.scope[0] === el.name)) {
            push('unscoped', false, el.component.at, `"${el.template}" has no declared parts or children.`, 'Declare members beneath the scope to include it in the surface report.', {template: el.template});
        }
    }
});

/**
 * Plugin mode: the plugin's testids live under `plugins.<key>` (host slots carry the host's testids), and
 * every host version it supports still renders the slots its registry calls fill (always errors).
 */
const plugin: Rule = ({scan: {manifest}, strictAt, opts: {plugin: config, configAt}}) => collect((push) => {
    if (!config) {
        return;
    }
    const scope = config.scope;
    for (const e of manifest.elements) {
        if (e.grammar && e.template !== scope && !e.template.startsWith(scope + '.')) {
            push('plugin-scope', strictAt(e.component.at, e.template), e.component.at, `"${e.template}" is outside the plugin's scope "${scope}".`, `Prefix it: "${scope}.${e.template}".`, {template: e.template});
        }
    }
    for (const host of config.hosts) {
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
                const expected = config.slotContract[slot]?.template;
                const actual = slots.get(slot);
                if (!actual) {
                    push('plugin-compat', true, used.at, `${used.method}() fills the "${slot}" slot, which host ${host.name} doesn't render.`, `Drop ${host.name} from the supported hosts (raise min_server_version), or stop relying on the slot there.`);
                } else if (expected && actual !== expected) {
                    push('plugin-compat', true, used.at, `${used.method}() fills the "${slot}" slot with template "${expected}", but host ${host.name} declares "${actual}".`, 'Use the host slot template or stop relying on the slot in this host version.');
                }
            }
        }
    }
});

/** Every rule, in the order their diagnostics are collected. */
export const RULES: readonly Rule[] = [
    sites,
    undefinedText,
    grammar,
    roleFit,
    keyOrigin,
    keyFields,
    staleKeyConfig,
    duplicates,
    pluginSlots,
    unresolvedKeys,
    emptyScopes,
    plugin,
];

function tagText(e: Emission): string {
    const tag = e.landing.tag ?? e.site.tag;
    return tag ? tag.tagName.getText() : '?';
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
