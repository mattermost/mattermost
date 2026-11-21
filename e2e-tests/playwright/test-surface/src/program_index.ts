// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {exprName, isFunctionLike, isIntrinsic, isJsxTag, strip, type FunctionLike, type JsxTag} from './ast.ts';
import type {Config} from './config.ts';
import type {LoadedProgram} from './program.ts';
import {typescript} from './typescript.ts';

/** A component or function the index can point at: a function-like node or a class. */
export type CodeNode = FunctionLike | ts.ClassLikeDeclaration;

/** Where a component is referenced as a modal: `{dialogType: X, dialogProps}` or `<ToggleModalButton dialogType={X} dialogProps={...}>`. */
export type DialogRef = {kind: 'object'; node: ts.ObjectLiteralExpression} | {kind: 'jsx'; node: JsxTag};

export type Loc = string;

/** Where something is, as the manifest names it: `channels/src/…/file.tsx#Component`, or the file alone. */
export type SourceRef = string;

/** `React.createElement(Comp, props)`: a usage whose attributes are an object. */
export type CallUsage = {kind: 'call'; call: ts.CallExpression; props: ts.Expression | undefined};

/** A place a component is rendered: a JSX tag, or a createElement call. */
export type Usage = JsxTag | CallUsage;

/**
 * Passes over the dynamic usages before giving up on a fixpoint. Each pass reaches at least one more level of dynamically
 * rendered components; the webapp needs a handful. Exhausting it is an input error, never a silent cut.
 */
export const DYNAMIC_PASS_BUDGET = 64;

export type UsageAttr = {name: string; value: ts.Expression | undefined} | {spread: ts.Expression};

export function isCallUsage(u: Usage): u is CallUsage {
    return (u as CallUsage).kind === 'call';
}

/** The node a usage is located at (for locations and render conditions). */
export function usageNode(u: Usage): ts.Node {
    return isCallUsage(u) ? u.call : u;
}

/** A usage's attributes in source order; a bare JSX attribute has no value. */
export function usageAttrs(u: Usage): UsageAttr[] {
    if (!isCallUsage(u)) {
        return u.attributes.properties.map((p) => {
            if (typescript.isJsxSpreadAttribute(p)) {
                return {spread: p.expression};
            }
            const init = p.initializer;
            const value = init && typescript.isJsxExpression(init) ? init.expression : init as ts.Expression | undefined;
            return {name: p.name.getText(), value};
        });
    }
    const props = strip(u.props) as ts.Expression | undefined;
    if (!props) {
        return [];
    }
    if (!typescript.isObjectLiteralExpression(props)) {
        return [{spread: props}];
    }
    const out: UsageAttr[] = [];
    for (const p of props.properties) {
        if (typescript.isSpreadAssignment(p)) {
            out.push({spread: p.expression});
        } else if (typescript.isPropertyAssignment(p)) {
            const name = propNameText(p.name);
            if (name) {
                out.push({name, value: p.initializer});
            }
        } else if (typescript.isShorthandPropertyAssignment(p)) {
            out.push({name: p.name.text, value: p.name});
        }
    }
    return out;
}

function propNameText(n: ts.PropertyName): string | null {
    if (typescript.isIdentifier(n) || typescript.isStringLiteral(n) || typescript.isNumericLiteral(n)) {
        return n.text;
    }
    return null;
}

/** What one file contributes to the index, plus every file its symbol resolution looked at. */
type FileEntries = {
    sf: ts.SourceFile;
    usages: Array<[ts.Node, JsxTag]>;
    calls: Array<[ts.Node, ts.CallExpression]>;
    dialogRefs: Array<[ts.Node, DialogRef]>;
    dialogInputs: Array<[ts.Expression, DialogRef]>;
    connects: Array<[ts.Node, ts.Expression | null]>;
    connectCalls: Array<[ts.Node, ts.CallExpression]>;

    /** Tags whose component isn't a plain reference, and `createElement` calls: what the dynamic-usage pass resolves. */
    dynamic: ts.Node[];
    deps: Set<ts.SourceFile>;
};

/**
 * One pass over every in-scope file of the program:
 * component usages (JSX tag -> component node, through aliases, HOCs and React.lazy),
 * call sites per function, dialogType references, and connect() wrappers.
 */
/** The global `Object`'s functions that read an object's own members and never write them or keep it. */
const OBJECT_READERS = new Set(['keys', 'values', 'entries', 'getOwnPropertyNames', 'hasOwn']);

export class ProgramIndex {
    readonly program: ts.Program;
    readonly checker: ts.TypeChecker;
    readonly config: Config;
    readonly files: ts.SourceFile[];

    readonly usages = new Map<ts.Node, Usage[]>();
    readonly calls = new Map<ts.Node, ts.CallExpression[]>();
    readonly dialogRefs = new Map<ts.Node, DialogRef[]>();
    readonly dialogInputs: Array<[ts.Expression, DialogRef]> = [];
    readonly unresolvedDialogs = new Set<ts.Expression>();
    readonly connects = new Map<ts.Node, ts.Expression | null>();

