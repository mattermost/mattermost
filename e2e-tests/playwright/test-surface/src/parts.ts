// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type ts from 'typescript';

import {attrValue, isFunctionLike, isIntrinsic, isJsxTag, jsxAttr, strip, tagName, typeText, type JsxTag} from './ast.ts';
import {cmp} from './compare.ts';
import {relativeToRoot, type Config} from './config.ts';
import {isGrammarError, KEY_PLACEHOLDER, parseTestId} from './grammar.ts';
import {inputDiagnostic, readVersioned} from './input.ts';
import type {Diagnostic, Loc, TestPart, TestParts} from './manifest_types.ts';
import type {CodeNode, ProgramIndex} from './program_index.ts';
import {entryDriverFits, requiresRoleFit} from './role_table.ts';
import {asWritten, type AriaRole, type Roles} from './roles.ts';
import {typescript} from './typescript.ts';
import type {Resolver} from './values.ts';

type Part = Omit<TestPart, 'at'> & {at: Loc};

/** Reads scoped part declarations for host and library component families. */
export class FamilyParts {
    private readonly memo = new Map<CodeNode, Part[]>();
    private readonly roleMemo = new Map<CodeNode, AriaRole | null>();
    readonly diagnostics: Diagnostic[] = [];
    private readonly ix: ProgramIndex;
    private readonly R: Resolver;
    private readonly roles: Roles;
    private readonly testIdProp: string;

    constructor(ix: ProgramIndex, R: Resolver, roles: Roles, opts: {testIdProp: string}) {
        this.ix = ix;
        this.R = R;
        this.roles = roles;
        this.testIdProp = opts.testIdProp;
    }

    /** Every component the entry module exports, by export name. */
    exports(entry: string): Array<{name: string; node: CodeNode}> {
        const sf = this.ix.program.getSourceFile(entry);
        const mod = sf && this.ix.checker.getSymbolAtLocation(sf);
        if (!mod) {
            throw new Error(`library entry ${entry} is not in the program`);
        }
        const out: Array<{name: string; node: CodeNode}> = [];
        for (const sym of this.ix.checker.getExportsOfModule(mod)) {
            const node = this.ix.resolveSymbolToNode(sym);
            if (node && this.rendersJsx(node)) {
                out.push({name: sym.getName(), node});
            }
        }
        return out.sort((a, b) => cmp(a.name, b.name));
    }

    build(entry: string, pkg: {name: string; version: string}): TestParts {
        const components: TestParts['components'] = {};
        for (const {name, node} of this.exports(entry)) {
            const parts = this.partsOf(node);
            const role = this.rootRole(node);
            if (parts.length || role) {
                components[name] = {at: this.ix.ref(node), role, parts};
            }
        }
        return {version: TEST_PARTS_VERSION, package: pkg.name, packageVersion: pkg.version, testIdProp: this.testIdProp, components};
    }

    private rendersJsx(n: CodeNode): boolean {
        let found = false;
        const visit = (x: ts.Node) => {
            if (found) {
                return;
            }
            if (isJsxTag(x) || typescript.isJsxFragment(x)) {
                found = true;
                return;
            }
            typescript.forEachChild(x, visit);
        };
        visit(n);
        return found;
    }

    /** Whether `e` reads this component's `testId` prop. */
    private isTestId(e: ts.Expression | undefined, comp: CodeNode): boolean {
        const pp = e && this.R.propsPath(e);
        return Boolean(pp && pp.comp === comp && pp.path.length === 1 && pp.path[0] === this.testIdProp);
    }

    /** A template rooted at the component's scope prop; no code-level composition helper is needed. */
    private partTemplate(e: ts.Expression | undefined, comp: CodeNode): {suffix: string; key?: string} | null {
        const expression = e && strip(e) as ts.Expression;
        if (!expression) {
            return null;
        }
        if (this.isTestId(expression, comp)) {
            return {suffix: ''};
        }
        if (!typescript.isTemplateExpression(expression) || expression.head.text !== '' || !this.isTestId(expression.templateSpans[0]?.expression, comp)) {
            return null;
        }
        let suffix = expression.templateSpans[0].literal.text;
        let key: string | undefined;
        for (const span of expression.templateSpans.slice(1)) {
            if (key || !suffix.endsWith(':')) {
                this.diagnostics.push({rule: 'key-origin', severity: 'error', at: this.ix.where(expression), message: 'A scoped part key must be exactly one interpolation.'});
                return null;
            }
            key = typeText(this.ix.checker, this.ix.checker.getTypeAtLocation(span.expression));
            suffix += KEY_PLACEHOLDER + span.literal.text;
        }
        return {suffix, ...(key ? {key} : {})};
    }

