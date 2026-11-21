// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserContext, Locator, Page} from '@playwright/test';

import {compareStrings} from './findings.ts';
import type {FindingInput} from './findings.ts';
import {pagePath} from './oracle-events.ts';

export type LocatorSpec = {
    css?: string;
    role?: string;
    name?: string;
    exact?: boolean;
    testid?: string;
    text?: string;
    within?: LocatorSpec;
    first?: boolean;
};

export type CheckSpec = {
    schema: 'explorer-oracle-check/v1';
    id: string;
    description: string;
    needs_typing: false;
    subjects: {
        /** Dotted path into the data object given by the caller, e.g. `manifest.channels`. */
        from: string;
        as: string;
        where?: Record<string, unknown>;
        /** Only the subject whose field of this name equals the page's current pathname. */
        match_current_path?: string;
    };
    applies_when?: {url_path_regex?: string; visible?: LocatorSpec};
    ui: {
        locator: LocatorSpec;
        read: 'text' | 'text-all' | `attr:${string}` | 'value';
        normalize?: string[];
        /** When true, an absent UI element is a mismatch; otherwise the subject is not applicable. */
        required?: boolean;
    };
    rest: {method: 'GET'; path: string; field: string | string[]; expect_status?: number; normalize?: string[]};
    rule: {op: 'equals' | 'contains' | 'equals-list'};
    settle_ms?: number;
};

export type CheckStatus = 'pass' | 'mismatch' | 'not-applicable' | 'vacuous' | 'error';
export type CheckResult = {check: string; subject: string; status: CheckStatus; detail: string};

type Vars = Record<string, unknown>;

const UI_READS = /^(text|text-all|value|attr:[a-z-]+)$/;

/** Structural validation of a check.json; throws a descriptive error for anything the evaluator cannot run. */
export function validateCheck(check: CheckSpec): void {
    const fail = (why: string) => {
        throw new Error(`check ${check?.id ?? '?'}: ${why}`);
    };
    if (check.schema !== 'explorer-oracle-check/v1' || !/^[a-z0-9-]+$/.test(check.id ?? '')) {
        fail('schema or id invalid');
    }
    if (!check.subjects?.from || !check.subjects.as) {
        fail('subjects.from and subjects.as are required');
    }
    if (!UI_READS.test(check.ui?.read ?? '') || !check.ui.locator) {
        fail('ui.locator and a valid ui.read are required');
    }
    if (check.rest?.method !== 'GET' || !check.rest.path?.startsWith('/api/') || !check.rest.field) {
        fail('rest must be a GET of an /api/ path with a field');
    }
    if (!['equals', 'contains', 'equals-list'].includes(check.rule?.op)) {
        fail('rule.op must be equals, contains or equals-list');
    }
    for (const op of [...(check.ui.normalize ?? []), ...(check.rest.normalize ?? [])]) {
        normalizeValue('', [op]);
    }
}

function lookup(vars: Vars, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], vars);
}

export function interpolate(template: string, vars: Vars): string {
    return template.replace(/\{([a-z_]+(?:\.[a-z_]+)*)\}/g, (_match, dotted: string) => {
        const value = lookup(vars, dotted);
        if (value === undefined || value === null) {
            throw new Error(`check template variable {${dotted}} is not defined`);
        }
        return String(value);
    });
}

function buildLocator(page: Page, spec: LocatorSpec, vars: Vars): Locator {
    const scope = spec.within ? buildLocator(page, spec.within, vars) : page;
    let locator: Locator;
    if (spec.css) {
        locator = scope.locator(interpolate(spec.css, vars));
    } else if (spec.testid) {
        locator = scope.getByTestId(interpolate(spec.testid, vars));
    } else if (spec.text) {
        locator = scope.getByText(interpolate(spec.text, vars), {exact: spec.exact});
    } else if (spec.role) {
        locator = scope.getByRole(spec.role as Parameters<Page['getByRole']>[0], {
            name: spec.name === undefined ? undefined : interpolate(spec.name, vars),
            exact: spec.exact,
        });
    } else {
        throw new Error('locator spec needs css, testid, text or role');
    }
    return spec.first ? locator.first() : locator;
}

