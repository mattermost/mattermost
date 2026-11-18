// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import type {HostSlot} from './types.ts';

import {isFunctionLike, propName, strip, type JsxTag} from '../ast.ts';
import {cmp} from '../compare.ts';
import {KEY_PLACEHOLDER} from '../grammar.ts';
import {readVersioned} from '../input.ts';
import {type Diagnostic, type Element, type TestPart} from '../manifest_types.ts';
import {parseRoute} from '../pages.ts';
import {isCallUsage, type Usage} from '../program_index.ts';
import {ROLE_TABLE} from '../role_table.ts';
import {type AriaRole} from '../roles.ts';
import {typescript} from '../typescript.ts';
import {lit, type Gap, type Value} from '../values.ts';

/** Roles a bare-word testid (a scope root, `channel_settings_modal`) may land on: a container or a landmark (the channel header's `banner`), not a control. */
export const CONTAINER_ROLES = new Set<AriaRole>(['none', 'presentation', 'dialog', 'alertdialog', 'menu', 'region', 'group', 'form', 'navigation', 'list', 'grid', 'table', 'tabpanel', 'status', 'alert', 'tooltip', 'text', 'banner', 'main', 'complementary', 'contentinfo', 'search']);

/** Roles a component usage's element can have without being something the user operates, though it takes on* props. */
export const NOT_OPERATED = new Set<AriaRole>(['text', 'img', 'list', 'listitem', 'dialog', 'heading', 'grid', 'table', 'cell', 'columnheader', 'row', 'gridcell', 'form', 'navigation', 'status', 'alert', 'region', 'group', 'tooltip', 'separator']);

export const isUnscoped = (v: Value) => v.k === 'pat' && v.parts.length === 1 && typeof v.parts[0] !== 'string';

/** `channels/src/a.tsx:12` -> `channels/src/a.tsx`. */

export function usageAnchor(u: Usage): ts.Node {
    return isCallUsage(u) ? u.call : elementOf(u);
}

/** The JSX element (opening + children) for a tag. */
/** A sub-route as its type writes it: `user/:user_id([a-z0-9]{26})` -> `user/${string}`, without leading or trailing slashes. */
export function sectionType(route: string): string {
    // eslint-disable-next-line no-template-curly-in-string -- the type is written as a template literal
    return parseRoute(route.replace(/^\/+|\/+$/g, '')).segments.map((s) => (typeof s === 'string' ? s : '${string}')).join('');
}

/**
 * The channels of a library component whose value it renders in its own portal, by the package and the type or
 * component that declares the prop: a value handed any other way renders where the usage is. The compass Combobox
 * portals its menu (to `portalContainer`, `document.body` by default); a row's or every row's `menuItemProps` reach
 * the menu only, while the control, `clearButtonProps` and the selection render in place. `leadingVisual` is left
 * out: a multiselect copies it into the control's chips.
 */
export const LIBRARY_PORTAL_CHANNELS: ReadonlyArray<{package: string; owners: readonly string[]; props: readonly string[] | 'all'}> = [
    {package: '@mattermost/compass-ui', owners: ['ComboboxProps', 'ComboboxOption'], props: ['menuItemProps']},
];

export function elementOf(tag: JsxTag): ts.Node {
    return typescript.isJsxOpeningElement(tag) ? tag.parent : tag;
}