    /** The parts a component derives from its `testId`, including those of the children it forwards `testId` to. */
    partsOf(comp: CodeNode, stack = new Set<CodeNode>()): Part[] {
        const memo = this.memo.get(comp);
        if (memo) {
            return memo;
        }
        if (stack.has(comp)) {
            return [];
        }
        stack.add(comp);
        const out: Part[] = [];
        const visit = (n: ts.Node) => {
            if (isJsxTag(n)) {
                out.push(...this.partsAtTag(n, comp, stack));
            }
            typescript.forEachChild(n, visit);
        };
        visit(isFunctionLike(comp) && comp.body ? comp.body : comp);
        stack.delete(comp);
        const unique = [...new Map(out.map((p) => [`${p.suffix}|${p.when?.prop ?? ''}|${p.when?.set ?? ''}`, p])).values()].
            sort((a, b) => cmp(a.suffix, b.suffix) || cmp(a.when?.prop ?? '', b.when?.prop ?? ''));
        this.memo.set(comp, unique);
        return unique;
    }

    private partsAtTag(tag: JsxTag, comp: CodeNode, stack: Set<CodeNode>): Part[] {
        const out: Part[] = [];

        // data-testid={testId ? `${testId} '.close--button')} (or a conditional between such calls)
        const dt = attrValue(jsxAttr(tag, 'data-testid'));
        for (const {expr, when} of this.branches(dt, comp)) {
            const call = this.partTemplate(expr, comp);
            if (call) {
                out.push(this.part(call, tag, comp, when));
            }
        }

        // A child receiving the scope unchanged forwards parts; a derived scope is a child family. '.checkbox')} / {...props}
        const child = isIntrinsic(tag) ? null : this.ix.componentOfTag(tag);
        if (child && child !== comp && !this.ix.isLibraryNode(child)) {
            const tv = attrValue(jsxAttr(tag, this.testIdProp));
            let prefix: string | null = null;
            if (tv && this.isTestId(tv, comp)) {
                prefix = '';
            } else if (tv) {
                const call = this.partTemplate(tv, comp);
                prefix = call && !call.key ? call.suffix : null;
            } else if (this.spreadsTestId(tag, comp)) {
                prefix = '';
            }
            if (prefix === '') {
                for (const p of this.partsOf(child, stack)) {
                    out.push({...p, suffix: prefix + p.suffix});
                }
            }
        }
        return out;
    }

    /** `{...props}` / `{...rest}` of this component on the tag. */
    private propsSpread(tag: JsxTag, comp: CodeNode): ts.JsxSpreadAttribute[] {
        return tag.attributes.properties.filter((a): a is ts.JsxSpreadAttribute => {
            if (!typescript.isJsxSpreadAttribute(a)) {
                return false;
            }
            const pp = this.R.restPropsOf(a.expression) ?? this.R.propsPath(a.expression);
            return Boolean(pp && pp.comp === comp && !pp.path.length);
        });
    }

    /** `{...props}` / `{...rest}` of this component, when `testId` wasn't destructured out of it. */
    private spreadsTestId(tag: JsxTag, comp: CodeNode): boolean {
        return this.propsSpread(tag, comp).some((a) => {
            const d = typescript.isIdentifier(a.expression) ? this.ix.checker.getSymbolAtLocation(a.expression)?.valueDeclaration : undefined;
            const pattern = d && typescript.isBindingElement(d) && typescript.isObjectBindingPattern(d.parent) ? d.parent : null;
            return !pattern || !pattern.elements.some((el) => !el.dotDotDotToken && (el.propertyName ?? el.name).getText() === this.testIdProp);
        });
    }

    /** `cond ? a : b` -> each arm with the prop condition it needs (`toggled === undefined`). */
    private branches(e: ts.Expression | undefined, comp: CodeNode): Array<{expr: ts.Expression; when?: TestPart['when']}> {
        const x = e && strip(e) as ts.Expression;
        if (!x) {
            return [];
        }
        if (typescript.isConditionalExpression(x)) {
            const test = this.propTest(x.condition, comp);
            const c = test?.prop === this.testIdProp ? null : test;
            return [
                ...this.branches(x.whenTrue, comp).map((b) => ({...b, when: b.when ?? c ?? undefined})),
                ...this.branches(x.whenFalse, comp).map((b) => ({...b, when: b.when ?? (c ? {prop: c.prop, set: !c.set} : undefined)})),
            ];
        }
        return [{expr: x}];
    }

