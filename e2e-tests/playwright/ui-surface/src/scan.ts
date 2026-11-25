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

/**
 * A list key must name entity identity (`post.id`, `pluginId`), never display text that varies by locale or data, and
 * never the map index (position is not stable identity). `section` is the settings section id (`theme`, `email`) that
 * SettingItemMin already uses to build DOM ids.
 */
const IDENTITY_KEY = /^(?:id|key|section)$|(?:Id|_id|Key|_key|Ids)$/;

/** Map/`forEach` index names and display-text fields that must never key a list. */
const INDEX_NAME = /^(?:index|idx|i)$/;
const DISPLAY_TEXT = /^(?:display_name|name|title|label|text|message|description|caption|heading|subtitle)$/;

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
    keyField?: string;
    attr: 'data-testid' | 'data-surface';
    file: string;
    line: number;
};

export type Diagnostic = {
    rule: 'grammar' | 'duplicates' | 'role-fit' | 'stale-reference' | 'dynamic' | 'key-origin' | 'legacy-testid' | 'drift';
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

/** A key-origin diagnostic worded for the kind of bad key found, with the exact fix. */
function keyOriginMessage(expr: string, kind: Exclude<KeyKind, 'identity'>): string {
    const why = {
        index: 'the map index is a position, not identity: reorder or insert and every key shifts',
        display: 'display text is locale- and data-dependent',
        composite: 'a composite string concatenates identities: key the item by one entity id',
        unknown: 'its origin could not be resolved to an identity field (id, *Id, key, section)',
    }[kind];
    return `Key \`${expr}\` is not an identity field — ${why}. Key by an entity id, or allow-list it with a reason.`;
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

/** Local aliases (`const id = t.display_name`) and index parameters (`items.map((x, index) => ...)`) in one file. */
type KeyScope = {aliases: Map<string, ts.Expression>; indexParams: Set<string>};

export type KeyKind = 'identity' | 'index' | 'display' | 'composite' | 'unknown';

/** Strip transparent wrappers that do not change a key's origin. */
function unwrapKey(expr: ts.Expression): ts.Expression {
    let cur: ts.Expression = expr;
    while (
        ts.isParenthesizedExpression(cur) ||
        ts.isNonNullExpression(cur) ||
        ts.isAsExpression(cur) ||
        (ts.isBinaryExpression(cur) && cur.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
        cur = ts.isBinaryExpression(cur) ? cur.left : cur.expression;
    }
    return cur;
}

/** Last identifier of a key expression: `component.pluginId` -> `pluginId`, `item?.id ?? ''` -> `id`. */
function keyName(expr: ts.Expression): string | undefined {
    const cur = unwrapKey(expr);
    if (ts.isIdentifier(cur)) {
        return cur.text;
    }
    if (ts.isPropertyAccessExpression(cur)) {
        return cur.name.text;
    }
    return undefined;
}

/**
 * Collect per-file local alias initialisers and map/forEach index parameters, so a key written through a local name
 * (`const id = t.display_name`) or an index param resolves to its real origin. Single file only, no cross-module
 * resolution (lean by design); a one-hop import would need the importing file's program, which we deliberately avoid.
 */
function collectKeyScope(source: ts.SourceFile): KeyScope {
    const aliases = new Map<string, ts.Expression>();
    const indexParams = new Set<string>();
    const ITERATORS = new Set(['map', 'forEach', 'flatMap', 'filter', 'reduce', 'some', 'every']);
    const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && !aliases.has(node.name.text)) {
            aliases.set(node.name.text, node.initializer);
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ITERATORS.has(node.expression.name.text)) {
            const cb = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) as
                | ts.ArrowFunction
                | ts.FunctionExpression
                | undefined;
            const idxParam = cb?.parameters[1]?.name;
            if (idxParam && ts.isIdentifier(idxParam)) {
                indexParams.add(idxParam.text);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return {aliases, indexParams};
}

/**
 * Classify a list key's origin by resolving local aliases and index params with the file's AST. `identity` passes;
 * `index`, `display` and `composite` are rejected; `unknown` keeps the previous strict behaviour (non-identity fails).
 */
export function classifyKey(expr: ts.Expression, scope: KeyScope, depth = 0): KeyKind {
    const cur = unwrapKey(expr);
    if (ts.isBinaryExpression(cur) && cur.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return 'composite';
    }
    if (ts.isTemplateExpression(cur)) {
        return 'composite';
    }
    if (ts.isIdentifier(cur)) {
        if (scope.indexParams.has(cur.text) || INDEX_NAME.test(cur.text)) {
            return 'index';
        }
        const alias = depth < 6 ? scope.aliases.get(cur.text) : undefined;
        if (alias) {
            return classifyKey(alias, scope, depth + 1);
        }
        if (DISPLAY_TEXT.test(cur.text)) {
            return 'display';
        }
        return IDENTITY_KEY.test(cur.text) ? 'identity' : 'unknown';
    }
    const name = keyName(cur);
    if (!name) {
        return 'unknown';
    }
    if (INDEX_NAME.test(name)) {
        return 'index';
    }
    if (DISPLAY_TEXT.test(name)) {
        return 'display';
    }
    return IDENTITY_KEY.test(name) ? 'identity' : 'unknown';
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

/**
 * Role check for a state/input kind on a custom (non-native) component. A design-system component in `roleMap` must
 * render the role it is declared with; one not in the map cannot be verified, so a state/input kind on it is rejected
 * (add it to role-map.json with its role, or use a native element). Returns a mismatch message, or undefined when fine.
 */
function customRoleMismatch(el: ts.JsxOpeningLikeElement, role: string, roleMap: Record<string, string>): string | undefined {
    if (STATE_ROLES.has(role) || ENTRY_ROLES.has(role) || role === 'radio') {
        const tag = el.tagName.getText();
        const mapped = roleMap[tag];
        if (mapped === undefined) {
            return `state/input kind "--${role}" on custom <${tag}> cannot be verified; add <${tag}> to ui-surface/role-map.json with the role it renders, or use a native element`;
        }
        // "text" satisfies any text-entry role; "any" opts out of the check for a component that varies its semantics.
        const satisfied = mapped === role || mapped === 'any' || (mapped === 'text' && ENTRY_ROLES.has(role));
        if (!satisfied) {
            return `custom <${tag}> renders role "${mapped}" but is marked "--${role}"`;
        }
    }
    return undefined;
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
    roleMap?: Record<string, string>;
    driftAllow?: Record<string, string>;
}): SurfaceReport {
    const roleMap = options.roleMap ?? {};
    const driftAllow = options.driftAllow ?? {};
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
        const keyScope = collectKeyScope(source);
        const report = (rule: Diagnostic['rule'], node: ts.Node, id: string, message: string) => {
            const {line} = source.getLineAndCharacterOfPosition(node.getStart(source));
            diagnostics.push({rule, file: rel, line: line + 1, id, message});
        };

        const visit = (node: ts.Node) => {
            const el = openingOf(node);
            if (el) {
                // Drift: an element carrying both attributes must agree. They agree when identical, or when the legacy
                // testid is mapped to this surface id in testid-surface-map.json (a documented, intentional pairing).
                const litTestId = readAttr(el, 'data-testid');
                const litSurface = readAttr(el, 'data-surface');
                if (
                    typeof litTestId === 'string' &&
                    typeof litSurface === 'string' &&
                    litTestId !== litSurface &&
                    driftAllow[litTestId] !== litSurface
                ) {
                    report(
                        'drift',
                        node,
                        litTestId,
                        `data-testid "${litTestId}" and data-surface "${litSurface}" disagree on the same element; make them equal, or map the legacy id to the surface id in ui-surface/testid-surface-map.json with a reason`,
                    );
                }
                const surfaceScope = litSurface;
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
                        if (found.keyExpr) {
                            const kind = classifyKey(found.keyExpr, keyScope);
                            if (kind !== 'identity') {
                                report('key-origin', node, found.id, keyOriginMessage(found.keyExpr.getText(source), kind));
                            }
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
                                keyField: found.keyExpr ? keyName(found.keyExpr) : undefined,
                                attr: attrName,
                                file: rel,
                                line: line + 1,
                            };
                            entries.push(entry);
                            scopes[parsed.scope] ??= {parts: [], containerFiles: []};
                            scopes[parsed.scope].parts.push(entry);
                            if (parsed.role && isNativeTag(el) && hasRoleMismatch(el, parsed.role)) {
                                report(
                                    'role-fit',
                                    node,
                                    found.id,
                                    `Element <${el.tagName.getText()}> does not satisfy "--${parsed.role}" semantics`,
                                );
                            } else if (parsed.role && !isNativeTag(el)) {
                                const custom = customRoleMismatch(el, parsed.role, roleMap);
                                if (custom) {
                                    report('role-fit', node, found.id, custom);
                                }
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

    diagnostics.push(...crossFileDuplicates(entries));

    diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
    return {
        entries,
        scopes,
        diagnostics,
        stats: {files: filePaths.length, durationMs: Math.round(performance.now() - started)},
    };
}

/** Every element carrying both a literal data-testid and a literal data-surface that differ, as a testid->surface map. */
export function collectTestIdSurfacePairs(options: {roots: string[]; cwd?: string; files?: Record<string, string>}): Record<string, string> {
    const cwd = options.cwd ?? process.cwd();
    const pairs: Record<string, string> = {};
    const filePaths = options.files ? Object.keys(options.files).sort() : collectFiles(options.roots, cwd);
    for (const file of filePaths) {
        const content = options.files ? options.files[file] : readFileSync(file, 'utf8');
        if (!content.includes('data-testid') || !content.includes('data-surface')) {
            continue;
        }
        const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            const el = openingOf(node);
            if (el) {
                const t = readAttr(el, 'data-testid');
                const s = readAttr(el, 'data-surface');
                if (typeof t === 'string' && typeof s === 'string' && t !== s) {
                    pairs[t] = s;
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return pairs;
}

/** The same id declared in two files can render twice at once; one file's ternary branches cannot. Cross-file only. */
export function crossFileDuplicates(entries: SurfaceEntry[]): Diagnostic[] {
    const out: Diagnostic[] = [];
    const filesById = new Map<string, SurfaceEntry[]>();
    for (const entry of entries) {
        const list = filesById.get(entry.id) ?? [];
        list.push(entry);
        filesById.set(entry.id, list);
    }
    for (const [id, list] of filesById) {
        const files = [...new Set(list.map((entry) => entry.file))];
        if (files.length > 1 && !list[0].keyed) {
            out.push({
                rule: 'duplicates',
                file: list[0].file,
                line: list[0].line,
                id,
                message: `"${id}" is also declared in ${files.slice(1).join(', ')}; scope one of them`,
            });
        }
    }
    return out;
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

/** Every id the webapp source can render, for checking legacy (non-grammar) references. */
export type SourceIdIndex = {literals: Set<string>; patterns: RegExp[]};

const HTML_ATTR_ID = /data-(?:testid|surface)="([^"]+)"/g;

/** A pattern needs this many literal characters; `${a}${b}` matches anything, so its ids go to the allow list. */
const MIN_PATTERN_LITERAL = 3;

function patternOf(parts: Array<string | null>): RegExp | undefined {
    if (!parts.includes(null) || parts.filter((part) => part !== null).join('').length < MIN_PATTERN_LITERAL) {
        return undefined;
    }
    const body = parts.map((part) => (part === null ? '.+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
    return new RegExp(`^${body}$`);
}

function concatParts(expr: ts.Expression, out: Array<string | null>): Array<string | null> {
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        concatParts(expr.left, out);
        concatParts(expr.right, out);
    } else if (ts.isParenthesizedExpression(expr)) {
        concatParts(expr.expression, out);
    } else {
        out.push(ts.isStringLiteralLike(expr) ? expr.text : null);
    }
    return out;
}

/**
 * Index every string the webapp could render as a testid: string literals, object keys (`data-testid={definitionKey}`),
 * `data-testid="..."` inside HTML strings, and templates or `+` concatenations as patterns. Ids passed through props
 * still resolve because the literal lives at the call site.
 */
export function indexSourceIds(options: {
    roots: string[];
    cwd?: string;
    files?: Record<string, string>;
}): SourceIdIndex {
    const cwd = options.cwd ?? process.cwd();
    const literals = new Set<string>();
    const patterns = new Map<string, RegExp>();
    const addPattern = (pattern?: RegExp) => pattern && patterns.set(pattern.source, pattern);
    const addText = (text: string) => {
        literals.add(text);
        for (const match of text.matchAll(HTML_ATTR_ID)) {
            literals.add(match[1]);
        }
    };
    const filePaths = options.files ? Object.keys(options.files).sort() : collectFiles(options.roots, cwd);
    for (const file of filePaths) {
        const content = options.files ? options.files[file] : readFileSync(file, 'utf8');
        const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            if (ts.isStringLiteralLike(node)) {
                addText(node.text);
            } else if (ts.isTemplateExpression(node)) {
                const literalsOnly = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
                literalsOnly.forEach(addText);
                addPattern(
                    patternOf([node.head.text, ...node.templateSpans.flatMap((span) => [null, span.literal.text])]),
                );
            } else if (
                ts.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
                !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)
            ) {
                addPattern(patternOf(concatParts(node, [])));
            } else if (
                (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node) || ts.isPropertySignature(node)) &&
                ts.isIdentifier(node.name)
            ) {
                literals.add(node.name.text);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return {literals, patterns: [...patterns.values()]};
}

function staleMessage(id: string, options: {knownIds: Set<string>; sourceIds?: SourceIdIndex}): string | undefined {
    if (parseTestId(id).valid) {
        return options.knownIds.has(id) ? undefined : `Referenced testid "${id}" was not declared in webapp`;
    }
    const {sourceIds} = options;
    if (!sourceIds || sourceIds.literals.has(id) || sourceIds.patterns.some((pattern) => pattern.test(id))) {
        return undefined;
    }
    return `Referenced testid "${id}" does not appear anywhere in webapp source`;
}

/**
 * Check Playwright and Cypress spec files for literal testids the webapp no longer renders. Grammar ids must match a
 * declared surface entry. Legacy ids are checked against `sourceIds` when given: an id whose text appears nowhere in
 * webapp source, not even as part of a template, is stale.
 */
export function checkStaleRefs(options: {
    specRoots?: string[];
    cwd?: string;
    knownIds: Set<string>;
    sourceIds?: SourceIdIndex;
    allow?: Set<string>;
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
                const message = id && !options.allow?.has(id) ? staleMessage(id, options) : undefined;
                if (id && message) {
                    const {line} = source.getLineAndCharacterOfPosition(node.getStart(source));
                    diagnostics.push({rule: 'stale-reference', file: rel, line: line + 1, id, message});
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return diagnostics;
}