const PRIVATE_USE = /[\u{e000}-\u{f8ff}\u{f0000}-\u{10ffff}]/gu;

export function normalizeValue(value: string, ops: string[] = []): string {
    return ops.reduce((acc, op) => {
        if (op === 'trim') {
            return acc.trim();
        }
        if (op === 'collapse-whitespace') {
            return acc.replace(/\s+/g, ' ');
        }
        if (op === 'strip-private-use') {
            return acc.replace(PRIVATE_USE, '');
        }
        if (op === 'lowercase') {
            return acc.toLowerCase();
        }
        if (op.startsWith('strip-suffix:')) {
            const suffix = op.slice('strip-suffix:'.length);
            return acc.endsWith(suffix) ? acc.slice(0, -suffix.length) : acc;
        }
        throw new Error(`unknown normalize op "${op}"`);
    }, value);
}

function pickField(body: unknown, field: string): unknown {
    const segments = field.split('.');
    const walk = (value: unknown, rest: string[]): unknown => {
        if (rest.length === 0) {
            return value;
        }
        const [head, ...tail] = rest;
        if (head === '[]') {
            return Array.isArray(value) ? value.map((item) => walk(item, tail)) : undefined;
        }
        return value !== null && typeof value === 'object'
            ? walk((value as Record<string, unknown>)[head], tail)
            : undefined;
    };
    return walk(body, segments);
}

async function readUi(locator: Locator, read: CheckSpec['ui']['read']): Promise<string | string[] | null> {
    const count = await locator.count();
    if (count === 0) {
        return read === 'text-all' ? [] : null;
    }
    if (read === 'text-all') {
        return (await locator.allInnerTexts()).map((t) => t);
    }
    if (read === 'text') {
        return locator.first().innerText();
    }
    if (read === 'value') {
        return locator.first().inputValue();
    }
    return locator.first().getAttribute(read.slice('attr:'.length));
}

async function fetchRest(context: BrowserContext, origin: string, spec: CheckSpec['rest'], vars: Vars) {
    const url = new URL(interpolate(spec.path, vars), origin);
    if (url.origin !== origin) {
        throw new Error('REST templates may only address the session origin');
    }
    const response = await context.request.fetch(url.href, {
        method: spec.method,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        failOnStatusCode: false,
    });
    const status = response.status();
    const body = status === 200 ? await response.json().catch(() => undefined) : undefined;
    await response.dispose();
    return {status, body};
}

function restValueOf(raw: unknown, normalize?: string[]): string | string[] {
    if (Array.isArray(raw)) {
        return raw.map((v) => normalizeValue(String(v ?? ''), normalize));
    }
    if (typeof raw === 'string') {
        return normalizeValue(raw, normalize);
    }
    return raw === undefined || raw === null ? '' : String(raw);
}

type Evaluation = {status: CheckStatus; ui: unknown; rest: unknown; detail: string};

async function evaluateOnce(
    page: Page,
    context: BrowserContext,
    origin: string,
    check: CheckSpec,
    field: string,
    vars: Vars,
): Promise<Evaluation> {
    const {status: httpStatus, body} = await fetchRest(context, origin, check.rest, vars);
    if (httpStatus !== (check.rest.expect_status ?? 200)) {
        return {status: 'error', ui: null, rest: null, detail: `REST status ${httpStatus}`};
    }
    const restValue = restValueOf(pickField(body, field), check.rest.normalize);

    const rawUi = await readUi(buildLocator(page, check.ui.locator, vars), check.ui.read);
    if (rawUi === null) {
        return check.ui.required
            ? {status: 'mismatch', ui: '<absent>', rest: restValue, detail: 'UI element not found'}
            : {status: 'not-applicable', ui: null, rest: restValue, detail: 'UI element not shown'};
    }
    const uiValue = Array.isArray(rawUi)
        ? rawUi.map((v) => normalizeValue(v, check.ui.normalize))
        : normalizeValue(rawUi, check.ui.normalize);

    if (check.rule.op === 'equals-list') {
        const a = [...(uiValue as string[])].sort();
        const b = [...(restValue as string[])].sort();
        if (a.length === 0 && b.length === 0) {
            return {status: 'vacuous', ui: a, rest: b, detail: 'both lists empty'};
        }
        return {status: JSON.stringify(a) === JSON.stringify(b) ? 'pass' : 'mismatch', ui: a, rest: b, detail: ''};
    }
    if (check.rule.op === 'contains') {
        if (restValue === '') {
            return {status: 'vacuous', ui: uiValue, rest: restValue, detail: 'REST value empty'};
        }
        return {
            status: String(uiValue).includes(String(restValue)) ? 'pass' : 'mismatch',
            ui: uiValue,
            rest: restValue,
            detail: '',
        };
    }
    return {status: uiValue === restValue ? 'pass' : 'mismatch', ui: uiValue, rest: restValue, detail: ''};
}