    /** `x === undefined`, `x != null`, `x`, `!x` on a prop -> {prop, set}. */
    private propTest(e: ts.Expression, comp: CodeNode): TestPart['when'] | null {
        const x = strip(e) as ts.Expression;
        const propOf = (y: ts.Expression) => {
            const pp = this.R.propsPath(y);
            return pp && pp.comp === comp && pp.path.length === 1 ? pp.path[0] : null;
        };
        if (typescript.isPrefixUnaryExpression(x) && x.operator === typescript.SyntaxKind.ExclamationToken) {
            const inner = this.propTest(x.operand, comp);
            return inner && {prop: inner.prop, set: !inner.set};
        }
        if (typescript.isBinaryExpression(x) && ['undefined', 'null'].includes(x.right.getText())) {
            const prop = propOf(x.left);
            const k = x.operatorToken.kind;
            const eq = k === typescript.SyntaxKind.EqualsEqualsEqualsToken || k === typescript.SyntaxKind.EqualsEqualsToken;
            const ne = k === typescript.SyntaxKind.ExclamationEqualsEqualsToken || k === typescript.SyntaxKind.ExclamationEqualsToken;
            return prop && (eq || ne) ? {prop, set: ne} : null;
        }
        const prop = propOf(x);
        return prop ? {prop, set: true} : null;
    }

    private part(call: {suffix: string; key?: string}, tag: JsxTag, comp: CodeNode, when?: TestPart['when']): Part {
        const parsed = parseTestId(`lib.part${call.suffix.replace(KEY_PLACEHOLDER, 'k')}`);
        const role = isGrammarError(parsed) ? null : parsed.role;
        const at = this.ix.where(tag);
        if (isGrammarError(parsed)) {
            this.diagnostics.push({rule: 'parts', severity: 'error', at, message: `Part "${call.suffix}" doesn't follow the testid grammar: ${parsed.message}`});
        } else if (requiresRoleFit(role) && isIntrinsic(tag)) {
            const resolved = this.roles.ofIntrinsic(tag);
            const actual = resolved.role;
            const pressable = (r: string | null) => r === 'button' || r === 'togglebutton';
            const ok = actual === role || (pressable(role) && pressable(actual)) || (role === 'textbox' && actual === 'searchbox') || (role === 'searchbox' && actual === 'textbox');
            const entryFit = entryDriverFits(role, this.roles.textEntry(tag));
            if (entryFit === true) {
                // The input driver's operation is supported by the intrinsic element itself.
            } else if (entryFit === false) {
                this.diagnostics.push({rule: 'parts', severity: 'error', at, message: `Part "${call.suffix}" is not on a fillable native or editable element.`});
            } else if (resolved.unresolvedRole) {
                for (const known of new Set(resolved.knownRoles ?? [])) {
                    const matches = known === role || (pressable(role) && pressable(known)) || (role === 'textbox' && known === 'searchbox') || (role === 'searchbox' && known === 'textbox');
                    if (!matches) {
                        this.diagnostics.push({rule: 'parts', severity: 'error', at, message: `Part "${call.suffix}" can render with role ${known}.`});
                    }
                }
                this.diagnostics.push({rule: 'unresolved', severity: 'warning', at, message: `Part "${call.suffix}" has an unreadable declared state/input role.`});
            } else if (!ok) {
                this.diagnostics.push({rule: 'parts', severity: 'error', at, message: `Part "${call.suffix}" is on a <${tag.tagName.getText()}> with role ${actual ?? 'none'}.`});
            }
        }

        const file = isIntrinsic(tag) && tagName(tag) === 'input' && this.roles.attrLiterals(tag, 'type')?.every((type) => type === 'file');
        return {suffix: call.suffix, role, ...(file ? {native: 'file' as const} : {}), ...(call.key ? {key: call.key} : {}), ...(when ? {when} : {}), at: this.ix.ref(tag)};
    }

    /** The role `data-testid` (passed through `{...rest}`) lands on. */
    rootRole(comp: CodeNode, stack = new Set<CodeNode>()): AriaRole | null {
        if (this.roleMemo.has(comp)) {
            return this.roleMemo.get(comp)!;
        }
        if (stack.has(comp)) {
            return null;
        }
        stack.add(comp);
        let role: AriaRole | null = null;
        const visit = (n: ts.Node) => {
            if (role !== null) {
                return;
            }
            if (isJsxTag(n) && this.propsSpread(n, comp).length) {
                if (isIntrinsic(n)) {
                    role = this.roles.ofIntrinsic(n).role;

                    // `aria-pressed={toggled === undefined ? undefined : toggled}`: a toggle only when the prop is set
                    const pressed = attrValue(jsxAttr(n, 'aria-pressed'));
                    if (role === 'togglebutton' && pressed && (/\bundefined\b/).test(pressed.getText())) {
                        role = 'button';
                    }
                } else {
                    const explicit = this.roles.attrLiterals(n, 'role');
                    const child = this.ix.componentOfTag(n);
                    role = (explicit?.[0] ? asWritten(explicit[0]) : null) ?? (child ? this.rootRole(child, stack) : null);
                }
            }
            typescript.forEachChild(n, visit);
        };
        visit(isFunctionLike(comp) && comp.body ? comp.body : comp);
        stack.delete(comp);
        this.roleMemo.set(comp, role);
        return role;
    }
}

