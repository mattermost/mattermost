// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';

import {globSync} from 'glob';
import ts from 'typescript';

export const DRIVER_ROLES = new Set([
    'button',
    'togglebutton',
    'link',
    'text',
    'container',
    'checkbox',
    'switch',
    'radio',
    'tab',
    'option',
    'menuitem',
    'textbox',
    'searchbox',
    'spinbutton',
    'combobox',
    'listitem',
    'row',
    'dialog',
    'region',
    'file',
]);

export const STATE_ROLES = new Set(['checkbox', 'switch', 'radio', 'tab', 'option', 'togglebutton']);
export const ENTRY_ROLES = new Set(['textbox', 'searchbox', 'spinbutton', 'combobox']);
const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
]);
const PATH_WORD = /^[a-z][a-z0-9_]*$/;
const TESTID_METHOD = /^(?:getByTestId|findByTestId|queryByTestId|findAllByTestId|getAllByTestId)$/;
const CSS_METHOD = /^(?:locator|find|contains|\$)$/;
const EXACT_TESTID_CSS = /^\[data-(?:testid|surface)=(?:"([^"]+)"|'([^']+)')\]$/;
const DYNAMIC = Symbol('dynamic');

/** A list key must name entity identity (`post.id`, `pluginId`, `index`), never display text that varies by locale or data. */
const IDENTITY_KEY = /^(?:id|key|index|idx|i)$|(?:Id|_id|Key|_key|Ids)$/;

export type ParsedTestId = {
    raw: string;
    scope: string;
    name: string;
    key?: string;
    role?: string;
    valid: boolean;
    error?: string;
};

export type SurfaceEntry = {
    id: string;
    scope: string;
    name: string;
    role: string;
    keyed: boolean;
    attr: 'data-testid' | 'data-surface';
    file: string;
    line: number;
};

export type Diagnostic = {
    rule: 'grammar' | 'duplicates' | 'role-fit' | 'stale-reference' | 'dynamic' | 'key-origin';
    file: string;
    line: number;
    id: string;
    message: string;
};

export type SurfaceReport = {
    entries: SurfaceEntry[];
    scopes: Record<string, {parts: SurfaceEntry[]; containerFiles: string[]}>;
    diagnostics: Diagnostic[];
    stats: {files: number; durationMs: number};
};

/** Parse `scope.name[:key][--role]` testids into structural parts. */
export function parseTestId(raw: string): ParsedTestId {
    const roleIdx = raw.lastIndexOf('--');
    const role = roleIdx >= 0 ? raw.slice(roleIdx + 2) : undefined;
    const base = roleIdx >= 0 ? raw.slice(0, roleIdx) : raw;
    const colonIdx = base.indexOf(':');
    const key = colonIdx >= 0 ? base.slice(colonIdx + 1) : undefined;
    const pathPart = colonIdx >= 0 ? base.slice(0, colonIdx) : base;
    const segments = pathPart.split('.');

    if (segments.length < 2 || !segments.every((seg) => PATH_WORD.test(seg))) {
        return {raw, scope: '', name: '', key, role, valid: false, error: 'Expected scope.name[:key][--role]'};
    }
    if (role !== undefined && !DRIVER_ROLES.has(role)) {
        return {raw, scope: '', name: '', key, role, valid: false, error: `Unknown role suffix "--${role}"`};
    }
    if (key !== undefined && !key) {
        return {raw, scope: '', name: '', key, role, valid: false, error: 'Empty key after ":"'};
    }
    return {
        raw,
        scope: segments.slice(0, -1).join('.'),
        name: segments[segments.length - 1],
        key,
        role,
        valid: true,
    };
}

/** Parse a 1-hop keyed template literal like `post_list.post:${id}--listitem`. */
export function parseTemplateTestId(head: string, tail: string): ParsedTestId | undefined {
    const colonIdx = head.indexOf(':');
    if (colonIdx < 1 || !head.endsWith(':')) {
        return undefined;
    }
    const roleIdx = tail.startsWith('--') ? 2 : -1;
    const role = roleIdx >= 0 ? tail.slice(roleIdx) : undefined;
    if (tail && role === undefined) {
        return undefined;
    }
    return parseTestId(`${head}key${role ? `--${role}` : ''}`);
}

function openingOf(node: ts.Node): ts.JsxOpeningLikeElement | undefined {
    if (ts.isJsxElement(node)) {
        return node.openingElement;
    }
    return ts.isJsxSelfClosingElement(node) ? node : undefined;
}