    /** The `connect(mapStateToProps, mapDispatchToProps)` call that wraps a component. */
    readonly connectCalls = new Map<ts.Node, ts.CallExpression>();
    readonly stats: Record<string, number> = {};

    /** Dynamic usages: the usage chains (innermost first) of the sources that supplied the component. */
    readonly dynamicVia = new Map<ts.Node, Map<Usage, Loc[][]>>();

    /** Per-file entries, reused by the next index (watch mode) when nothing they depend on changed. */
    readonly entries = new Map<string, FileEntries>();

    /** The first symbol the checker failed to resolve, and why (`stats.resolverErrors` counts them). */
    resolverError: string | null = null;

    private readonly includeDirs: string[];
    private deps: Set<ts.SourceFile> | null = null;
    private writtenSymbols: Set<ts.Symbol> | null = null;
    private readonly escapeCache = new Map<ts.Symbol, boolean>();

    constructor(loaded: LoadedProgram, config: Config, previous?: ProgramIndex) {
        this.program = loaded.program;
        this.checker = loaded.checker;
        this.config = config;
        this.includeDirs = config.include.map((d) => (d.endsWith(path.sep) ? d : d + path.sep));
        this.files = this.program.getSourceFiles().filter((sf) => this.inScope(sf.fileName));
        const t0 = Date.now();
        let reused = 0;
        for (const sf of this.files) {
            const prev = previous?.entries.get(sf.fileName);
            const fresh = prev && prev.sf === sf && [...prev.deps].every((d) => this.program.getSourceFile(d.fileName) === d);
            const e = fresh ? prev : this.indexFile(sf);
            if (fresh) {
                reused++;
            }
            this.entries.set(sf.fileName, e);
            for (const [k, v] of e.usages) {
                this.push(this.usages, k, v);
            }
            for (const [k, v] of e.calls) {
                this.push(this.calls, k, v);
            }
            for (const [k, v] of e.dialogRefs) {
                this.push(this.dialogRefs, k, v);
            }
            this.dialogInputs.push(...e.dialogInputs);
            for (const [k, v] of e.connects) {
                this.connects.set(k, v);
            }
            for (const [k, v] of e.connectCalls) {
                this.connectCalls.set(k, v);
            }
        }
        Object.assign(this.stats, {
            indexMs: Date.now() - t0,
            reusedFiles: reused,
            files: this.files.length,
            components: this.usages.size,
            functions: this.calls.size,
            connected: this.connects.size,
            dialogTargets: this.dialogRefs.size,
        });
    }

    inScope(fileName: string): boolean {
        const f = path.resolve(fileName);
        if (f.includes(`${path.sep}node_modules${path.sep}`) || f.endsWith('.d.ts')) {
            return false;
        }
        if (!this.includeDirs.some((d) => f.startsWith(d))) {
            return false;
        }
        const rel = this.rel(f);
        return !this.config.exclude.some((r) => r.test('/' + rel));
    }

    isLibraryNode(n: ts.Node | null | undefined): boolean {
        return !n || !this.inScope(n.getSourceFile().fileName);
    }

    rel(file: string): string {
        return path.relative(this.config.root, file).split(path.sep).join('/');
    }

    /**
     * Where a node is, exactly: `file:line:column`. Used inside the scan only (keys, usage chains, diagnostics);
     * the manifest names places by `ref()`, which doesn't change when a line is added above.
     */
    where(n: ts.Node): Loc {
        const sf = n.getSourceFile();
        const {line, character} = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        const loc = `${this.rel(sf.fileName)}:${line + 1}:${character + 1}`;
        if (!this.refs.has(loc)) {
            this.refs.set(loc, this.ref(n));
        }
        return loc;
    }

    private readonly refs = new Map<Loc, SourceRef>();

    /** The `file#Component` a location `where()` returned is in (the file alone for a location not in the program). */
    refOf(loc: Loc): SourceRef {
        return this.refs.get(loc) ?? fileOfLoc(loc);
    }

    /**
     * Where a node is, as the manifest names it: `file#Name`, the top-level component, class or function it is in
     * (the declaration's name, through HOC wrappers: `const X = memo(() => …)` is `X`), or the file alone for module-level
     * code that isn't in one.
     */
    ref(n: ts.Node): SourceRef {
        const sf = n.getSourceFile();
        const file = this.rel(sf.fileName);
        let top: ts.Node = n;
        while (top.parent && !typescript.isSourceFile(top.parent)) {
            top = top.parent;
        }
        const name = topLevelName(top);
        return name ? `${file}#${name}` : file;
    }

    /** `export const <name> = {…}` (possibly `as const` / `satisfies`) in a file. */
    constObject(file: string, name: string): ts.ObjectLiteralExpression | undefined {
        const sf = this.program.getSourceFile(file);
        for (const st of sf?.statements ?? []) {
            if (typescript.isVariableStatement(st)) {
                for (const d of st.declarationList.declarations) {
                    const init = d.initializer && strip(d.initializer);
                    if (typescript.isIdentifier(d.name) && d.name.text === name && init && typescript.isObjectLiteralExpression(init)) {
                        return init;
                    }
                }
            }
        }
        return undefined;
    }

    // ---- symbol -> code node --------------------------------------------------------

