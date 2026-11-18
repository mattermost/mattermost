// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {attrValue, isJsxTag, strip} from '../ast.ts';
import {isCallUsage, type ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';
import type {Resolver} from '../values.ts';

/** Recover render positions lost when a caller constructs JSX and passes it as a prop. */
export class PropRenderUses {
    private readonly ix: ProgramIndex;
    private readonly R: Resolver;
    private readonly dynamicConverged: boolean;
    private escapedOwners?: Set<ts.Node>;
    constructor(ix: ProgramIndex, R: Resolver, dynamicConverged = true) {
        this.ix = ix;
        this.R = R;
        this.dynamicConverged = dynamicConverged;
    }

    /** A local JSX holder may have conditional writes, but its sole read must be this prop value. */
    private singleUse(expression: ts.Expression): boolean {
        const node = strip(expression)!;
        if (typescript.isJsxElement(node) || typescript.isJsxSelfClosingElement(node) || typescript.isJsxFragment(node)) {
            return true;
        }
        if (!typescript.isIdentifier(node)) {
            return false;
        }
        const symbol = this.ix.checker.getSymbolAtLocation(node);
        const declaration = symbol?.valueDeclaration;
        if (!declaration || !typescript.isVariableDeclaration(declaration) || !typescript.isVariableDeclarationList(declaration.parent) || !declaration.initializer) {
            return false;
        }
        const fnOf = (part: ts.Node) => {
            let parent = part.parent;
            while (parent && !typescript.isFunctionLike(parent)) {
                parent = parent.parent;
            }
            return parent;
        };
        const owner = fnOf(declaration);
        if (!owner || fnOf(node) !== owner) {
            return false;
        }
        const values: ts.Expression[] = [declaration.initializer];
        let reads = 0;
        let unsafe = false;
        const visit = (part: ts.Node) => {
            if (typescript.isIdentifier(part) && part !== declaration.name && this.ix.checker.getSymbolAtLocation(part) === symbol) {
                const parent = part.parent;
                if (typescript.isBinaryExpression(parent) && parent.left === part && parent.operatorToken.kind === typescript.SyntaxKind.EqualsToken && fnOf(part) === owner) {
                    values.push(parent.right);
                } else {
                    reads++;
                    unsafe ||= part !== node;
                }
            }
            typescript.forEachChild(part, visit);
        };
        visit(node.getSourceFile());
        const jsxOrNull = (expression: ts.Expression) => {
            const value = strip(expression)!;
            return value.kind === typescript.SyntaxKind.NullKeyword || typescript.isJsxElement(value) || typescript.isJsxSelfClosingElement(value) || typescript.isJsxFragment(value);
        };
        return !unsafe && reads === 1 && values.every(jsxOrNull);
    }

    /** Shorthand names refer to property symbols; proofs must inspect the referenced value instead. */
    private valueSymbol(node: ts.Node): ts.Symbol | undefined {
        const symbol = typescript.isShorthandPropertyAssignment(node.parent) ? this.ix.checker.getShorthandAssignmentValueSymbol(node.parent) : this.ix.checker.getSymbolAtLocation(node);
        return symbol && (symbol.flags & typescript.SymbolFlags.Alias ? this.ix.checker.getAliasedSymbol(symbol) : symbol);
    }

    /** Alias resolution alone does not prove a wrapper cannot publish its component argument. */
    private safeWrapper(call: ts.CallExpression): boolean {
        let callee = strip(call.expression)!;
        while (typescript.isCallExpression(callee)) {
            callee = strip(callee.expression)!;
        }
        const root = typescript.isPropertyAccessExpression(callee) ? callee.expression : callee;
        const symbol = this.ix.checker.getSymbolAtLocation(root);
        for (const declaration of symbol?.declarations ?? []) {
            let parent: ts.Node | undefined = declaration;
            while (parent && !typescript.isImportDeclaration(parent)) {
                parent = parent.parent;
            }
            if (parent && typescript.isStringLiteral(parent.moduleSpecifier)) {
                const from = parent.moduleSpecifier.text;
                let name = '';
                if (typescript.isPropertyAccessExpression(callee)) {
                    name = callee.name.text;
                } else if (typescript.isImportSpecifier(declaration)) {
                    name = (declaration.propertyName ?? declaration.name).text;
                }
                if ((from === 'react-redux' && name === 'connect') || (from === 'react' && ['memo', 'forwardRef'].includes(name)) || (from === 'react-intl' && name === 'injectIntl') || (['react-router', 'react-router-dom'].includes(from) && name === 'withRouter')) {
                    return true;
                }
            }
        }
        return false;
    }

    /** A sole indexed JSX mount is a proof only when the component has no opaque value uses. */
    private completeOwner(owner: ts.Node): boolean {
        if (!this.dynamicConverged) {
            return false;
        }
        if (!this.escapedOwners) {
            const escaped = new Set<ts.Node>();
            const owners = new Map<ts.Symbol, ts.Node>();
            for (const component of this.ix.usages.keys()) {
                const named = component as ts.NamedDeclaration;
                const name = named.name ?? (typescript.isVariableDeclaration(component.parent) ? component.parent.name : undefined);
                const symbol = name && this.valueSymbol(name);
                if (symbol) {
                    owners.set(symbol, component);
                }
            }
            const wrappers = new Map<ts.Expression, ts.Node>();
            const collect = (node: ts.Node) => {
                let expression;
                if (typescript.isVariableDeclaration(node)) {
                    expression = node.initializer;
                } else if (typescript.isExportAssignment(node)) {
                    expression = node.expression;
                }
                if (expression) {
                    const component = this.ix.unwrapExpr(expression);
                    if (component && this.ix.usages.has(component)) {
                        let symbol;
                        if (typescript.isVariableDeclaration(node)) {
                            symbol = this.valueSymbol(node.name);
                        } else {
                            const module = this.ix.checker.getSymbolAtLocation(node.getSourceFile());
                            symbol = module && this.ix.checker.getExportsOfModule(module).find((entry) => entry.declarations?.includes(node as ts.Declaration));
                        }
                        if (symbol) {
                            owners.set(symbol, component);
                            wrappers.set(expression, component);
                        }
                    }
                }
                typescript.forEachChild(node, collect);
            };
            this.ix.files.forEach(collect);
            const boundOwners = new Set(owners.values());
            for (const component of this.ix.usages.keys()) {
                if (!boundOwners.has(component)) {
                    escaped.add(component);
                }
            }
            const wrappedUse = (node: ts.Node, component: ts.Node) => {
                if (wrappers.get(node as ts.Expression) === component) {
                    return true;
                }
                let child = node;
                let parent = node.parent;
                while (parent && !typescript.isStatement(parent) && !typescript.isVariableDeclaration(parent)) {
                    if (typescript.isCallExpression(parent) && parent.arguments.includes(child as ts.Expression) && !this.safeWrapper(parent)) {
                        return false;
                    }
                    if (wrappers.get(parent as ts.Expression) === component) {
                        return true;
                    }
                    if (!typescript.isCallExpression(parent) && !typescript.isParenthesizedExpression(parent)) {
                        return false;
                    }
                    child = parent;
                    parent = parent.parent;
                }
                return false;
            };
            const visit = (node: ts.Node) => {
                if (typescript.isIdentifier(node)) {
                    const symbol = this.valueSymbol(node);
                    const component = symbol && owners.get(symbol);
                    if (component) {
                        const parent = node.parent;
                        const declaration = (parent as ts.NamedDeclaration).name === node && (parent === component || (typescript.isVariableDeclaration(parent) && (parent.initializer === component || (parent.initializer && wrappers.get(parent.initializer) === component))));
                        const binding = typescript.isImportSpecifier(parent) || typescript.isImportClause(parent) || typescript.isExportSpecifier(parent) || typescript.isExportAssignment(parent);
                        let tag;
                        if (isJsxTag(parent) && parent.tagName === node) {
                            tag = parent;
                        } else if (typescript.isJsxClosingElement(parent)) {
                            tag = parent.parent.openingElement;
                        }
                        const indexed = tag && this.ix.usages.get(component)?.includes(tag);
                        if (!declaration && !binding && !indexed && !wrappedUse(node, component)) {
                            escaped.add(component);
                        }
                    }
                }
                typescript.forEachChild(node, visit);
            };
            this.ix.files.forEach(visit);
            this.escapedOwners = escaped;
        }
        return !this.escapedOwners.has(owner);
    }

    /** Extend value provenance with render context only along a unique JSX mounting path. */
    uniqueMountChain(creation: ts.Node): ts.Node[] {
        const out: ts.Node[] = [];
        const seen = new Set<ts.Node>([creation]);
        let node = creation;
        while (true) {
            const owner = this.R.componentOf(node);
            const usages = owner ? this.ix.usages.get(owner) ?? [] : [];
            if (usages.length !== 1 || !owner || !this.completeOwner(owner) || isCallUsage(usages[0]) || seen.has(usages[0])) {
                return out;
            }
            node = usages[0];
            seen.add(node);
            out.push(node);
        }
    }

    /** A JSX prop may hold a component whose internal id is literal, so value provenance stops inside it. */
    private containsThroughSingleMount(source: ts.Node, creation: ts.Node, contains: (outer: ts.Node, inner: ts.Node) => boolean): boolean {
        const seen = new Set<ts.Node>();
        for (let node = creation; !seen.has(node);) {
            if (contains(source, node)) {
                return true;
            }
            seen.add(node);
            const owner = this.R.componentOf(node);
            const usages = owner ? this.ix.usages.get(owner) ?? [] : [];

            // Another mount can render the same literal id concurrently, independently of this prop read.
            if (usages.length !== 1 || !owner || !this.completeOwner(owner) || isCallUsage(usages[0])) {
                return false;
            }
            node = usages[0];
        }
        return false;
    }

    /** All direct render reads of the prop at this exact mount; unknown forwarding/escaping reads fail closed. */
    of(creation: ts.Node, mount: ts.Node): ts.Node[] | undefined {
        const tag = typescript.isJsxElement(mount) ? mount.openingElement : mount;
        if (!isJsxTag(tag)) {
            return undefined;
        }
        const owner = this.ix.componentOfTag(tag);
        if (!owner) {
            return undefined;
        }
        const contains = (outer: ts.Node, inner: ts.Node) => outer.getSourceFile() === inner.getSourceFile() && outer.pos <= inner.pos && outer.end >= inner.end;
        const props = tag.attributes.properties.filter(typescript.isJsxAttribute).filter((attr) => {
            const value = attrValue(attr);
            return value && this.singleUse(value) && this.R.sources(value).some((source) => !('marker' in source) && this.containsThroughSingleMount(source.expr, creation, contains));
        });
        if (props.length !== 1) {
            return undefined;
        }
        const prop = props[0].name.getText();
        const out: ts.Node[] = [];
        let unknown = false;
        const visit = (node: ts.Node) => {
            const ref = this.R.propsPath(node) ?? this.R.restPropsOf(node as ts.Expression);
            if (ref?.comp === owner && ref.path.length === 0) {
                const parent = node.parent;
                const declaration = (typescript.isBindingElement(parent) && parent.name === node) || (typescript.isParameter(parent) && parent.name === node);
                const memberBase = (typescript.isPropertyAccessExpression(parent) || (typescript.isElementAccessExpression(parent) && parent.argumentExpression && typescript.isStringLiteralLike(strip(parent.argumentExpression)!))) && parent.expression === node;
                if (!declaration && !memberBase) {
                    unknown = true;
                }
            }
            if (ref?.comp === owner && ref.path.length === 1 && ref.path[0] === prop) {
                // Binding declarations are not reads. Nor is the base of a longer property reference.
                if ((typescript.isBindingElement(node.parent) && node.parent.name === node) || (typescript.isParameter(node.parent) && node.parent.name === node)) {
                    return;
                }
                let child = node;
                while (child.parent && (typescript.isParenthesizedExpression(child.parent) || typescript.isAsExpression(child.parent) || typescript.isNonNullExpression(child.parent) || typescript.isSatisfiesExpression(child.parent))) {
                    child = child.parent;
                }
                const parent = child.parent;
                if ((typescript.isJsxExpression(parent) && parent.expression === child && !typescript.isJsxAttribute(parent.parent)) || (typescript.isReturnStatement(parent) && parent.expression === child)) {
                    out.push(node);
                } else {
                    unknown = true;
                }
                return;
            }
            typescript.forEachChild(node, visit);
        };
        visit(owner);

        // A prop reference in a deferred body may render concurrently with either arm.
        const fnOf = (node: ts.Node) => {
            let p = node.parent;
            while (p && !typescript.isFunctionLike(p)) {
                p = p.parent;
            }
            return p;
        };
        if (out.some((node) => !typescript.isClassLike(owner) && fnOf(node) !== owner)) {
            unknown = true;
        }
        return unknown || !out.length ? undefined : out;
    }
}