function readAttr(el: ts.JsxOpeningLikeElement, attrName: string): string | boolean | typeof DYNAMIC | undefined {
    for (const prop of el.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || prop.name.getText() !== attrName) {
            continue;
        }
        if (!prop.initializer) {
            return true;
        }
        if (ts.isStringLiteral(prop.initializer)) {
            return prop.initializer.text;
        }
        if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
            const expr = prop.initializer.expression;
            if (ts.isStringLiteralLike(expr)) {
                return expr.text;
            }
            if (expr.kind === ts.SyntaxKind.TrueKeyword) {
                return true;
            }
            if (expr.kind === ts.SyntaxKind.FalseKeyword) {
                return false;
            }
        }
        return DYNAMIC;
    }
    return undefined;
}

type AttrId = {id: string; keyed: boolean; keyExpr?: ts.Expression} | {dynamic: ts.Expression};

/** Last identifier of a key expression: `component.pluginId` -> `pluginId`, `item?.id ?? ''` -> `id`. */
function keyName(expr: ts.Expression): string | undefined {
    let cur: ts.Expression = expr;
    while (
        ts.isParenthesizedExpression(cur) ||
        ts.isNonNullExpression(cur) ||
        ts.isAsExpression(cur) ||
        (ts.isBinaryExpression(cur) && cur.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
        cur = ts.isBinaryExpression(cur) ? cur.left : cur.expression;
    }
    if (ts.isIdentifier(cur)) {
        return cur.text;
    }
    if (ts.isPropertyAccessExpression(cur)) {
        return cur.name.text;
    }
    return undefined;
}

function readAttrIds(el: ts.JsxOpeningLikeElement, attrName: 'data-testid' | 'data-surface'): AttrId[] {
    const out: AttrId[] = [];
    const pushExpr = (expr: ts.Expression) => {
        if (ts.isStringLiteralLike(expr)) {
            out.push({id: expr.text, keyed: false});
        } else if (ts.isTemplateExpression(expr) && expr.templateSpans.length === 1) {
            const parsed = parseTemplateTestId(expr.head.text, expr.templateSpans[0].literal.text);
            if (parsed?.valid) {
                out.push({
                    id: `${parsed.scope}.${parsed.name}:${parsed.role ? `--${parsed.role}` : ''}`,
                    keyed: true,
                    keyExpr: expr.templateSpans[0].expression,
                });
            } else {
                out.push({dynamic: expr});
            }
        } else if (ts.isConditionalExpression(expr)) {
            pushExpr(expr.whenTrue);
            pushExpr(expr.whenFalse);
        } else {
            out.push({dynamic: expr});
        }
    };
    for (const prop of el.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || prop.name.getText() !== attrName || !prop.initializer) {
            continue;
        }
        if (ts.isStringLiteral(prop.initializer)) {
            out.push({id: prop.initializer.text, keyed: false});
        } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
            pushExpr(prop.initializer.expression);
        }
    }
    return out;
}

function isNativeTag(el: ts.JsxOpeningLikeElement | undefined): el is ts.JsxOpeningLikeElement {
    return Boolean(el && /^[a-z][a-z\d]*$/.test(el.tagName.getText()));
}

function hasRoleMismatch(el: ts.JsxOpeningLikeElement, role: string): boolean {
    if (!isNativeTag(el) || (!STATE_ROLES.has(role) && !ENTRY_ROLES.has(role))) {
        return false;
    }
    const tag = el.tagName.getText();
    const rawType = readAttr(el, 'type');
    const type = typeof rawType === 'string' ? rawType.toLowerCase() : rawType;
    if (tag === 'input' && type === DYNAMIC) {
        return false;
    }
    if (STATE_ROLES.has(role)) {
        const ariaRole = readAttr(el, 'role');
        if (ariaRole === DYNAMIC) {
            return false;
        }
        if (typeof ariaRole === 'string' && ariaRole.trim()) {
            const declared = ariaRole.trim().split(/\s+/);
            return declared.length === 1 && declared[0] !== role;
        }
        return tag !== 'input' || type !== role || role === 'switch';
    }
    if (tag === 'input') {
        return role === 'spinbutton' ? type !== 'number' : NON_TEXT_INPUT_TYPES.has(String(type));
    }
    if (tag === 'textarea') {
        return role === 'spinbutton';
    }
    for (let cur: ts.Node | undefined = el; cur; cur = cur.parent) {
        const open = openingOf(cur);
        const editable = open && readAttr(open, 'contentEditable');
        if (
            editable === true ||
            editable === '' ||
            editable === 'true' ||
            editable === 'plaintext-only' ||
            editable === DYNAMIC
        ) {
            return false;
        }
        if (editable === false || editable === 'false') {
            break;
        }
    }
    return true;
}