    private readonly symbolMemo = new Map<ts.Symbol, {node: CodeNode | null; deps: ts.SourceFile[]}>();

    /** Resolves a symbol to the function/class it denotes, unwrapping aliases and HOCs. */
    resolveSymbolToNode(sym: ts.Symbol | undefined, seen = new Set<ts.Symbol>()): CodeNode | null {
        if (!sym || seen.has(sym)) {
            return null;
        }
        const hit = this.symbolMemo.get(sym);
        if (hit) {
            hit.deps.forEach((d) => this.deps?.add(d));
            return hit.node;
        }
        seen.add(sym);
        const outer = this.deps;
        const mine = new Set<ts.SourceFile>();
        this.deps = mine;
        let r: CodeNode | null = null;
        try {
            let s = sym;
            if (s.flags & typescript.SymbolFlags.Alias) {
                s = this.checker.getAliasedSymbol(s);
            }
            for (const decl of [...(sym.declarations ?? []), ...(s.declarations ?? [])]) {
                mine.add(decl.getSourceFile());
            }

            // an overloaded function's first declarations are signatures: the one with a body is the function
            const d = s.declarations?.find((x) => (typescript.isFunctionDeclaration(x) || typescript.isMethodDeclaration(x)) && x.body) ?? s.declarations?.[0];
            r = d ? this.resolveDeclToNode(d, seen) : null;
        } catch (e) {
            // the checker can throw on a symbol it can't resolve: counted, and the first one kept to report
            this.stats.resolverErrors = (this.stats.resolverErrors ?? 0) + 1;
            this.resolverError ??= `${sym.getName()}: ${(e as Error).message.split('\n')[0]}`;
            r = null;
        } finally {
            this.deps = outer;
            mine.forEach((d) => outer?.add(d));
        }
        this.symbolMemo.set(sym, {node: r, deps: [...mine]});
        return r;
    }

    /** The component/function an expression denotes: arrows, identifiers, HOC calls, React.lazy. */
    unwrapExpr(e: ts.Expression | undefined, seen = new Set<ts.Symbol>()): CodeNode | null {
        const x = strip(e);
        if (!x) {
            return null;
        }
        if (typescript.isArrowFunction(x) || typescript.isFunctionExpression(x) || typescript.isClassExpression(x)) {
            return x;
        }

        // styled(X)`…`: renders X (see the call case below)
        if (typescript.isTaggedTemplateExpression(x)) {
            const wrapped = styledTarget(x.tag);
            return wrapped ? this.unwrapExpr(wrapped, seen) : null;
        }
        if (typescript.isIdentifier(x) || typescript.isPropertyAccessExpression(x)) {
            return this.resolveSymbolToNode(this.checker.getSymbolAtLocation(x), seen);
        }
        if (typescript.isCallExpression(x)) {
            const callee = strip(x.expression);
            const cn = exprName(callee);

            // styled(X, opts)(styles) / styled(X)`...`: a styling wrapper; with a component of ours as X, it
            // renders X with the usage's props (`styled.div`, `styled('div')` and library components stay null)
            if (isStyledCall(x)) {
                const wrapped = styledTarget(x);
                return wrapped ? this.unwrapExpr(wrapped, seen) : null;
            }

            // React.lazy(() => import('x')): the module's default export
            if (cn === 'lazy' || cn === 'makeAsyncComponent') {
                const imp = findDynamicImport(x);
                if (imp && imp.arguments[0]) {
                    const mod = this.checker.getSymbolAtLocation(imp.arguments[0]);
                    const def = mod && this.checker.getExportsOfModule(mod).find((m) => m.getName() === 'default');
                    if (def) {
                        return this.resolveSymbolToNode(def, seen);
                    }
                }
            }

            // memo(X, areEqual): the component is the first argument (the comparator is a function too)
            if (cn === 'memo' && x.arguments.length > 1) {
                return this.unwrapExpr(x.arguments[0], seen);
            }

            // A local HOC can return its own wrapper class/function instead of rendering the argument directly.
            // Preserve that wrapper's props boundary only when every return names the same local declaration.
            let factory: CodeNode | null = null;
            if (callee && (typescript.isIdentifier(callee) || typescript.isPropertyAccessExpression(callee))) {
                const symbol = this.checker.getSymbolAtLocation(callee);
                const target = symbol && (symbol.flags & typescript.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol);
                const declaration = target?.valueDeclaration;
                if (declaration && isFunctionLike(declaration)) {
                    factory = declaration;
                } else if (declaration && typescript.isVariableDeclaration(declaration)) {
                    const initializer = strip(declaration.initializer);
                    if (initializer && isFunctionLike(initializer)) {
                        factory = initializer;
                    }
                }
            }
            if (factory && isFunctionLike(factory) && factory.body && typescript.isBlock(factory.body)) {
                const returned: Array<CodeNode | null> = [];
                const visit = (node: ts.Node) => {
                    if (node !== factory.body && (isFunctionLike(node) || typescript.isClassLike(node))) {
                        return;
                    }
                    if (typescript.isReturnStatement(node)) {
                        const value = node.expression && this.unwrapExpr(node.expression, new Set(seen));
                        returned.push(value && value.getSourceFile() === factory.getSourceFile() && value.pos > factory.body!.pos && value.end < factory.body!.end ? value : null);
                        return;
                    }
                    typescript.forEachChild(node, visit);
                };
                visit(factory.body);
                if (returned.length && returned[0] && returned.every((value) => value === returned[0])) {
                    return returned[0];
                }
            }

            // HOCs: memo(X), forwardRef(fn), connect(a, b)(X), injectIntl(X), withRouter(X), compose(...)(X): the last argument that is a component
            for (let i = x.arguments.length - 1; i >= 0; i--) {
                const r = this.unwrapExpr(x.arguments[i], seen);
                if (r) {
                    return r;
                }
            }
        }
        return null;
    }

