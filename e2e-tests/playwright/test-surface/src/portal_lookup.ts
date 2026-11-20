// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {exprName, isFunctionLike, isIntrinsic, isJsxTag, returnsOf, strip, type JsxTag} from './ast.ts';
import {relativeToRoot, type Config} from './config.ts';
import type {Diagnostic} from './manifest_types.ts';
import type {CodeNode, ProgramIndex} from './program_index.ts';
import {typescript as T} from './typescript.ts';

/** Opaque library exports whose portal behavior needs a declared lookup contract. */
const KNOWN_PORTALS: Readonly<Record<string, readonly string[]>> = {
    'react-bootstrap': ['Modal', 'Overlay', 'OverlayTrigger'],
    '@mui/material': ['Dialog', 'Menu', 'Modal', 'Popover', 'Popper', 'Portal'],
    '@mui/base': ['Modal', 'Popper', 'Portal'],
    '@floating-ui/react': ['FloatingPortal'],
};

/** Resolves DOM relocation boundaries by symbol or declared export; it conveys no action or wait semantics. */
export class PortalLookup {
    private ix: ProgramIndex;
    private config: Config;
    private diagnostics: Diagnostic[];
    private declared = new Set<ts.Symbol>();
    private declaredBodies = new Set<CodeNode>();
    private inferred = new Map<CodeNode, boolean>();
    private reported = new Set<ts.Node>();

    constructor(ix: ProgramIndex, config: Config, diagnostics: Diagnostic[]) {
        this.ix = ix;
        this.config = config;
        this.diagnostics = diagnostics;
        const modules = new Map<string, ts.Symbol>();
        for (const file of ix.files) {
            for (const statement of file.statements) {
                if (T.isImportDeclaration(statement) && T.isStringLiteral(statement.moduleSpecifier)) {
                    const symbol = ix.checker.getSymbolAtLocation(statement.moduleSpecifier);
                    if (symbol) {
                        modules.set(statement.moduleSpecifier.text, symbol);
                    }
                }
            }
        }
        for (const entry of config.lookupPortals) {
            if (!entry.from?.trim() || !entry.name?.trim() || !entry.reason?.trim()) {
                this.error(config.configPath, 'Each lookupPortals entry needs from, name and a specific reason.');
                continue;
            }
            const file = ix.program.getSourceFile(path.resolve(config.root, entry.from));
            const module = (file && ix.checker.getSymbolAtLocation(file)) || modules.get(entry.from);
            const exported = module && ix.checker.getExportsOfModule(module).find((symbol) => symbol.getName() === entry.name);
            if (!exported) {
                this.error(config.configPath, `lookupPortals cannot resolve ${entry.name} from ${entry.from}.`);
                continue;
            }
            const symbol = this.unalias(exported);
            this.declared.add(symbol);
            for (const declaration of symbol.declarations ?? []) {
                let body: CodeNode | null = null;
                if (T.isVariableDeclaration(declaration)) {
                    body = ix.unwrapExpr(declaration.initializer);
                } else if (T.isExportAssignment(declaration)) {
                    body = ix.unwrapExpr(declaration.expression);
                } else if (isFunctionLike(declaration) || T.isClassLike(declaration)) {
                    body = declaration;
                }
                if (body) {
                    this.declaredBodies.add(body);
                }
            }
        }
    }

    /** Checks every known opaque import and unresolved portal call, even without a testid on that node. */
    validate(): void {
        const visit = (node: ts.Node) => {
            if (isJsxTag(node) && !isIntrinsic(node)) {
                this.tag(node);
            } else if (T.isCallExpression(node) && (exprName(node.expression) === 'createPortal' || this.importOf(node.expression)?.name === 'createPortal' || this.symbol(node.expression)?.getName() === 'createPortal') && !this.isCreatePortal(node)) {
                const symbol = this.symbol(node.expression);
                const knownLocal = symbol?.declarations?.some((declaration) => this.ix.files.includes(declaration.getSourceFile()) && isFunctionLike(declaration) && Boolean(declaration.body));
                const owner = T.findAncestor(node, (ancestor) => (isFunctionLike(ancestor) || T.isClassLike(ancestor)) && this.declaredBodies.has(ancestor));
                if (!knownLocal && !owner && !this.reported.has(node)) {
                    this.reported.add(node);
                    this.error(this.ix.where(node), 'Cannot resolve createPortal as a DOM portal. Declare its host export in lookupPortals with a reason.');
                }
            }
            T.forEachChild(node, visit);
        };
        this.ix.files.forEach(visit);
    }

    /** Whether a JSX host relocates its children, including aliases of a declared or inferred export. */
    tag(tag: JsxTag, seen = new Set<CodeNode>()): boolean {
        const symbol = this.symbol(tag.tagName);
        const body = this.ix.componentOfTag(tag);
        if ((symbol && this.declared.has(symbol)) || (body && this.declaredBodies.has(body))) {
            return true;
        }
        if (body && !this.ix.isLibraryNode(body) && this.body(body, seen)) {
            return true;
        }
        const imported = this.importOf(tag.tagName);
        if (imported && this.known(imported.from, imported.name) && !this.reported.has(tag)) {
            this.reported.add(tag);
            this.error(this.ix.where(tag), `Portal host ${imported.name} from ${imported.from} needs a lookupPortals entry with its reason.`);
        }
        return false;
    }

    /** Whether the JSX or call ancestry from node to root crosses a resolved DOM relocation boundary. */
    between(node: ts.Node, root: ts.Node): boolean {
        for (let current: ts.Node | undefined = node; current; current = current.parent) {
            if (current === root || (T.isJsxElement(root) && current === root.openingElement)) {
                break;
            }
            const tag = T.isJsxElement(current) ? current.openingElement : current;
            if ((isJsxTag(tag) && !isIntrinsic(tag) && this.tag(tag)) || (T.isCallExpression(current) && this.isCreatePortal(current))) {
                return true;
            }
        }
        return false;
    }

