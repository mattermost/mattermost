// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {CONTAINER_ROLES, elementOf, inJsxChildren, inRenderReturn, LIBRARY_PORTAL_CHANNELS, pickedIdentifiers, usageAnchor} from './elements.ts';
import type {Emission, ScanDiagnostic} from './types.ts';

import {attrValue, componentName, isFunctionLike, isIntrinsic, isJsxTag, jsxAttr, propName, returnsOf, strip, type FunctionLike, type JsxTag} from '../ast.ts';
import {cmp} from '../compare.ts';
import {isGrammarError} from '../grammar.ts';
import {MAX_HELD_JSX_HOPS, MAX_SCOPE_PATH} from '../limits.ts';
import {type Element, type Loc} from '../manifest_types.ts';
import type {PortalLookup} from '../portal_lookup.ts';
import {isCallUsage, type CodeNode, type ProgramIndex, type Usage} from '../program_index.ts';
import {ScopeGraph, ScopeGraphBudgetError, type ScopeState} from '../scope_graph.ts';
import {typescript} from '../typescript.ts';
import type {Resolver} from '../values.ts';
import {assignmentsOf, pushesOf} from '../values.ts';

/** Discover mount-specific rendered scopes across held JSX, component boundaries and portals. */
export class RenderScopes {
    private readonly context: {ix: ProgramIndex; R: Resolver; portals: PortalLookup; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic};
    constructor(context: {ix: ProgramIndex; R: Resolver; portals: PortalLookup; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic}) {
        this.context = context;
    }

    /**
     * Whether a value (`from`) handed to a library component through `node` renders in that component's portal, by the
     * declaration the prop or property resolves to (LIBRARY_PORTAL_CHANNELS): a JSX attribute of a listed component,
     * or a property of a listed type however it is written (`{menuItemProps: …}`, `option.menuItemProps = …`). Every
     * other channel of a library component renders where its usage is.
     */
    private libraryPortalChannel(node: ts.Node, from: ts.Node): boolean {
        let name: ts.Node | undefined;
        if (typescript.isJsxAttribute(node) && node.initializer === from) {
            name = node.name;
        } else if ((typescript.isPropertyAssignment(node) && node.initializer === from) || (typescript.isShorthandPropertyAssignment(node) && node.name === from)) {
            name = node.name;
        } else if (typescript.isBinaryExpression(node) && node.operatorToken.kind === typescript.SyntaxKind.EqualsToken && node.right === from && typescript.isPropertyAccessExpression(node.left)) {
            name = node.left.name;
        }
        if (!name) {
            return false;
        }

        // an object literal's property resolves to the literal's own symbol: the declaration is its contextual type's
        const checker = this.context.ix.checker;
        const holder = typescript.isJsxAttribute(node) || typescript.isPropertyAssignment(node) || typescript.isShorthandPropertyAssignment(node) ? node.parent : undefined;
        const contextual = holder && (typescript.isObjectLiteralExpression(holder) || typescript.isJsxAttributes(holder)) ? checker.getContextualType(holder) : undefined;
        const key = typescript.isJsxAttribute(node) ? node.name.getText() : propName(name as ts.PropertyName);
        const lookup = (type: ts.Type | undefined) => (type && key ? checker.getPropertyOfType(checker.getNonNullableType(type), key) : undefined);
        let symbol = contextual ? lookup(contextual) : checker.getSymbolAtLocation(name);
        if (holder && typescript.isObjectLiteralExpression(holder) && !symbol?.declarations?.some((declaration) => this.context.ix.isLibraryNode(declaration))) {
            // an item a map callback returns has no contextual type of its own (map infers it from the item): its type is
            // the element type of the array the call is contextually typed as (`useMemo<ComboboxOption[]>(() => xs.map(…))`)
            symbol = lookup(this.mappedElementType(holder)) ?? symbol;
        }
        for (const declaration of symbol?.declarations ?? []) {
            if (!this.context.ix.isLibraryNode(declaration)) {
                continue;
            }
            const file = declaration.getSourceFile().fileName.replaceAll('\\', '/');
            const owner = typescript.findAncestor(declaration.parent, (n) => typescript.isTypeAliasDeclaration(n) || typescript.isInterfaceDeclaration(n) || typescript.isFunctionDeclaration(n) || typescript.isVariableDeclaration(n));
            const ownerName = owner && 'name' in owner && owner.name && typescript.isIdentifier(owner.name) ? owner.name.text : '';
            const prop = symbol!.name;
            if (LIBRARY_PORTAL_CHANNELS.some((channel) => file.includes(`/node_modules/${channel.package}/`) && channel.owners.includes(ownerName) && (channel.props === 'all' || channel.props.includes(prop)))) {
                return true;
            }
        }
        return false;
    }