/** Longest common scope prefix of a set of scopes ("a.b.c", "a.b.d" -> "a.b"), else the most common top scope. */
export function commonScope(scopes: string[]): string | null {
    if (!scopes.length) {
        return null;
    }
    const parts = scopes.map((s) => s.split('.'));
    const prefix: string[] = [];
    for (let i = 0; ; i++) {
        const w = parts[0][i];
        if (w === undefined || !parts.every((p) => p[i] === w)) {
            break;
        }
        prefix.push(w);
    }
    if (prefix.length) {
        return prefix.join('.');
    }
    const counts = new Map<string, number>();
    for (const p of parts) {
        counts.set(p[0], (counts.get(p[0]) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0][0];
}

/** A scope with two or more value fields is a form: each field gets its value type. */
export function addForms(elements: Element[]) {
    const byScope = new Map<string, Element[]>();
    for (const e of elements) {
        if (!e.grammar || e.key || !e.role || !ROLE_TABLE[e.role].value) {
            continue;
        }
        const s = e.scope.join('.');
        byScope.set(s, [...(byScope.get(s) ?? []), e]);
    }
    for (const [scope, fields] of byScope) {
        if (fields.length < 2) {
            continue;
        }

        // names shared by fields of different roles (a setting row's value is a text box, a spin button or a select):
        // each field takes its role too
        const shared = new Set(fields.map((f) => f.name).filter((n, i, all) => all.indexOf(n) !== i));
        for (const f of fields) {
            const field = shared.has(f.name) ? `${f.name}_${f.role}` : f.name;
            f.form = {scope, field, valueType: ROLE_TABLE[f.role!].value!};
        }
    }
}

/** A part's suffix as values: `.close--button`, or `.tab:` + a typed key gap + `--tab`. */
export function suffixValues(part: TestPart, expr: string): Value[] {
    const at = part.suffix.indexOf(KEY_PLACEHOLDER);
    if (at < 0) {
        return [lit(part.suffix)];
    }
    const type = part.key ?? 'string';
    const values = type.split(' | ').every((t) => (/^"[^"]*"$/).test(t)) ? type.split(' | ').map((t) => JSON.parse(t) as string) : null;
    let kind: Gap['kind'] = 'string';
    if (values) {
        kind = 'set';
    } else if (type === 'number') {
        kind = 'number';
    }
    const gap: Gap = {kind, type, expr: `${expr}${part.suffix.slice(0, at)}`, ...(values ? {values} : {})};
    return [{k: 'pat', parts: [part.suffix.slice(0, at), {gap}, part.suffix.slice(at + KEY_PLACEHOLDER.length)]}];
}

/** The variables a JSX child can render: `x`, both arms of `c ? x : y`, the value side of `c && x`, `x || y`, `x ?? y`. */
export function pickedIdentifiers(e: ts.Expression): ts.Identifier[] {
    const s = strip(e) as ts.Expression;
    if (typescript.isIdentifier(s)) {
        return [s];
    }
    if (typescript.isConditionalExpression(s)) {
        return [...pickedIdentifiers(s.whenTrue), ...pickedIdentifiers(s.whenFalse)];
    }
    if (typescript.isBinaryExpression(s)) {
        const op = s.operatorToken.kind;
        if (op === typescript.SyntaxKind.AmpersandAmpersandToken) {
            return pickedIdentifiers(s.right);
        }
        if (op === typescript.SyntaxKind.BarBarToken || op === typescript.SyntaxKind.QuestionQuestionToken) {
            return [...pickedIdentifiers(s.left), ...pickedIdentifiers(s.right)];
        }
    }
    return [];
}

/** Whether an expression sits in a JSX child position (`{…}` between tags), not in an attribute. */
export function inJsxChildren(n: ts.Node): boolean {
    for (let p = n.parent; p; p = p.parent) {
        if (typescript.isJsxAttribute(p) || typescript.isJsxSpreadAttribute(p)) {
            return false;
        }
        if (typescript.isJsxExpression(p)) {
            return typescript.isJsxElement(p.parent) || typescript.isJsxFragment(p.parent);
        }
        if (typescript.isSourceFile(p) || typescript.isFunctionDeclaration(p) || typescript.isClassLike(p)) {
            return false;
        }
    }
    return false;
}

/** Calls whose values are returned as rendered content, including expression-bodied components. */
export function inRenderReturn(node: ts.Node, root: ts.Node): boolean {
    if (node === root) {
        return true;
    }
    let returned = false;
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (typescript.isJsxAttribute(parent) || typescript.isJsxSpreadAttribute(parent)) {
            return false;
        }
        returned ||= typescript.isReturnStatement(parent);
        if (isFunctionLike(parent)) {
            if (parent === root) {
                return returned || (typescript.isArrowFunction(parent) && !typescript.isBlock(parent.body));
            }
            return typescript.isClassLike(root) && typescript.isMethodDeclaration(parent) && propName(parent.name) === 'render' && returned;
        }
        if (parent === root) {
            return true;
        }
    }
    return false;
}

/** A statement that always leaves the function: `return …`, `throw …`, or a block ending in one. */
export function alwaysReturns(st: ts.Statement): boolean {
    if (typescript.isReturnStatement(st) || typescript.isThrowStatement(st)) {
        return true;
    }
    return typescript.isBlock(st) && st.statements.length > 0 && alwaysReturns(st.statements[st.statements.length - 1]);
}

/** The plugin slots a host's report publishes, or why it can't be read. */
export function readHostSlots(report: string, configAt: string): {slots: HostSlot[]} | {diagnostic: Diagnostic} {
    const read = readVersioned<{version: number; pluginSlots?: Record<string, string>}>(report, 4, `Host surface report ${report}`, configAt);
    return 'value' in read ? {slots: Object.entries(read.value.pluginSlots ?? {}).map(([slot, template]) => ({slot, template}))} : read;
}