    /** A direct ReactDOM portal call, resolved by its declaration or its import binding rather than the local name. */
    isCreatePortal(call: ts.CallExpression): boolean {
        const imported = this.importOf(call.expression);
        if (imported?.from === 'react-dom' && imported.name === 'createPortal') {
            return true;
        }
        const symbol = this.symbol(call.expression);
        return symbol?.getName() === 'createPortal' && Boolean(symbol.declarations?.some((declaration) => {
            if ((/[\\/]node_modules[\\/](?:@types[\\/])?react-dom[\\/]/).test(declaration.getSourceFile().fileName)) {
                return true;
            }
            return T.findAncestor(declaration, (node) => T.isModuleDeclaration(node) && T.isStringLiteral(node.name) && node.name.text === 'react-dom');
        }));
    }

    private body(body: CodeNode, seen: Set<CodeNode>): boolean {
        const cached = this.inferred.get(body);
        if (cached !== undefined) {
            return cached;
        }
        if (seen.has(body)) {
            return false;
        }
        const trail = new Set(seen).add(body);
        const render = T.isClassLike(body) ? body.members.find((member) => T.isMethodDeclaration(member) && member.name.getText() === 'render') : body;
        const outputs = render && isFunctionLike(render) ? returnsOf(render) : [];
        let witnessed = false;
        const relocates = (expression: ts.Expression): boolean => {
            const value = strip(expression) as ts.Expression;
            if (value.kind === T.SyntaxKind.NullKeyword || value.kind === T.SyntaxKind.FalseKeyword || (T.isIdentifier(value) && value.text === 'undefined')) {
                return true;
            }
            if (T.isCallExpression(value)) {
                const portal = this.isCreatePortal(value);
                witnessed ||= portal;
                return portal;
            }
            if (T.isConditionalExpression(value)) {
                return relocates(value.whenTrue) && relocates(value.whenFalse);
            }
            if (T.isBinaryExpression(value) && value.operatorToken.kind === T.SyntaxKind.AmpersandAmpersandToken) {
                return relocates(value.right);
            }
            if (T.isJsxElement(value) || T.isJsxSelfClosingElement(value)) {
                const tag = T.isJsxElement(value) ? value.openingElement : value;
                const portal = !isIntrinsic(tag) && this.tag(tag, trail);
                witnessed ||= portal;
                return portal;
            }
            return false;
        };
        const portal = outputs.length > 0 && outputs.every(relocates) && witnessed;
        if (!seen.size || portal) {
            this.inferred.set(body, portal);
        }
        return portal;
    }

    private unalias(symbol: ts.Symbol): ts.Symbol {
        return symbol.flags & T.SymbolFlags.Alias ? this.ix.checker.getAliasedSymbol(symbol) : symbol;
    }

    /** Follow immutable function/export aliases without treating reassigned variables as the same host. */
    private origin(expression: ts.Node): ts.Node {
        let node = strip(expression)!;
        const seen = new Set<ts.Symbol>();
        while (T.isIdentifier(node)) {
            const symbol = this.ix.checker.getSymbolAtLocation(node);
            const resolved = symbol && this.unalias(symbol);
            if (!resolved || seen.has(resolved)) {
                break;
            }
            seen.add(resolved);
            const declaration = resolved.valueDeclaration;
            if (!declaration || !T.isVariableDeclaration(declaration) || !declaration.initializer ||
                !T.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & T.NodeFlags.Const)) {
                break;
            }
            node = strip(declaration.initializer)!;
        }
        return node;
    }

    private symbol(input: ts.Node): ts.Symbol | undefined {
        const expression = this.origin(input);
        let name = expression;
        if (T.isPropertyAccessExpression(expression)) {
            name = expression.name;
        } else if (T.isElementAccessExpression(expression)) {
            name = expression.argumentExpression;
        }
        const symbol = this.ix.checker.getSymbolAtLocation(name);
        return symbol ? this.unalias(symbol) : undefined;
    }

    private importOf(input: ts.Node): {from: string; name: string} | undefined {
        const expression = this.origin(input);
        let property: string | undefined;
        let target = expression;
        if (T.isPropertyAccessExpression(expression)) {
            property = expression.name.text;
            target = expression.expression;
        } else if (T.isElementAccessExpression(expression) && T.isStringLiteral(expression.argumentExpression)) {
            property = expression.argumentExpression.text;
            target = expression.expression;
        }
        const symbol = this.ix.checker.getSymbolAtLocation(target);
        for (const declaration of symbol?.declarations ?? []) {
            const statement = T.findAncestor(declaration, T.isImportDeclaration);
            if (!statement || !T.isStringLiteral(statement.moduleSpecifier)) {
                continue;
            }
            if (T.isImportSpecifier(declaration)) {
                if (property) {
                    return undefined;
                }
                return {from: statement.moduleSpecifier.text, name: declaration.propertyName?.text ?? declaration.name.text};
            }
            if (T.isImportClause(declaration) || T.isNamespaceImport(declaration)) {
                return {from: statement.moduleSpecifier.text, name: property ?? 'default'};
            }
        }
        return undefined;
    }

    private known(from: string, name: string): boolean {
        return Object.entries(KNOWN_PORTALS).some(([module, names]) => (from === module && names.includes(name)) || names.some((exportName) => from === `${module}/${exportName}` && name === 'default'));
    }

    private error(at: string, message: string): void {
        this.diagnostics.push({rule: 'input', severity: 'error', at: at === this.config.configPath ? relativeToRoot(this.config, at) : at, message});
    }
}