    /** The element type of the array an item returned by a `map`/`flatMap` callback ends up in, by the call's contextual type. */
    private mappedElementType(item: ts.Expression): ts.Type | undefined {
        let value: ts.Node = item;
        while (typescript.isParenthesizedExpression(value.parent)) {
            value = value.parent;
        }
        let fn: ts.Node | undefined;
        if (typescript.isArrowFunction(value.parent) && value.parent.body === value) {
            fn = value.parent;
        } else if (typescript.isReturnStatement(value.parent)) {
            fn = typescript.findAncestor(value.parent, isFunctionLike);
        }
        const call = fn?.parent;
        if (!fn || !call || !typescript.isCallExpression(call) || !call.arguments.includes(fn as ts.Expression)) {
            return undefined;
        }
        const callee = strip(call.expression);
        if (!callee || !typescript.isPropertyAccessExpression(callee) || !['map', 'flatMap'].includes(callee.name.text)) {
            return undefined;
        }
        const checker = this.context.ix.checker;

        // `[...xs.map(…)]`: a spread's own expression has no contextual type; the array literal it is spread into has
        const spread = typescript.isSpreadElement(call.parent) && typescript.isArrayLiteralExpression(call.parent.parent) ? call.parent.parent : undefined;
        const array = checker.getContextualType(spread ?? call);
        return array ? checker.getIndexTypeOfType(checker.getNonNullableType(array), typescript.IndexKind.Number) : undefined;
    }

    /**
     * The local a node is the value of: `const control = <X/>` or `control = <X/>` (`node` its parent, `from` the value).
     * Only JSX itself, directly or as an arm of `?:`, `&&`, `||` or `??`: a local holding anything else (a memoized
     * components object, a callback) is handed on to something that renders it its own way, so it is not followed.
     */
    private localHolding(node: ts.Node, from: ts.Node): ts.Symbol | undefined {
        const isJsx = (n: ts.Node): boolean => {
            const value = strip(n as ts.Expression) as ts.Node;
            if (typescript.isJsxElement(value) || typescript.isJsxSelfClosingElement(value) || typescript.isJsxFragment(value)) {
                return true;
            }
            if (typescript.isConditionalExpression(value)) {
                return isJsx(value.whenTrue) || isJsx(value.whenFalse);
            }
            return typescript.isBinaryExpression(value) && [typescript.SyntaxKind.AmpersandAmpersandToken, typescript.SyntaxKind.BarBarToken, typescript.SyntaxKind.QuestionQuestionToken].includes(value.operatorToken.kind) && (isJsx(value.left) || isJsx(value.right));
        };
        if (!isJsx(from)) {
            return undefined;
        }
        if (typescript.isVariableDeclaration(node) && node.initializer === from && typescript.isIdentifier(node.name)) {
            return this.context.ix.checker.getSymbolAtLocation(node.name);
        }
        if (typescript.isBinaryExpression(node) && node.operatorToken.kind === typescript.SyntaxKind.EqualsToken && node.right === from && typescript.isIdentifier(node.left)) {
            return this.context.ix.checker.getSymbolAtLocation(node.left);
        }
        return undefined;
    }

    /** Where a local holding JSX is rendered: each `{local}` in the function that declares it. */
    private renderedAt(local: ts.Symbol, from: ts.Node): ts.Node[] {
        const scope = typescript.findAncestor(local.valueDeclaration ?? from, isFunctionLike) ?? from.getSourceFile();
        const out: ts.Node[] = [];
        const visit = (node: ts.Node) => {
            if (typescript.isIdentifier(node) && this.context.ix.checker.getSymbolAtLocation(node) === local) {
                let use: ts.Node = node;
                while (typescript.isParenthesizedExpression(use.parent) || typescript.isAsExpression(use.parent) || typescript.isNonNullExpression(use.parent) || (typescript.isBinaryExpression(use.parent) && use.parent.right === use && [typescript.SyntaxKind.AmpersandAmpersandToken, typescript.SyntaxKind.BarBarToken, typescript.SyntaxKind.QuestionQuestionToken].includes(use.parent.operatorToken.kind)) || (typescript.isConditionalExpression(use.parent) && use.parent.condition !== use)) {
                    use = use.parent;
                }
                if (typescript.isJsxExpression(use.parent)) {
                    out.push(use.parent);
                }
            }
            typescript.forEachChild(node, visit);
        };
        visit(scope);
        return out;
    }

