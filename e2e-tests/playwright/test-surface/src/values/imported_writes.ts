// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {strip} from '../ast.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

type Root = {symbol: ts.Symbol; path: string[]};
type Write = {path: string[]; expression?: ts.Expression; absent?: true};

/** Writes through aliases of module-owned objects must remain alternatives to their initializers. */
export class ImportedWrites {
    private readonly ix: ProgramIndex;
    private writes: Map<ts.Symbol, Write[]> | undefined;
    constructor(ix: ProgramIndex) {
        this.ix = ix;
    }

    private canonical(symbol: ts.Symbol | undefined): ts.Symbol | undefined {
        return symbol && (symbol.flags & typescript.SymbolFlags.Alias) ? this.ix.checker.getAliasedSymbol(symbol) : symbol;
    }

    private root(expression: ts.Expression, seen = new Set<ts.Node>()): Root | undefined {
        const node = strip(expression)!;
        if (seen.has(node)) {
            return undefined;
        }
        seen.add(node);
        if (typescript.isPropertyAccessExpression(node) || typescript.isElementAccessExpression(node)) {
            const base = this.root(node.expression, seen);
            let key = '*';
            if (typescript.isPropertyAccessExpression(node)) {
                key = node.name.text;
            } else if (node.argumentExpression && typescript.isStringLiteralLike(node.argumentExpression)) {
                key = node.argumentExpression.text;
            }
            if (base && (base.symbol.flags & typescript.SymbolFlags.ValueModule)) {
                const exported = this.canonical(this.ix.checker.getExportsOfModule(base.symbol).find((entry) => entry.name === key));
                return exported ? {symbol: exported, path: []} : undefined;
            }
            return base ? {symbol: base.symbol, path: [...base.path, key]} : undefined;
        }
        if (!typescript.isIdentifier(node)) {
            return undefined;
        }
        const symbol = this.canonical(this.ix.checker.getSymbolAtLocation(node));
        const declaration = symbol?.valueDeclaration;
        if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
            const init = strip(declaration.initializer)!;
            if (typescript.isIdentifier(init) || typescript.isPropertyAccessExpression(init) || typescript.isElementAccessExpression(init)) {
                return this.root(init, seen) ?? (symbol ? {symbol, path: []} : undefined);
            }
        }
        return symbol ? {symbol, path: []} : undefined;
    }

    private index(): Map<ts.Symbol, Write[]> {
        if (this.writes) {
            return this.writes;
        }
        const writes = new Map<ts.Symbol, Write[]>();
        this.writes = writes;
        const add = (target: ts.Expression, expression?: ts.Expression, absent?: true) => {
            const root = this.root(target);
            const declaration = root?.symbol.valueDeclaration;
            if (!root || !declaration || !typescript.isVariableDeclaration(declaration) || declaration.parent.parent.parent !== declaration.getSourceFile()) {
                return;
            }
            const list = writes.get(root.symbol) ?? [];
            list.push({path: root.path, expression, absent});
            writes.set(root.symbol, list);
        };
        const visit = (node: ts.Node) => {
            if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
                add(node.left, node.operatorToken.kind === typescript.SyntaxKind.EqualsToken ? node.right : undefined);
            } else if (typescript.isDeleteExpression(node)) {
                add(node.expression, undefined, true);
            } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
                add(node.operand);
            } else if (typescript.isCallExpression(node)) {
                const callee = strip(node.expression)!;
                const pure = new Set(['Object.keys', 'Object.values', 'Object.entries', 'Object.freeze', 'Object.isFrozen', 'JSON.stringify', 'Array.isArray', 'Array.from', 'String', 'Number', 'Boolean']);
                const pureName = callee.getText();
                const symbol = this.ix.checker.getSymbolAtLocation(typescript.isPropertyAccessExpression(callee) ? callee.name : callee);
                const builtin = symbol?.declarations?.every((declaration) => this.ix.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
                if (builtin && pure.has(pureName)) {
                    return;
                }
                const writers = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'set', 'delete', 'clear']);
                if (typescript.isPropertyAccessExpression(callee) && this.mutableObject(callee.expression)) {
                    const method = this.ix.checker.getResolvedSignature(node)?.getDeclaration();
                    let body = method && 'body' in method ? method.body as ts.Node | undefined : undefined;
                    const declaration = this.root(callee.expression)?.symbol.valueDeclaration;
                    const initializer = declaration && typescript.isVariableDeclaration(declaration) ? strip(declaration.initializer) : undefined;
                    if (!body && initializer && typescript.isObjectLiteralExpression(initializer)) {
                        const concrete = initializer.properties.find((property) => property.name?.getText() === callee.name.text);
                        if (concrete && typescript.isMethodDeclaration(concrete)) {
                            body = concrete.body;
                        }
                    }
                    if (writers.has(callee.name.text) || (body && this.writesThis(body))) {
                        add(callee.expression);
                    }
                }
                if (builtin && ['Object.assign', 'Object.defineProperty', 'Object.defineProperties', 'Reflect.set', 'Reflect.defineProperty'].includes(pureName) && node.arguments[0]) {
                    add(node.arguments[0]);
                }
                const candidates = [...node.arguments.entries()].filter(([, argument]) => this.mutableObject(argument));
                const declaration = candidates.length ? this.ix.checker.getResolvedSignature(node)?.getDeclaration() : undefined;
                const body = declaration && 'body' in declaration ? declaration.body as ts.Node | undefined : undefined;
                for (const [index, argument] of candidates) {
                    const parameter = declaration?.parameters[index];
                    if (!declaration || (parameter && !typescript.isIdentifier(parameter.name))) {
                        add(argument);
                        continue;
                    }
                    if (!parameter || !typescript.isIdentifier(parameter.name)) {
                        continue;
                    }
                    if (body) {
                        if (this.parameterWritten(body, this.ix.checker.getSymbolAtLocation(parameter.name))) {
                            add(argument);
                        }
                    } else {
                        const type = this.ix.checker.getTypeAtLocation(parameter);
                        if ((type.flags & typescript.TypeFlags.Object) && !this.readonlyType(type)) {
                            add(argument);
                        }
                    }
                }
            }
            typescript.forEachChild(node, visit);
        };
        this.ix.files.forEach(visit);
        return writes;
    }

    private readonlyType(type: ts.Type): boolean {
        if (type.aliasSymbol?.name === 'Readonly' || type.aliasSymbol?.name === 'ReadonlyArray' || this.ix.checker.typeToString(type).startsWith('readonly ')) {
            return true;
        }
        const properties = type.getProperties();
        return properties.length > 0 && properties.every((property) => property.declarations?.length && property.declarations.every((declaration) => {
            if (typescript.canHaveModifiers(declaration) && typescript.getModifiers(declaration)?.some((modifier) => modifier.kind === typescript.SyntaxKind.ReadonlyKeyword)) {
                return true;
            }
            for (let node: ts.Node | undefined = declaration; node; node = node.parent) {
                if (typescript.isAsExpression(node) && typescript.isTypeReferenceNode(node.type) && typescript.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const') {
                    return true;
                }
                if (typescript.isSourceFile(node) || typescript.isFunctionLike(node)) {
                    break;
                }
            }
            return false;
        }));
    }

    private mutableObject(expression: ts.Expression): boolean {
        const root = this.root(expression);
        const declaration = root?.symbol.valueDeclaration;
        if (!declaration || !typescript.isVariableDeclaration(declaration) || declaration.parent.parent.parent !== declaration.getSourceFile()) {
            return false;
        }
        const type = this.ix.checker.getTypeAtLocation(expression);
        return Boolean(type.flags & typescript.TypeFlags.Object) && !this.readonlyType(type);
    }

    /** Internal read-only consumers do not mutate arguments merely by receiving them. */
    private parameterWritten(body: ts.Node, parameter: ts.Symbol | undefined): boolean {
        if (!parameter) {
            return true;
        }
        let written = false;
        const matches = (expression: ts.Expression) => this.root(expression)?.symbol === parameter;
        const visit = (node: ts.Node) => {
            if (written) {
                return;
            }
            if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
                written = matches(node.left);
            } else if (typescript.isDeleteExpression(node)) {
                written = matches(node.expression);
            } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
                written = matches(node.operand);
            } else if (typescript.isCallExpression(node)) {
                const callee = strip(node.expression)!;
                written = (typescript.isPropertyAccessExpression(callee) && matches(callee.expression)) || node.arguments.some(matches);
            }
            typescript.forEachChild(node, visit);
        };
        visit(body);
        return written;
    }

    /** A method can write a mutable object through its receiver without naming the module binding. */
    private writesThis(body: ts.Node): boolean {
        let written = false;
        const targetsThis = (expression: ts.Expression) => {
            let node = strip(expression)!;
            while (typescript.isPropertyAccessExpression(node) || typescript.isElementAccessExpression(node)) {
                node = strip(node.expression)!;
            }
            return node.kind === typescript.SyntaxKind.ThisKeyword;
        };
        const visit = (node: ts.Node) => {
            if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
                written ||= targetsThis(node.left);
            } else if (typescript.isDeleteExpression(node)) {
                written ||= targetsThis(node.expression);
            } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
                written ||= targetsThis(node.operand);
            }
            typescript.forEachChild(node, visit);
        };
        visit(body);
        return written;
    }

    /** Only cross-module object reads use this conservative whole-program mutation summary. */
    alternatives(expression: ts.Expression): Write[] {
        const root = this.root(expression);
        const declaration = root?.symbol.valueDeclaration;
        if (!root?.path.length || !declaration || declaration.getSourceFile() === expression.getSourceFile()) {
            return [];
        }
        return (this.index().get(root.symbol) ?? []).filter((write) => {
            const common = Math.min(write.path.length, root.path.length);
            return write.path.slice(0, common).every((part, index) => part === '*' || root.path[index] === '*' || part === root.path[index]);
        }).map((write) => (write.path.length === root.path.length ? write : {path: root.path}));
    }
}