/** Reads the library's package.json next to the config root. */
export function packageOf(config: Config): {name: string; version: string} {
    const pkg = JSON.parse(fs.readFileSync(path.join(config.root, 'package.json'), 'utf8')) as {name: string; version: string};
    return {name: pkg.name, version: pkg.version};
}

/** A library's published `test-parts.json`, and the directory its declarations live in. */
export type PublishedParts = {package: string; dir: string; parts: TestParts};

/** The `test-parts.json` format this version reads (`TestParts.version`). */
export const TEST_PARTS_VERSION = 1;

/**
 * Loads `test-parts.json` for each configured library: `"@mattermost/compass-ui"` (from the installed
 * package) or `{"package": …, "parts": "path/to/test-parts.json"}`. A configured library that isn't installed, or
 * whose file is corrupt or of another format version, is an `input` error; an installed version that publishes no
 * file is a warning (its roles come from the built-in table).
 */
export function loadPublishedParts(config: Config, problems: Diagnostic[] = []): PublishedParts[] {
    const out: PublishedParts[] = [];
    const at = relativeToRoot(config, config.configPath);
    for (const lib of config.libraries) {
        let file: string;
        let dir: string;
        const name = typeof lib === 'string' ? lib : lib.package;
        if (typeof lib === 'string') {
            // node_modules lookup by directory: a package's `exports` may not expose package.json
            const found = packageDir(config.root, lib);
            if (!found) {
                problems.push(inputDiagnostic(at, `Library ${lib} (config \`libraries\`) isn't installed.`, 'Install the webapp\'s dependencies (npm ci), or remove it from `libraries`.'));
                continue;
            }
            dir = found;
            file = path.join(dir, 'test-parts.json');
            if (!fs.existsSync(file)) {
                problems.push(inputDiagnostic(at, `Library ${lib}@${installedVersion(dir)} publishes no test-parts.json: its components' roles come from the built-in table, and their parts aren't scanned.`, 'Upgrade to a version that ships test-parts.json.', 'warning'));
                continue;
            }
        } else {
            file = path.resolve(config.root, lib.parts);
            dir = path.dirname(file);
        }
        const read = readVersioned<TestParts>(file, TEST_PARTS_VERSION, `${name}'s test-parts.json`, relativeToRoot(config, file));
        if ('diagnostic' in read) {
            problems.push(read.diagnostic);
            continue;
        }
        out.push({package: name, dir: path.resolve(dir), parts: read.value});
    }
    return out;
}

/** The version in an installed package's package.json. */
export function installedVersion(dir: string): string {
    try {
        return (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {version?: string}).version ?? '?';
    } catch {
        return '?';
    }
}

export function packageDir(from: string, pkg: string): string | null {
    for (let d = path.resolve(from); ; d = path.dirname(d)) {
        const candidate = path.join(d, 'node_modules', pkg);
        if (fs.existsSync(path.join(candidate, 'package.json'))) {
            return fs.realpathSync(candidate);
        }
        if (path.dirname(d) === d) {
            return null;
        }
    }
}

/** The published library component a JSX tag renders: matched on the declaring file's package and the export name. */
export function publishedComponent(ix: ProgramIndex, tag: JsxTag, published: PublishedParts[]): {lib: PublishedParts; name: string; component: TestParts['components'][string] | null} | null {
    if (!published.length) {
        return null;
    }
    let sym = ix.checker.getSymbolAtLocation(typescript.isPropertyAccessExpression(tag.tagName) ? tag.tagName.name : tag.tagName);
    const local = sym?.getName();
    if (sym && (sym.flags & typescript.SymbolFlags.Alias)) {
        try {
            sym = ix.checker.getAliasedSymbol(sym);
        } catch {
            return null;
        }
    }
    const file = sym?.declarations?.[0]?.getSourceFile().fileName;
    const lib = file && published.find((l) => path.resolve(file).startsWith(l.dir + path.sep));
    if (!lib || !sym) {
        return null;
    }
    const names = [sym.getName(), local, tag.tagName.getText().split('.').pop()].filter((n): n is string => Boolean(n) && n !== 'default');
    const name = names.find((n) => lib.parts.components[n]) ?? names[0] ?? '';
    return {lib, name, component: lib.parts.components[name] ?? null};
}