    // ---- scopes rendered by a component (open targets) -----------------------------------

    readonly scopeGraph = new ScopeGraph();

    private scopeFailed = false;

    emissionsByFile = new Map<ts.SourceFile, Emission[]>();

    private scopeContextParts: Map<ts.Node, Set<string>> | null = null;

    scopeContextDepth = 0;

    private scopeContexts = new Map<ts.Node, Map<string, Loc[]>>();

    /** Retains only usage-chain suffixes that can reach an emission through this component. */
    private scopeContext(path: Loc[], node: ts.Node): Loc[] {
        const owner = isFunctionLike(node) || typescript.isClassLike(node) ? node : this.context.R.componentOf(node) ?? node;
        if (!this.scopeContextParts) {
            this.scopeContextParts = new Map();
            const remember = (component: ts.Node | null | undefined, prefix: Loc[]) => {
                if (!component) {
                    return;
                }
                const parts = this.scopeContextParts!.get(component) ?? new Set<string>();
                for (let start = 0; start < prefix.length; start++) {
                    parts.add(prefix.slice(start).join('<'));
                }
                this.scopeContextParts!.set(component, parts);
            };
            for (const emissions of this.emissionsByFile.values()) {
                for (const emission of emissions) {
                    const forward = [...emission.via].reverse();
                    this.scopeContextDepth = Math.max(this.scopeContextDepth, forward.length);
                    remember(emission.site.owner, forward);
                    for (let index = 0; index < forward.length; index++) {
                        const usage = this.context.usageByLoc.get(forward[index]);
                        const component = usage && (isCallUsage(usage) ? this.context.ix.unwrapExpr(usage.call.expression) : this.context.ix.componentOfTag(usage));
                        remember(component, forward.slice(0, index + 1));
                    }
                }
            }
        }
        const key = path.join('<');
        const contexts = this.scopeContexts.get(owner) ?? new Map<string, Loc[]>();
        this.scopeContexts.set(owner, contexts);
        const memo = contexts.get(key);
        if (memo) {
            return memo;
        }
        const context = path.slice();
        while (context.length && !this.scopeContextParts.get(owner)?.has(context.join('<'))) {
            context.shift();
        }
        contexts.set(key, context);
        return context;
    }

    /**
     * Testid scopes a subtree renders: its own valid testids plus those of the components it uses. `path` is the
     * chain of usages descended through (outermost first); a child's testid only counts when it was produced
     * through that chain (or is literal), so a shared wrapper doesn't leak other instances' scopes.
     */
    scopesOf(node: ts.Node, trail: Loc[] = [], followRefs = false): Set<string> {
        if (this.scopeFailed) {
            return new Set();
        }
        try {
            return this.scopeGraph.values(this.scopeState(node, trail, followRefs, trail.length, false, followRefs));
        } catch (error) {
            if (!(error instanceof ScopeGraphBudgetError)) {
                throw error;
            }
            this.scopeFailed = true;
            this.context.diag('input', 'error', this.context.ix.where(node), error.message, 'Inspect the component\'s scope propagation before increasing the analysis budget.');
            return new Set();
        }
    }