    private resolveDeclToNode(d: ts.Declaration, seen: Set<ts.Symbol>): CodeNode | null {
        if (typescript.isBindingElement(d) && typescript.isObjectBindingPattern(d.parent) && typescript.isVariableDeclaration(d.parent.parent)) {
            const initializer = strip(d.parent.parent.initializer);
            const imported = initializer && typescript.isAwaitExpression(initializer) ? strip(initializer.expression) : initializer;
            if (imported && typescript.isCallExpression(imported) && imported.expression.kind === typescript.SyntaxKind.ImportKeyword && imported.arguments[0]) {
                const module = this.checker.getSymbolAtLocation(imported.arguments[0]);
                const name = (d.propertyName ?? d.name).getText().replace(/^['"]|['"]$/g, '');
                const exported = module && this.checker.getExportsOfModule(module).find((symbol) => symbol.getName() === name);
                return exported ? this.resolveSymbolToNode(exported, seen) : null;
            }
        }
        if (typescript.isFunctionDeclaration(d) || typescript.isClassDeclaration(d) || typescript.isMethodDeclaration(d)) {
            return d;
        }
        if (typescript.isVariableDeclaration(d)) {
            return this.unwrapExpr(d.initializer, seen);
        }
        if (typescript.isExportAssignment(d)) {
            return this.unwrapExpr(d.expression, seen);
        }
        if (typescript.isPropertyAssignment(d)) {
            return this.unwrapExpr(d.initializer, seen);
        }

        // a class field that holds a component (`static ItemSubMenu = SubMenuItem`), a function or a class
        if (typescript.isPropertyDeclaration(d) && d.initializer) {
            const r = this.unwrapExpr(d.initializer, seen);
            return r && (isFunctionLike(r) || typescript.isClassLike(r)) ? r : null;
        }
        if (typescript.isShorthandPropertyAssignment(d)) {
            return this.resolveSymbolToNode(this.checker.getShorthandAssignmentValueSymbol(d), seen);
        }
        if (typescript.isExportSpecifier(d) || typescript.isImportSpecifier(d) || typescript.isImportClause(d)) {
            const s = this.checker.getSymbolAtLocation(d.name ?? d);
            return s ? this.resolveSymbolToNode(s, seen) : null;
        }
        return null;
    }

    /** The component a JSX tag renders, or null for intrinsic/unknown tags. */
    componentOfTag(tag: JsxTag): CodeNode | null {
        if (isIntrinsic(tag)) {
            return null;
        }
        return this.resolveSymbolToNode(this.checker.getSymbolAtLocation(tag.tagName));
    }

    /** Structural descriptor alternatives, without invoking the function that stores or uses the descriptor. */
    private dialogTargets(expression: ts.Expression, seen = new Set<ts.Node>(), unresolved?: Set<ts.Expression>): CodeNode[] {
        const value = strip(expression) as ts.Expression;
        if (seen.has(value)) {
            unresolved?.add(value);
            return [];
        }
        seen.add(value);
        if (typescript.isConditionalExpression(value)) {
            return [...this.dialogTargets(value.whenTrue, new Set(seen), unresolved), ...this.dialogTargets(value.whenFalse, new Set(seen), unresolved)];
        }
        const target = this.unwrapExpr(value);
        if (target) {
            return [target];
        }
        const declaration = typescript.isIdentifier(value) ? this.checker.getSymbolAtLocation(value)?.valueDeclaration : undefined;
        if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
            return this.dialogTargets(declaration.initializer, seen, unresolved);
        }
        const type = this.checker.getTypeAtLocation(value);
        if (!(type.flags & (typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Never))) {
            unresolved?.add(value);
        }
        return [];
    }

    resolveDialogMounts(sourcesOf: (expression: ts.Expression) => Array<{expr?: ts.Expression}>): void {
        this.unresolvedDialogs.clear();
        const expand = (expression: ts.Expression, seen = new Set<ts.Node>()): Array<{expr?: ts.Expression}> => {
            const value = strip(expression) as ts.Expression;
            if (seen.has(value)) {
                return [{}];
            }
            seen.add(value);
            if (typescript.isElementAccessExpression(value)) {
                const symbol = this.checker.getSymbolAtLocation(value.expression);
                const declaration = symbol?.valueDeclaration;
                const object = declaration && typescript.isVariableDeclaration(declaration) ? strip(declaration.initializer) : undefined;

                // a registry is finite only when nothing can add to it: a const that no code writes to after it is built
                if (object && typescript.isObjectLiteralExpression(object) && !(this.isConst(declaration!) && !this.isWritten(symbol!) && !this.escapes(symbol!))) {
                    return [{}];
                }
                if (object && typescript.isObjectLiteralExpression(object)) {
                    return object.properties.flatMap((property) => {
                        if (typescript.isPropertyAssignment(property)) {
                            return expand(property.initializer, new Set(seen));
                        }
                        if (typescript.isShorthandPropertyAssignment(property)) {
                            return expand(property.name, new Set(seen));
                        }
                        return [{}];
                    });
                }
            }
            const sources = sourcesOf(value);
            return sources.flatMap((source) => (source.expr && strip(source.expr) !== value ? expand(source.expr, new Set(seen)) : [source]));
        };
        for (const [input, reference] of this.dialogInputs) {
            // a forward declares nothing, except the default a destructured binding gives in its own right
            const expression = this.isDialogForward(input) ? this.forwardDefault(input) : input;
            if (!expression) {
                continue;
            }
            const sources = expand(expression);
            const missing = new Set<ts.Expression>();
            const targets = [...new Set(sources.flatMap((source) => (source.expr ? this.dialogTargets(source.expr, new Set(), missing) : [])))];
            if (!targets.length || missing.size || sources.some((source) => !source.expr)) {
                this.unresolvedDialogs.add(expression);
            }
            for (const target of targets) {
                const refs = this.dialogRefs.get(target) ?? [];
                if (!refs.some((ref) => ref.node === reference.node)) {
                    this.push(this.dialogRefs, target, reference);
                }
            }
        }
    }

    /** Descriptor field copies introduce no component choice; definitions are judged where the field is built. */
    private isDialogForward(expression: ts.Expression): boolean {
        const value = strip(expression) as ts.Expression;
        if (typescript.isPropertyAccessExpression(value)) {
            return value.name.text === 'dialogType';
        }
        if (typescript.isElementAccessExpression(value)) {
            return Boolean(value.argumentExpression && typescript.isStringLiteralLike(value.argumentExpression) && value.argumentExpression.text === 'dialogType');
        }
        const binding = this.dialogBinding(value);
        return Boolean(binding);
    }

    /**
     * The binding a forward reads `dialogType` through (`const {dialogType} = d`, `({dialogType}) => ...`), when that
     * is all it can hold: a const or a parameter that no code assigns to afterwards. A reassigned or `let` binding is
     * not a forward and goes through the value resolver like any other value.
     */
    private dialogBinding(value: ts.Expression): ts.BindingElement | null {
        if (!typescript.isIdentifier(value)) {
            return null;
        }
        const symbol = typescript.isShorthandPropertyAssignment(value.parent) ? this.checker.getShorthandAssignmentValueSymbol(value.parent) : this.checker.getSymbolAtLocation(value);
        const declaration = symbol?.valueDeclaration;
        if (!symbol || !declaration || !typescript.isBindingElement(declaration) || !typescript.isObjectBindingPattern(declaration.parent)) {
            return null;
        }
        if ((declaration.propertyName ?? declaration.name).getText().replace(/^['"]|['"]$/g, '') !== 'dialogType') {
            return null;
        }
        let root: ts.Node = declaration;
        while (typescript.isBindingElement(root) || typescript.isObjectBindingPattern(root) || typescript.isArrayBindingPattern(root)) {
            root = root.parent;
        }
        const fixed = typescript.isParameter(root) || (typescript.isVariableDeclaration(root) && this.isConst(root));
        return fixed && !this.isWritten(symbol) ? declaration : null;
    }

    /** The default of a forward's destructured binding (`const {dialogType = Fallback} = d`): a definition of its own. */
    private forwardDefault(value: ts.Expression): ts.Expression | null {
        return this.dialogBinding(strip(value) as ts.Expression)?.initializer ?? null;
    }

    /**
     * Whether a registry can be reached other than by reading its members: every in-scope reference to it must be the
     * object of a member read (`registry[id]`, `registry.one`, `Object.keys(registry)`) or a type query. An alias, an argument, a return, a
     * spread or an export lets code the scan does not follow add a choice, so any of them makes the registry open.
     */
    private escapes(symbol: ts.Symbol): boolean {
        const known = this.escapeCache.get(symbol);
        if (known !== undefined) {
            return known;
        }

        // an exported declaration is reachable from modules the scan may not read
        if (symbol.getDeclarations()?.some((d) => typescript.getCombinedModifierFlags(d) & typescript.ModifierFlags.Export)) {
            this.escapeCache.set(symbol, true);
            return true;
        }
        const name = symbol.getName();
        const declarations = new Set(symbol.getDeclarations()?.map((d) => (d as ts.NamedDeclaration).name).filter(Boolean));
        let escaped = false;
        const visit = (node: ts.Node): void => {
            if (escaped) {
                return;
            }
            if (typescript.isIdentifier(node) && node.text === name && !declarations.has(node)) {
                let found = this.checker.getSymbolAtLocation(node);
                if (typescript.isShorthandPropertyAssignment(node.parent)) {
                    found = this.checker.getShorthandAssignmentValueSymbol(node.parent);
                } else if (typescript.isExportSpecifier(node.parent)) {
                    found = this.checker.getExportSpecifierLocalTargetSymbol(node.parent);
                }
                const read = ((typescript.isPropertyAccessExpression(node.parent) || typescript.isElementAccessExpression(node.parent)) && node.parent.expression === node) ||
                    (typescript.isCallExpression(node.parent) && node.parent.arguments[0] === node && this.isObjectReader(node.parent));
                if (found === symbol && !read && !typescript.isTypeQueryNode(node.parent)) {
                    escaped = true;
                    return;
                }
            }
            typescript.forEachChild(node, visit);
        };
        this.files.forEach(visit);
        this.escapeCache.set(symbol, escaped);
        return escaped;
    }

    /** `Object.keys(x)` and the like, where `Object` is the standard library's, never a local or imported one. */
    private isObjectReader(call: ts.CallExpression): boolean {
        const callee = strip(call.expression);
        if (!typescript.isPropertyAccessExpression(callee) || !typescript.isIdentifier(callee.expression) || callee.expression.text !== 'Object' || !OBJECT_READERS.has(callee.name.text)) {
            return false;
        }
        const declarations = this.checker.getSymbolAtLocation(callee.expression)?.declarations ?? [];
        return declarations.length > 0 && declarations.every((declaration) => this.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
    }

    private isConst(declaration: ts.Declaration): boolean {
        return Boolean(typescript.getCombinedNodeFlags(declaration) & typescript.NodeFlags.Const);
    }

    /**
     * Whether in-scope code writes to the symbol after its declaration: an assignment, compound assignment, `++`/`--`
     * or `delete` whose target is rooted at it (`x = ...`, `x.a = ...`, `x[k] = ...`), or a call that writes its first
     * argument (`Object.assign`, `Object.defineProperty`, `Object.defineProperties`, `Reflect.set`, `Reflect.defineProperty`).
     */
    private isWritten(symbol: ts.Symbol): boolean {
        if (!this.writtenSymbols) {
            const written = new Set<ts.Symbol>();
            const rootOf = (target: ts.Expression): ts.Symbol | undefined => {
                let node = strip(target) as ts.Expression;
                while (typescript.isPropertyAccessExpression(node) || typescript.isElementAccessExpression(node)) {
                    node = strip(node.expression) as ts.Expression;
                }
                if (!typescript.isIdentifier(node)) {
                    return undefined;
                }
                const found = this.checker.getSymbolAtLocation(node);
                return found && typescript.isShorthandPropertyAssignment(node.parent) ? this.checker.getShorthandAssignmentValueSymbol(node.parent) : found;
            };
            const mark = (target: ts.Expression) => {
                const value = strip(target) as ts.Expression;

                // a destructuring assignment writes every name it lists: `({dialogType} = other)`, `[a, b] = pair`
                if (typescript.isObjectLiteralExpression(value) || typescript.isArrayLiteralExpression(value)) {
                    const elements = typescript.isArrayLiteralExpression(value) ? value.elements : value.properties;
                    for (const element of elements) {
                        if (typescript.isShorthandPropertyAssignment(element)) {
                            const found = this.checker.getShorthandAssignmentValueSymbol(element);
                            if (found) {
                                written.add(found);
                            }
                        } else if (typescript.isPropertyAssignment(element)) {
                            mark(element.initializer);
                        } else if (typescript.isSpreadElement(element) || typescript.isSpreadAssignment(element)) {
                            mark(element.expression);
                        } else if (!typescript.isOmittedExpression(element) && typescript.isExpression(element)) {
                            mark(typescript.isBinaryExpression(element) ? element.left : element);
                        }
                    }
                    return;
                }
                const root = rootOf(value);
                if (root) {
                    written.add(root);
                }
            };
            const WRITERS = new Set(['Object.assign', 'Object.defineProperty', 'Object.defineProperties', 'Reflect.set', 'Reflect.defineProperty']);
            const visit = (node: ts.Node): void => {
                if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
                    mark(node.left);
                } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
                    mark(node.operand);
                } else if (typescript.isDeleteExpression(node)) {
                    mark(node.expression);
                } else if (typescript.isCallExpression(node) && WRITERS.has(strip(node.expression).getText()) && node.arguments[0]) {
                    mark(node.arguments[0]);
                }
                typescript.forEachChild(node, visit);
            };
            this.files.forEach(visit);
            this.writtenSymbols = written;
        }
        return this.writtenSymbols.has(symbol);
    }

    // ---- dynamic usages ---------------------------------------------------------------

    /**
     * Tags whose name is a value (`const Input = props.inputComponent; <Input/>`, `<props.as/>`) and
     * `React.createElement(X, props)` calls: the components they can render, found through value
     * sources (which needs the resolver, so this runs after the index is built).
     */
    addDynamicUsages(sourcesOf: (e: ts.Expression) => Array<{expr: ts.Expression; via: Loc[]}>): {usages: number; passes: number; converged: boolean} {
        let added = 0;
        let paths = 0;
        const add = (target: CodeNode, u: Usage, via: Loc[]) => {
            if (this.isLibraryNode(target)) {
                return;
            }
            const byUsage = this.dynamicVia.get(target) ?? new Map<Usage, Loc[][]>();
            this.dynamicVia.set(target, byUsage);
            const vias = byUsage.get(u);
            if (vias) {
                if (!vias.some((known) => known.length === via.length && known.every((loc, index) => loc === via[index]))) {
                    vias.push(via);
                    paths++;
                }
                return;
            }
            byUsage.set(u, [via]);
            this.push(this.usages, target, u);
            added++;
            paths++;
        };
        const targetsOf = (e: ts.Expression): Array<[CodeNode, Loc[]]> => {
            const out: Array<[CodeNode, Loc[]]> = [];
            for (const src of sourcesOf(e)) {
                const s = strip(src.expr) as ts.Expression;
                if (typescript.isStringLiteralLike(s)) {
                    continue;
                }
                const n = this.unwrapExpr(s);
                if (n) {
                    out.push([n, src.via]);
                }
            }
            return out;
        };

        // the candidates come from the (incremental) index: unchanged files aren't walked again. A dynamic tag can
        // take its component from a prop of a component that is itself rendered only dynamically (`actions.map((Action)
        // => <Action/>)` in a row rendered as `<RowComponentType/>`): that prop has no values (or misses a mount's) until
        // the row's usage, or its usage through that mount, is added. So passes repeat until one adds neither a usage nor
        // a supplying path: a fixpoint, since sources are depth-bounded and so are the paths. The pass budget only guards
        // against a fault there, and running out of it is reported, not silent.
        const calls = new Map<ts.CallExpression, CallUsage>();
        let passes = 0;
        let converged = false;
        while (!converged && passes < DYNAMIC_PASS_BUDGET) {
            const before = paths;
            passes++;
            for (const entry of this.entries.values()) {
                for (const n of entry.dynamic) {
                    if (isJsxTag(n)) {
                        for (const [t, via] of targetsOf(n.tagName as ts.Expression)) {
                            add(t, n, via);
                        }
                    } else if (typescript.isCallExpression(n)) {
                        const u = calls.get(n) ?? {kind: 'call', call: n, props: n.arguments[1]};
                        calls.set(n, u);
                        for (const [t, via] of targetsOf(n.arguments[0])) {
                            add(t, u, via);
                        }
                    }
                }
            }
            converged = paths === before;
        }
        this.stats.dynamicUsages = added;
        this.stats.dynamicPasses = passes;
        return {usages: added, passes, converged};
    }

    // ---- indexing ---------------------------------------------------------------------

    private push<K, V>(m: Map<K, V[]>, k: K, v: V) {
        const arr = m.get(k);
        if (arr) {
            arr.push(v);
        } else {
            m.set(k, [v]);
        }
    }

    private indexFile(sf: ts.SourceFile): FileEntries {
        const e: FileEntries = {sf, usages: [], calls: [], dialogRefs: [], dialogInputs: [], connects: [], connectCalls: [], dynamic: [], deps: new Set([sf])};
        this.deps = e.deps;
        const visit = (n: ts.Node) => {
            if (isJsxTag(n)) {
                const node = this.componentOfTag(n);
                if (node) {
                    e.usages.push([node, n]);
                } else if (!isIntrinsic(n)) {
                    e.dynamic.push(n);
                }
                const dt = n.attributes.properties.find((p): p is ts.JsxAttribute => typescript.isJsxAttribute(p) && p.name.getText() === 'dialogType');
                if (dt && dt.initializer && typescript.isJsxExpression(dt.initializer)) {
                    for (const target of dt.initializer.expression && !this.isDialogForward(dt.initializer.expression) ? this.dialogTargets(dt.initializer.expression) : []) {
                        e.dialogRefs.push([target, {kind: 'jsx', node: n}]);
                    }
                    if (dt.initializer.expression) {
                        e.dialogInputs.push([dt.initializer.expression, {kind: 'jsx', node: n}]);
                    }
                }
            } else if (typescript.isCallExpression(n)) {
                const callee = strip(n.expression);
                if (typescript.isIdentifier(callee) || typescript.isPropertyAccessExpression(callee)) {
                    const node = this.resolveSymbolToNode(this.checker.getSymbolAtLocation(callee));
                    if (node && isFunctionLike(node)) {
                        e.calls.push([node, n]);
                    }
                }
                if (exprName(strip(n.expression) as ts.Expression) === 'createElement' && n.arguments[0]) {
                    e.dynamic.push(n);
                }
                const conn = this.indexConnect(n);
                if (conn) {
                    e.connects.push([conn.comp, conn.dispatch]);
                    e.connectCalls.push([conn.comp, conn.call]);
                }
            } else if ((typescript.isPropertyAssignment(n) || typescript.isShorthandPropertyAssignment(n)) && n.name.getText() === 'dialogType' && typescript.isObjectLiteralExpression(n.parent)) {
                const value = typescript.isPropertyAssignment(n) ? n.initializer : n.name;
                for (const target of this.isDialogForward(value) ? [] : this.dialogTargets(value)) {
                    e.dialogRefs.push([target, {kind: 'object', node: n.parent}]);
                }
                e.dialogInputs.push([value, {kind: 'object', node: n.parent}]);
            }
            typescript.forEachChild(n, visit);
        };
        visit(sf);
        this.deps = null;
        for (const list of [e.usages, e.calls, e.dialogRefs, e.connects] as Array<Array<[ts.Node, unknown]>>) {
            for (const [target, v] of list) {
                e.deps.add(target.getSourceFile());
                if (v && typeof v === 'object' && 'getSourceFile' in v) {
                    e.deps.add((v as ts.Node).getSourceFile());
                }
            }
        }
        return e;
    }

    /** connect(mapState, mapDispatch)(X), compose(connect(..), ..)(X), const connector = connect(..); connector(X) */
    private indexConnect(n: ts.CallExpression): {comp: CodeNode; dispatch: ts.Expression | null; call: ts.CallExpression} | null {
        const nameOf = (c: ts.CallExpression) => {
            const e = strip(c.expression);
            return exprName(e);
        };
        const target = n.arguments[0];
        if (!target) {
            return null;
        }
        const inner = strip(n.expression);
        let conn: ts.CallExpression | null = null;
        if (typescript.isCallExpression(inner)) {
            if (nameOf(inner) === 'connect') {
                conn = inner;
            } else if (['compose', 'flowRight'].includes(nameOf(inner))) {
                conn = inner.arguments.find((a): a is ts.CallExpression => typescript.isCallExpression(a) && nameOf(a) === 'connect') ?? null;
            }
        } else if (typescript.isIdentifier(inner)) {
            const d = this.checker.getSymbolAtLocation(inner)?.valueDeclaration;
            if (d && typescript.isVariableDeclaration(d) && d.initializer && typescript.isCallExpression(d.initializer) && nameOf(d.initializer) === 'connect') {
                conn = d.initializer;
                this.deps?.add(d.getSourceFile());
            }
        }
        if (!conn) {
            return null;
        }
        const comp = this.unwrapExpr(target);
        return comp ? {comp, dispatch: conn.arguments[1] ?? null, call: conn} : null;
    }
}

/** `channels/src/a.tsx:12:5` -> `channels/src/a.tsx`. */
export function fileOfLoc(loc: Loc): string {
    return loc.replace(/(:\d+)+$/, '');
}

/**
 * The name of a top-level statement that declares code: a function, a class, or a variable holding one (directly or
 * through a call such as `memo(…)` or `connect(…)(…)`); `default` for an anonymous default export. Null for anything
 * else (a constant list, an import).
 */
function topLevelName(st: ts.Node): string | null {
    if ((typescript.isFunctionDeclaration(st) || typescript.isClassDeclaration(st))) {
        return st.name?.text ?? 'default';
    }
    if (typescript.isVariableStatement(st)) {
        const d = st.declarationList.declarations[0];
        const holdsCode = (e: ts.Node | undefined): boolean => Boolean(e) && (isFunctionLike(e) || typescript.isClassExpression(e!) || (typescript.isCallExpression(e!) && (e!.arguments.some(holdsCode) || holdsCode(e!.expression))) || ((typescript.isParenthesizedExpression(e!) || typescript.isAsExpression(e!)) && holdsCode(e!.expression)));
        return d && typescript.isIdentifier(d.name) && holdsCode(d.initializer) ? d.name.text : null;
    }
    if (typescript.isExportAssignment(st)) {
        return 'default';
    }
    return null;
}

/** `styled(X)(...)`, `styled(X, opts)(...)`, `styled.div(...)`: the root of the callee chain is `styled`. */
function isStyledCall(call: ts.CallExpression): boolean {
    let c: ts.Expression = strip(call.expression) as ts.Expression;
    while (typescript.isCallExpression(c) || typescript.isPropertyAccessExpression(c)) {
        c = strip(c.expression) as ts.Expression;
    }
    return typescript.isIdentifier(c) && c.text === 'styled';
}

/** The X of `styled(X)…` when X is an expression (a component), not a tag name. */
export function styledTarget(e: ts.Expression): ts.Expression | null {
    let c: ts.Expression = strip(e) as ts.Expression;
    while (typescript.isCallExpression(c) || typescript.isPropertyAccessExpression(c)) {
        if (typescript.isCallExpression(c)) {
            const callee = strip(c.expression) as ts.Expression;
            if (typescript.isIdentifier(callee) && callee.text === 'styled') {
                const a = c.arguments[0];
                return a && !typescript.isStringLiteralLike(a) ? a : null;
            }
        }
        c = strip(c.expression) as ts.Expression;
    }
    return null;
}

function findDynamicImport(n: ts.Node): ts.CallExpression | null {
    let found: ts.CallExpression | null = null;
    const visit = (m: ts.Node) => {
        if (found) {
            return;
        }
        if (typescript.isCallExpression(m) && m.expression.kind === typescript.SyntaxKind.ImportKeyword) {
            found = m;
            return;
        }
        typescript.forEachChild(m, visit);
    };
    typescript.forEachChild(n, visit);
    return found;
}