function subjectsFor(check: CheckSpec, data: Vars, pathname: string): Array<[string, Record<string, unknown>]> {
    const source = lookup(data, check.subjects.from) as Record<string, Record<string, unknown>> | undefined;
    if (!source) {
        throw new Error(`check subjects "${check.subjects.from}" not found in the supplied data`);
    }
    return Object.entries(source)
        .filter(([, value]) =>
            Object.entries(check.subjects.where ?? {}).every(([key, expected]) => value[key] === expected),
        )
        .filter(
            ([, value]) => !check.subjects.match_current_path || value[check.subjects.match_current_path] === pathname,
        )
        .sort(([a], [b]) => compareStrings(a, b));
}

const POLL_MS = 250;
const UI_EXCERPT = 60;

function mismatchEvidence(check: CheckSpec, label: string, field: string, evaluation: Evaluation): string {
    const head = `check ${check.id} [${label}]:`;
    if (check.rule.op === 'contains') {
        return `${head} ui text does not contain rest ${field} ${JSON.stringify(evaluation.rest)} (ui text starts ${JSON.stringify(String(evaluation.ui).slice(0, UI_EXCERPT))})`;
    }
    return `${head} ui ${JSON.stringify(evaluation.ui)} vs rest ${field} ${JSON.stringify(evaluation.rest)} (${check.rule.op})`;
}

/**
 * Evaluates one check for every applicable subject. A disagreement must persist for `settle_ms` (default 2.5 s)
 * before it is reported, so a UI that is merely about to update is not a mismatch.
 */
export async function runCheck(
    page: Page,
    context: BrowserContext,
    origin: string,
    check: CheckSpec,
    data: Vars,
    add: (input: FindingInput) => void,
    action: number,
): Promise<CheckResult[]> {
    const pathname = new URL(page.url()).pathname;
    const where = pagePath(page);
    const results: CheckResult[] = [];
    const applies = check.applies_when;
    if (applies?.url_path_regex && !new RegExp(applies.url_path_regex).test(pathname)) {
        return [{check: check.id, subject: '*', status: 'not-applicable', detail: 'URL path'}];
    }
    if (applies?.visible && !(await buildLocator(page, applies.visible, {}).first().isVisible())) {
        return [{check: check.id, subject: '*', status: 'not-applicable', detail: 'precondition element not visible'}];
    }
    const fields = Array.isArray(check.rest.field) ? check.rest.field : [check.rest.field];
    for (const [name, subject] of subjectsFor(check, data, pathname)) {
        const vars: Vars = {[check.subjects.as]: subject};
        for (const field of fields) {
            const label = fields.length > 1 ? `${name}.${field}` : name;
            const deadline = Date.now() + (check.settle_ms ?? 2500);
            let evaluation = await evaluateOnce(page, context, origin, check, field, vars);
            while (evaluation.status === 'mismatch' && Date.now() < deadline) {
                await page.waitForTimeout(POLL_MS);
                evaluation = await evaluateOnce(page, context, origin, check, field, vars);
            }
            if (evaluation.status === 'mismatch') {
                add({
                    oracle: 'O-UIREST',
                    class: 'ui-rest-mismatch',
                    path: where,
                    evidence: mismatchEvidence(check, label, field, evaluation),
                    action,
                });
            }
            results.push({check: check.id, subject: label, status: evaluation.status, detail: evaluation.detail});
        }
    }
    return results;
}