    /** Build one context-sensitive graph state and link the inline subtrees it can render. */
    private scopeState(node: ts.Node, trail: Loc[], followRefs: boolean, depth = trail.length, crossedPortal = false, inlineOnly = true): ScopeState {
        const path = this.scopeContext(trail, node);
        const contextDepth = Math.min(depth, path.length + 1);

        // a component that renders (or forwards) a prop as JSX renders what its mounts pass, which no testid's chain
        // records: such a state is told apart by the mounts it was entered through, up to MAX_SCOPE_PATH of them (still
        // finite), so a shared forwarding component isn't pooled across the mounts that pass different elements
        let mount: Loc[] | undefined;
        if (followRefs && trail.length) {
            if (this.rendersPropJsx(node)) {
                mount = trail.slice(-MAX_SCOPE_PATH);
            } else if (this.rendersPropJsx(node, new Set(), true)) {
                mount = path.length ? path : trail.slice(-1);
            }
        }
        const key = (inlineOnly ? 'inline:' : 'all:') + (crossedPortal ? 'portal:' : '') + (followRefs ? '&' : '') + contextDepth + ':' + path.join('<') + (mount ? `@${mount.join('<')}` : '');
        const owner = isFunctionLike(node) || typescript.isClassLike(node) ? node : this.context.R.componentOf(node);
        const label = owner ? `${componentName(owner)} (${this.context.ix.where(node)})` : this.context.ix.where(node);
        return this.scopeGraph.state(node, key, label, (state) => {
            const throughPath = (via: Loc[]) => {
                const count = Math.min(contextDepth, via.length);
                return path.length >= count && via.slice(0, count).every((loc, index) => loc === path[path.length - 1 - index]);
            };
            for (const e of this.emissionsByFile.get(node.getSourceFile()) ?? []) {
                if ((!inlineOnly || (!crossedPortal && !this.context.portals.between(e.site.node, node))) && !isGrammarError(e.parsed) && e.parsed.scope.length && e.site.node.pos >= node.pos && e.site.node.end <= node.end && throughPath(e.via)) {
                    state.own.add(e.parsed.scope.join('.'));
                }
            }
            const visit = (n: ts.Node) => {
                const portaled = crossedPortal || this.context.portals.between(n, node);
                if (isJsxTag(n)) {
                    const comp = this.context.ix.componentOfTag(n);
                    if (comp && !this.context.ix.isLibraryNode(comp)) {
                        this.scopeGraph.link(state, this.scopeState(comp, [...(mount ?? path), this.context.ix.where(n)], followRefs, contextDepth + 1, portaled, inlineOnly));
                    }
                }

                // a subtree (a menu's children) can refer to JSX defined outside it; a whole component's body already holds it
                // `{createChannelItem}`: JSX held in a variable (`let x = null; if (…) x = <Menu.Item …/>`, or `items.push(<Menu.Item …/>)`)
                // `{isAdmin ? makeMember : null}`, `{canCreate && createItem}`: the variables a condition picks from
                if (followRefs && typescript.isJsxExpression(n) && n.expression) {
                    for (const id of pickedIdentifiers(n.expression)) {
                        for (const expr of this.jsxHeldBy(id, mount)) {
                            this.scopeGraph.link(state, this.scopeState(expr, path, true, contextDepth, portaled, inlineOnly));
                        }
                    }
                }

                // `{renderTeam(team)}`: a render helper in the same file (in JSX children, not in a handler attribute);
                // `{options.map(renderOption)}`: one passed by reference
                if (followRefs && typescript.isCallExpression(n) && (inJsxChildren(n) || inRenderReturn(n, node))) {
                    const callee = strip(n.expression);
                    const target = callee && this.context.ix.unwrapExpr(callee as ts.Expression);
                    if (target && !this.context.ix.isLibraryNode(target) && isFunctionLike(target)) {
                        this.scopeGraph.link(state, this.scopeState(target, path, true, contextDepth, portaled, inlineOnly));
                    }
                    const refs = [callee, ...n.arguments.map((a) => strip(a))].filter((x): x is ts.Identifier => Boolean(x) && typescript.isIdentifier(x!));
                    for (const id of refs) {
                        const helper = this.localHelper(id);
                        for (const r of helper ? returnsOf(helper) : []) {
                            this.scopeGraph.link(state, this.scopeState(r, path, true, contextDepth, portaled, inlineOnly));
                        }
                    }
                }
                typescript.forEachChild(n, visit);
            };
            visit(node);
        });
    }

    /** A function declared in the same file as the call (not a component: those are followed through their tags). */
    private localHelper(id: ts.Identifier): FunctionLike | null {
        const d = this.context.ix.checker.getSymbolAtLocation(id)?.valueDeclaration;
        const fn = d && typescript.isVariableDeclaration(d) ? d.initializer && strip(d.initializer) : d;
        if (!fn || !isFunctionLike(fn) || fn.getSourceFile() !== id.getSourceFile() || this.context.ix.usages.has(fn)) {
            return null;
        }
        return fn;
    }

    /**
     * Whether a callee is React's own hook of that name, by what it resolves to: `useMemo`, `memo` imported as
     * `{useMemo as memo}`, `React.useMemo` through a default or namespace import. A local function that happens to share
     * the name is not.
     */
    private isReactHook(callee: ts.Expression, hook: string): boolean {
        const name = typescript.isPropertyAccessExpression(callee) ? callee.name : callee;
        let symbol = typescript.isIdentifier(name) ? this.context.ix.checker.getSymbolAtLocation(name) : undefined;
        if (symbol && symbol.flags & typescript.SymbolFlags.Alias) {
            symbol = this.context.ix.checker.getAliasedSymbol(symbol);
        }
        if (!symbol || symbol.getName() !== hook) {
            return false;
        }
        return (symbol.declarations ?? []).some((declaration) => {
            const module = typescript.findAncestor(declaration, (node) => typescript.isModuleDeclaration(node) && typescript.isStringLiteral(node.name) && node.name.text === 'react');
            return Boolean(module) || (/[\\/]node_modules[\\/](@types[\\/])?react[\\/]/).test(declaration.getSourceFile().fileName);
        });
    }