function checkSiblingDuplicates(
    children: ts.NodeArray<ts.JsxChild>,
    seen: Set<string>,
    strictGrammar: boolean,
    report: (rule: Diagnostic['rule'], node: ts.Node, id: string, message: string) => void,
) {
    for (const child of children) {
        if (ts.isJsxFragment(child)) {
            checkSiblingDuplicates(child.children, seen, strictGrammar, report);
            continue;
        }
        const el = openingOf(child);
        if (!isNativeTag(el)) {
            continue;
        }
        for (const attrName of ['data-testid', 'data-surface'] as const) {
            const raw = readAttr(el, attrName);
            if (typeof raw === 'string' && (strictGrammar || parseTestId(raw).valid)) {
                if (seen.has(raw)) {
                    report('duplicates', child, raw, `Duplicate sibling ${attrName} "${raw}"`);
                }
                seen.add(raw);
            }
        }
    }
}

function isGrammarCandidate(raw: string): boolean {
    return raw.includes('--') || (raw.includes('.') && !raw.includes(' '));
}

function collectFiles(roots: string[], cwd: string): string[] {
    const out = new Set<string>();
    for (const root of roots) {
        const abs = resolve(cwd, root);
        for (const file of globSync('**/*.{ts,tsx,js,jsx}', {
            cwd: abs,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.stories.*', '**/*.d.ts'],
        })) {
            out.add(file);
        }
    }
    return [...out].sort();
}

/**
 * Shallow AST extraction of grammar testids and `data-surface` containers.
 * shortcut: skips cross-component dataflow and dynamic props; Playwright strict mode and runtime ARIA checks cover those at runtime.
 */
export function extractSurface(options: {
    roots: string[];
    cwd?: string;
    strictGrammar?: boolean;
    files?: Record<string, string>;
}): SurfaceReport {
    const started = performance.now();
    const cwd = options.cwd ?? process.cwd();
    const entries: SurfaceEntry[] = [];
    const scopes: SurfaceReport['scopes'] = {};
    const diagnostics: Diagnostic[] = [];
    const filePaths = options.files ? Object.keys(options.files).sort() : collectFiles(options.roots, cwd);

    for (const file of filePaths) {
        const content = options.files ? options.files[file] : readFileSync(file, 'utf8');
        if (!content.includes('data-testid') && !content.includes('data-surface')) {
            continue;
        }
        const rel = options.files ? file : relative(cwd, file);
        const source = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true);
        const report = (rule: Diagnostic['rule'], node: ts.Node, id: string, message: string) => {
            const {line} = source.getLineAndCharacterOfPosition(node.getStart(source));
            diagnostics.push({rule, file: rel, line: line + 1, id, message});
        };

        const visit = (node: ts.Node) => {
            const el = openingOf(node);
            if (el) {
                const surfaceScope = readAttr(el, 'data-surface');
                if (typeof surfaceScope === 'string' && !surfaceScope.includes('.') && PATH_WORD.test(surfaceScope)) {
                    scopes[surfaceScope] ??= {parts: [], containerFiles: []};
                    if (!scopes[surfaceScope].containerFiles.includes(rel)) {
                        scopes[surfaceScope].containerFiles.push(rel);
                    }
                }
                for (const attrName of ['data-testid', 'data-surface'] as const) {
                    for (const found of readAttrIds(el, attrName)) {
                        if ('dynamic' in found) {
                            // Legacy data-testid stays free-form; data-surface is the typed contract, so every value must resolve.
                            if (attrName === 'data-surface') {
                                report(
                                    'dynamic',
                                    node,
                                    found.dynamic.getText(source),
                                    'data-surface value must be a literal, a ternary of literals, or a one-key template (scope.name:<key>[--role])',
                                );
                            }
                            continue;
                        }
                        if (attrName === 'data-surface' && !found.id.includes('.') && !found.id.includes('--')) {
                            continue;
                        }
                        const key = found.keyExpr && keyName(found.keyExpr);
                        if (found.keyExpr && !(key && IDENTITY_KEY.test(key))) {
                            report(
                                'key-origin',
                                node,
                                found.id,
                                `Key \`${found.keyExpr.getText(source)}\` is not an identity field (id, *Id, key, index); display text makes ids locale- and data-dependent`,
                            );
                        }
                        const parsed = found.keyed ? parseTestId(found.id.replace(':', ':key')) : parseTestId(found.id);
                        const {line} = source.getLineAndCharacterOfPosition(node.getStart(source));
                        if (parsed.valid) {
                            const role =
                                parsed.role ??
                                (el.tagName.getText() === 'input' && readAttr(el, 'type') === 'file'
                                    ? 'file'
                                    : 'container');
                            const entry: SurfaceEntry = {
                                id: found.id,
                                scope: parsed.scope,
                                name: parsed.name,
                                role,
                                keyed: found.keyed,
                                attr: attrName,
                                file: rel,
                                line: line + 1,
                            };
                            entries.push(entry);
                            scopes[parsed.scope] ??= {parts: [], containerFiles: []};
                            scopes[parsed.scope].parts.push(entry);
                            if (parsed.role && hasRoleMismatch(el, parsed.role)) {
                                report(
                                    'role-fit',
                                    node,
                                    found.id,
                                    `Element <${el.tagName.getText()}> does not satisfy "--${parsed.role}" semantics`,
                                );
                            }
                        } else if (options.strictGrammar || isGrammarCandidate(found.id)) {
                            report('grammar', node, found.id, parsed.error ?? 'Invalid testid grammar');
                        }
                    }
                }
            }
            const inlineFragment =
                ts.isJsxFragment(node) &&
                node.parent &&
                (ts.isJsxFragment(node.parent) ||
                    (ts.isJsxElement(node.parent) && isNativeTag(node.parent.openingElement)));
            if ((ts.isJsxFragment(node) && !inlineFragment) || (ts.isJsxElement(node) && isNativeTag(el))) {
                checkSiblingDuplicates(node.children, new Set(), Boolean(options.strictGrammar), report);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }

    // The same id declared in two files can render twice at once; one file's ternary branches cannot.
    const filesById = new Map<string, SurfaceEntry[]>();
    for (const entry of entries) {
        const list = filesById.get(entry.id) ?? [];
        list.push(entry);
        filesById.set(entry.id, list);
    }
    for (const [id, list] of filesById) {
        const files = [...new Set(list.map((entry) => entry.file))];
        if (files.length > 1 && !list[0].keyed) {
            diagnostics.push({
                rule: 'duplicates',
                file: list[0].file,
                line: list[0].line,
                id,
                message: `"${id}" is also declared in ${files.slice(1).join(', ')}; scope one of them`,
            });
        }
    }

    diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
    return {
        entries,
        scopes,
        diagnostics,
        stats: {files: filePaths.length, durationMs: Math.round(performance.now() - started)},
    };
}

function lookupIdFromCall(call: ts.CallExpression): string | undefined {
    const [arg] = call.arguments;
    if (!arg || !ts.isStringLiteralLike(arg)) {
        return undefined;
    }
    const callee = call.expression;
    const member = ts.isPropertyAccessExpression(callee) ? callee : undefined;
    const method = member?.name.text ?? (ts.isIdentifier(callee) ? callee.text : '');
    if (TESTID_METHOD.test(method)) {
        return arg.text;
    }
    const isCyGet = method === 'get' && member?.expression.getText() === 'cy';
    if (isCyGet || CSS_METHOD.test(method)) {
        return EXACT_TESTID_CSS.exec(arg.text)
            ?.slice(1)
            .find((val) => val !== undefined);
    }
    return undefined;
}

/** Check Playwright and Cypress spec files for literal testids missing from extracted webapp entries. */
export function checkStaleRefs(options: {
    specRoots?: string[];
    cwd?: string;
    knownIds: Set<string>;
    allow?: Set<string>;
    onlyGrammarIds?: boolean;
    files?: Record<string, string>;
}): Diagnostic[] {
    const cwd = options.cwd ?? process.cwd();
    const specFiles = options.files ? Object.keys(options.files).sort() : collectFiles(options.specRoots ?? [], cwd);
    const diagnostics: Diagnostic[] = [];

    for (const file of specFiles) {
        const content = options.files ? options.files[file] : readFileSync(file, 'utf8');
        const rel = options.files ? file : relative(cwd, file);
        const source = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const id = lookupIdFromCall(node);
                const checkable = id && (!options.onlyGrammarIds || parseTestId(id).valid);
                if (checkable && !options.knownIds.has(id) && !options.allow?.has(id)) {
                    const {line} = source.getLineAndCharacterOfPosition(node.getStart(source));
                    diagnostics.push({
                        rule: 'stale-reference',
                        file: rel,
                        line: line + 1,
                        id,
                        message: `Referenced testid "${id}" was not declared in webapp`,
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return diagnostics;
}