    private propJsx = new Map<ts.Node, boolean>();

    private childJsx = new Map<ts.Node, boolean>();

    /** Whether any value a function returns refers to one of its parameters. */
    private returnsUseParameters(fn: FunctionLike): boolean {
        const parameters = new Set(fn.parameters.flatMap((parameter) => {
            const symbol = typescript.isIdentifier(parameter.name) ? this.context.ix.checker.getSymbolAtLocation(parameter.name) : undefined;
            return symbol ? [symbol] : [];
        }));
        if (fn.parameters.some((parameter) => !typescript.isIdentifier(parameter.name))) {
            return true;
        }
        let uses = false;
        const visit = (node: ts.Node) => {
            if (uses) {
                return;
            }
            if (typescript.isIdentifier(node)) {
                const symbol = this.context.ix.checker.getSymbolAtLocation(node);
                uses = Boolean(symbol && parameters.has(symbol));
            }
            typescript.forEachChild(node, visit);
        };
        returnsOf(fn).forEach(visit);
        return uses;
    }

    /** Where following held JSX ran out of its budget (one diagnostic each). */
    private heldCuts = new Set<Loc>();

    /**
     * Whether a subtree renders one of its component's props as a JSX child (`{additionalControls}`), or forwards one
     * to a component that does (`<Slot control={control}/>` in a Frame): what it renders then depends on the mount
     * that passed the prop, through every forwarding component on the way.
     */
    private rendersPropJsx(node: ts.Node, seen = new Set<ts.Node>(), includeChildren = false): boolean {
        const cache = includeChildren ? this.childJsx : this.propJsx;
        const memo = cache.get(node);
        if (memo !== undefined) {
            return memo;
        }
        if (seen.has(node)) {
            return false;
        }
        seen.add(node);
        let found = false;
        const visit = (n: ts.Node) => {
            if (found) {
                return;
            }
            if (typescript.isJsxExpression(n) && n.expression && (typescript.isJsxElement(n.parent) || typescript.isJsxFragment(n.parent))) {
                found = pickedIdentifiers(n.expression).some((id) => this.isElementProp(id, includeChildren));
            } else if (typescript.isJsxAttribute(n) && n.initializer && typescript.isJsxExpression(n.initializer) && n.initializer.expression && pickedIdentifiers(n.initializer.expression).some((id) => this.isElementProp(id, includeChildren))) {
                const comp = this.context.ix.componentOfTag(n.parent.parent);
                found = Boolean(comp && !this.context.ix.isLibraryNode(comp) && this.rendersPropJsx(comp, seen, includeChildren));
            }
            typescript.forEachChild(n, visit);
        };
        visit(node);

        // a result inside a cycle may be incomplete: only the outermost call is remembered
        if (seen.size === 1 || found) {
            cache.set(node, found);
        }
        return found;
    }

    /** Whether a name is a component's own prop that can hold an element, including its mount's children. */
    private isElementProp(id: ts.Identifier, includeChildren = false): boolean {
        const d = this.context.ix.checker.getSymbolAtLocation(id)?.valueDeclaration;
        if (!d || !typescript.isBindingElement(d) || !typescript.isObjectBindingPattern(d.parent) || !typescript.isParameter(d.parent.parent) || !this.context.R.isComponentFn(d.parent.parent.parent as FunctionLike)) {
            return false;
        }
        const name = d.propertyName ? propName(d.propertyName) : propName(d.name);
        const type = this.context.ix.checker.getTypeAtLocation(id);
        const parts = type.isUnion() ? type.types : [type];
        return Boolean(name) && (includeChildren || name !== 'children') && parts.some((part) => !(part.flags & (typescript.TypeFlags.StringLike | typescript.TypeFlags.NumberLike | typescript.TypeFlags.BooleanLike | typescript.TypeFlags.Undefined | typescript.TypeFlags.Null)));
    }

    /**
     * The expressions a JSX child `{id}` can render: a local variable's initializer, assignments and pushes; for a prop, what
     * its mounts pass; for a name destructured from a call to an in-repo function (a hook returning
     * `{additionalControl}`), that function's returned property. The traversal walks each one for JSX.
     */
    private jsxHeldBy(id: ts.Identifier, mounts?: Loc[], depth = 0, seen = new Set<ts.Node>()): ts.Expression[] {
        const sym = this.context.ix.checker.getSymbolAtLocation(id);
        const d = sym?.valueDeclaration;
        if (!sym || !d || seen.has(d)) {
            return [];
        }
        if (depth > MAX_HELD_JSX_HOPS) {
            const at = this.context.ix.where(id);
            if (!this.heldCuts.has(at)) {
                this.heldCuts.add(at);
                this.context.diag('input', 'error', at, `JSX held by \`${id.text}\` was followed through more than ${MAX_HELD_JSX_HOPS} names: the scopes it renders past that are missing.`, 'Inspect the chain of variables, hook results and props it passes through, or raise MAX_HELD_JSX_HOPS if it is genuinely that long.');
            }
            return [];
        }
        seen.add(d);

        // through what a rendered list or element is built from: useMemo bodies, arrays and spreads, filter/slice/concat,
        // `a && <X/>`, `a ? b : c`, `a ?? b`; an identifier is followed to what it holds, anything else is walked for JSX
        const follow = (expr: ts.Expression, hops = 0): ts.Expression[] => {
            const e = strip(expr) as ts.Expression;
            if (hops > MAX_HELD_JSX_HOPS) {
                const at = this.context.ix.where(e);
                if (!this.heldCuts.has(at)) {
                    this.heldCuts.add(at);
                    this.context.diag('input', 'error', at, `JSX held by \`${id.text}\` is nested more than ${MAX_HELD_JSX_HOPS} levels deep: names inside it past that are not followed.`, 'Inspect the expression, or raise MAX_HELD_JSX_HOPS if it is genuinely that deep.');
                }
                return [expr];
            }
            if (typescript.isIdentifier(e)) {
                return this.jsxHeldBy(e, mounts, depth + 1, seen);
            }
            if (typescript.isArrayLiteralExpression(e)) {
                return e.elements.flatMap((element) => follow(typescript.isSpreadElement(element) ? element.expression : element, hops + 1));
            }
            if (typescript.isConditionalExpression(e)) {
                return [...follow(e.whenTrue, hops + 1), ...follow(e.whenFalse, hops + 1)];
            }
            if (typescript.isBinaryExpression(e) && e.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken) {
                return follow(e.right, hops + 1);
            }
            if (typescript.isBinaryExpression(e) && [typescript.SyntaxKind.BarBarToken, typescript.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
                return [...follow(e.left, hops + 1), ...follow(e.right, hops + 1)];
            }
            if (typescript.isCallExpression(e)) {
                const callee = strip(e.expression) as ts.Expression;
                const factory = this.isReactHook(callee, 'useMemo') && e.arguments[0] ? strip(e.arguments[0]) : undefined;
                if (factory && isFunctionLike(factory)) {
                    return returnsOf(factory).flatMap((returned) => follow(returned, hops + 1));
                }
                const name = typescript.isPropertyAccessExpression(callee) ? callee.name.text : '';
                if (typescript.isPropertyAccessExpression(callee) && ['filter', 'slice', 'concat', 'reverse', 'toSorted', 'flat'].includes(name)) {
                    return [...follow(callee.expression, hops + 1), ...(name === 'concat' ? e.arguments.flatMap((argument) => follow(argument, hops + 1)) : [])];
                }

                // an in-repo function holds what it returns (a local `useMemo` that ignores its factory holds nothing);
                // one whose returns use its parameters may render its arguments, so the call is walked whole
                const fn = this.context.ix.unwrapExpr(callee);
                if (fn && isFunctionLike(fn) && !this.context.ix.isLibraryNode(fn) && !this.returnsUseParameters(fn)) {
                    return returnsOf(fn).flatMap((returned) => follow(returned, hops + 1));
                }
            }
            return [expr];
        };
        if (typescript.isVariableDeclaration(d)) {
            if (d.getSourceFile() !== id.getSourceFile()) {
                return [];
            }
            return [...(d.initializer ? [d.initializer] : []), ...assignmentsOf(d, sym, this.context.ix.checker), ...pushesOf(d, sym, this.context.ix.checker)].flatMap(follow);
        }
        if (!typescript.isBindingElement(d) || !typescript.isObjectBindingPattern(d.parent) || d.dotDotDotToken) {
            return [];
        }
        const name = d.propertyName ? propName(d.propertyName) : propName(d.name);
        const holder = d.parent.parent;

        // `const {additionalControl} = usePriority(…)`: the property the called function returns
        const call = typescript.isVariableDeclaration(holder) && holder.initializer ? strip(holder.initializer) as ts.Expression : undefined;
        if (name && call && typescript.isCallExpression(call)) {
            const fn = this.context.ix.unwrapExpr(call.expression);
            if (!fn || !isFunctionLike(fn) || this.context.ix.isLibraryNode(fn)) {
                return [];
            }
            return returnsOf(fn).flatMap((returned) => {
                const object = strip(returned) as ts.Expression;
                const property = typescript.isObjectLiteralExpression(object) ? object.properties.find((p) => p.name && propName(p.name) === name) : undefined;
                if (property && typescript.isShorthandPropertyAssignment(property)) {
                    // `{additionalControl}`: the variable the shorthand names, not the property it creates
                    const value = this.context.ix.checker.getShorthandAssignmentValueSymbol(property)?.valueDeclaration;
                    if (value && typescript.isVariableDeclaration(value) && typescript.isIdentifier(value.name)) {
                        return this.jsxHeldBy(value.name, mounts, depth + 1, seen);
                    }
                    return [];
                }
                return property && typescript.isPropertyAssignment(property) ? follow(property.initializer) : [];
            });
        }

        // a component's prop (`{additionalControls}` of `({additionalControls}: Props)`): what the mounts this traversal came
        // through pass, innermost first (a source's path through forwarding components must match the trail it was
        // entered by), or every mount when it came from none; another mount's controls are not rendered here
        if (typescript.isParameter(holder) && this.context.R.isComponentFn(holder.parent as FunctionLike)) {
            if (name === 'children') {
                return (this.context.ix.usages.get(holder.parent as CodeNode) ?? []).flatMap((usage) => {
                    if (isCallUsage(usage) || (mounts && !mounts.includes(this.context.ix.where(usage)))) {
                        return [];
                    }
                    const children = typescript.isJsxOpeningElement(usage) ? usage.parent.children : [];
                    if (!children.some((child) => !typescript.isJsxText(child) || child.text.trim())) {
                        const explicit = jsxAttr(usage, 'children');
                        const expression = explicit && attrValue(explicit);
                        return expression ? follow(expression) : [];
                    }
                    return children.flatMap((child): ts.Expression[] => {
                        if (typescript.isJsxElement(child) || typescript.isJsxSelfClosingElement(child) || typescript.isJsxFragment(child)) {
                            return [child];
                        }
                        return typescript.isJsxExpression(child) && child.expression ? follow(child.expression) : [];
                    });
                });
            }
            const throughMounts = (via: Loc[]) => !mounts || via.every((loc, index) => index >= mounts.length || loc === mounts[mounts.length - 1 - index]);
            return this.context.R.sources(id).flatMap((source) => ('marker' in source || !throughMounts(source.via) ? [] : follow(source.expr)));
        }
        return [];
    }

    /**
     * A container's or keyed item's `renders`: the top-level scopes (one word) rendered inside its element, at any of
     * its emissions, other than its own and those something opens (a portal renders those outside it).
     */
    addNestedScopes(elements: Element[], byTemplate: Map<string, Emission[]>) {
        const declaredScopes = new Set(elements.flatMap((element) => element.scope.map((_, index) => element.scope.slice(0, index + 1).join('.'))));
        const enclosingRoots = new Map<ts.Node, Set<string>>();
        for (const element of elements.filter((element) => element.grammar && declaredScopes.has([...element.scope, element.name].join('.')) && (!element.role || CONTAINER_ROLES.has(element.role)))) {
            for (const emission of byTemplate.get(element.template) ?? []) {
                for (const tag of [emission.site.tag, emission.landing.tag]) {
                    if (tag) {
                        const root = elementOf(tag);
                        enclosingRoots.set(root, new Set([...(enclosingRoots.get(root) ?? []), element.template]));
                    }
                }
            }
        }

        const roots = new Map<string, Set<ts.Node>>();
        const rootsOf = (scope: string) => {
            let nodes = roots.get(scope);
            if (!nodes) {
                nodes = new Set();
                for (const element of elements.filter((e) => [...e.scope, e.name].join('.') === scope && (!e.role || CONTAINER_ROLES.has(e.role)))) {
                    for (const emission of byTemplate.get(element.template) ?? []) {
                        for (const tag of [emission.site.tag, emission.landing.tag]) {
                            if (tag) {
                                nodes.add(elementOf(tag));
                            }
                        }
                    }
                }
                roots.set(scope, nodes);
            }
            return nodes;
        };
        for (const element of elements.filter((e) => e.grammar && (e.scope.length || declaredScopes.has(e.name)))) {
            const scopeRoots = rootsOf(element.scope.join('.'));
            const occurrences = (byTemplate.get(element.template) ?? []).map((emission) => {
                const ownElements = new Set([emission.site.tag, emission.landing.tag].filter((tag): tag is JsxTag => Boolean(tag)).map(elementOf));
                const path = [emission.landing.tag ?? emission.site.node, ...emission.via.map((loc) => this.context.usageByLoc.get(loc)).filter((usage): usage is Usage => Boolean(usage)).map(usageAnchor)];
                const atRoot = (ancestor: ts.Node) => {
                    const enclosing = enclosingRoots.get(ancestor);
                    return scopeRoots.has(ancestor) || Boolean(!scopeRoots.size && !ownElements.has(ancestor) && enclosing && [...enclosing].some((template) => template !== element.template));
                };

                // Climbs the JSX written around a node to the scope's root. JSX held in a local (`const control = <X/>`,
                // `control = <X/>`) lands where the local is rendered (`{control}`), not where it is written, so the
                // climb continues from each of those, each its own path (`at` the place it is rendered), so a local rendered
                // both in place and in a portal lands both ways; without one it goes on from where it is written, as before.
                type Climbed = {reached: boolean; portaled: boolean; at?: string};
                const climb = (node: ts.Node, held: Set<ts.Symbol>): Climbed[] => {
                    let portaled = false;
                    for (let ancestor: ts.Node | undefined = node, previous: ts.Node | undefined; ancestor; previous = ancestor, ancestor = ancestor.parent) {
                        if (atRoot(ancestor)) {
                            return [{reached: true, portaled}];
                        }
                        const tag = typescript.isJsxElement(ancestor) ? ancestor.openingElement : ancestor;
                        if ((isJsxTag(tag) && !isIntrinsic(tag) && this.context.portals.tag(tag)) || (typescript.isCallExpression(ancestor) && this.context.portals.isCreatePortal(ancestor))) {
                            portaled = true;
                        }
                        if (previous && this.libraryPortalChannel(ancestor, previous)) {
                            portaled = true;
                        }
                        const local = previous && this.localHolding(ancestor, previous);
                        if (local && !held.has(local)) {
                            const rendered = this.renderedAt(local, ancestor).flatMap((at) => climb(at, new Set(held).add(local)).map((item) => ({...item, at: item.at ?? this.context.ix.where(at)})));
                            const below = portaled;
                            if (rendered.length && rendered.every((item) => item.reached)) {
                                return rendered.map((item) => ({...item, portaled: below || item.portaled}));
                            }
                        }
                    }
                    return [{reached: false, portaled}];
                };

                // every way the path can land, each portaled if any hop along it is: one per place a local is rendered
                const landings = (): Array<{portaled: boolean; at?: string}> => {
                    let states: Array<{portaled: boolean; at?: string}> = [{portaled: false}];
                    for (const node of path) {
                        const climbed = climb(node, new Set());
                        states = states.flatMap((state) => climbed.map((item) => ({portaled: state.portaled || item.portaled, at: item.at ?? state.at})));
                        if (climbed.every((item) => item.reached)) {
                            break;
                        }
                    }
                    return states;
                };
                const fallback = emission.via[emission.via.length - 1] ?? emission.site.at;
                return landings().map((landing) => ({portaled: landing.portaled, at: landing.at ?? fallback}));
            }).flat();
            const inline = occurrences.find((item) => !item.portaled);
            const portal = occurrences.find((item) => item.portaled);
            if (inline && portal) {
                this.context.diag('collisions', 'error', portal.at, `${element.template} lands both inside its scope at ${inline.at} and through a portal at ${portal.at}.`, 'Give the inline and portaled members distinct testid names.');
            } else if (portal) {
                element.portal = true;
            }
        }

        for (const el of elements) {
            if (!el.grammar || (el.role && !el.key)) {
                continue;
            }
            const own = el.scope[0] ?? el.name;
            const inside = new Set<string>();
            for (const e of byTemplate.get(el.template) ?? []) {
                // the children the testid's own tag is written with (`<PostAriaLabelDiv data-testid={…}>…</…>`), and
                // the element it lands on
                const tags = [...new Set([e.site.tag, e.landing.tag].filter((x): x is JsxTag => Boolean(x)))];
                for (const s of tags.flatMap((tag) => [...this.scopesOf(elementOf(tag), [...e.via].reverse(), true)])) {
                    if (!s.includes('.') && s !== own) {
                        inside.add(s);
                    }
                }
            }
            if (inside.size) {
                el.renders = [...inside].sort(cmp);
            }
        }
    }
}
