// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {strip} from '../ast.ts';
import {relativeToRoot, type KeyValue} from '../config.ts';
import type {Diagnostic} from '../manifest_types.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** Match canonical key helpers by declaration, including import and immutable forwarding aliases. */
export class KeyValues {
    private readonly ix: ProgramIndex;
    private readonly entries = new Map<ts.Symbol, KeyValue>();
    readonly diagnostics: Diagnostic[] = [];

    constructor(ix: ProgramIndex) {
        this.ix = ix;
        for (const entry of ix.config.keyValues) {
            const resolved = typescript.resolveModuleName(entry.module, ix.config.tsconfig, ix.program.getCompilerOptions(), typescript.sys).resolvedModule?.resolvedFileName;
            const relative = entry.module.startsWith('.');
            const paths = relative ? [resolved] : [resolved, ...['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '/index.d.ts'].map((suffix) => path.resolve(ix.config.root, entry.module + suffix))];
            const files = [...new Set(paths.flatMap((file) => (file && ix.program.getSourceFile(file) ? [ix.program.getSourceFile(file)!] : [])))].slice(0, 1);
            const modules = new Set<ts.Symbol>();
            for (const file of ix.program.getSourceFiles()) {
                for (const statement of file.statements) {
                    if (!relative && (typescript.isImportDeclaration(statement) || typescript.isExportDeclaration(statement)) && statement.moduleSpecifier && typescript.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === entry.module) {
                        const symbol = ix.checker.getSymbolAtLocation(statement.moduleSpecifier);
                        if (symbol) {
                            modules.add(symbol);
                        }
                    }
                }
            }
            files.forEach((file) => {
                const symbol = ix.checker.getSymbolAtLocation(file);
                if (symbol) {
                    modules.add(symbol);
                }
            });
            const targets = new Set<ts.Symbol>();
            const add = (symbol: ts.Symbol | undefined) => {
                const target = symbol && this.canonical(symbol);
                if (target && ix.checker.getTypeOfSymbolAtLocation(target, target.valueDeclaration ?? target.declarations![0]).getCallSignatures().length) {
                    targets.add(target);
                }
            };
            for (const module of modules) {
                add(ix.checker.getExportsOfModule(module).find((symbol) => symbol.getName() === entry.function));
            }
            if (!targets.size) {
                const visit = (node: ts.Node) => {
                    if ((typescript.isFunctionDeclaration(node) || typescript.isVariableDeclaration(node)) && node.name && typescript.isIdentifier(node.name) && node.name.text === entry.function) {
                        add(ix.checker.getSymbolAtLocation(node.name));
                    }
                    if (typescript.isSourceFile(node) || typescript.isVariableStatement(node) || typescript.isVariableDeclarationList(node)) {
                        typescript.forEachChild(node, visit);
                    }
                };
                files.forEach(visit);
            }
            if (targets.size === 1) {
                this.entries.set([...targets][0], entry);
            } else {
                this.diagnostics.push({rule: 'allow', severity: 'error', at: relativeToRoot(ix.config, ix.config.configPath), message: `Cannot resolve a unique keyValues function ${entry.function} in module ${entry.module}.`});
            }
        }
    }

    private canonical(symbol: ts.Symbol, seen = new Set<ts.Symbol>()): ts.Symbol | undefined {
        if (seen.has(symbol)) {
            return undefined;
        }
        seen.add(symbol);
        if (symbol.flags & typescript.SymbolFlags.Alias) {
            return this.canonical(this.ix.checker.getAliasedSymbol(symbol), seen);
        }
        const decl = symbol.valueDeclaration;
        if (decl && typescript.isVariableDeclaration(decl) && decl.initializer && typescript.isVariableDeclarationList(decl.parent) && (decl.parent.flags & typescript.NodeFlags.Const)) {
            const value = strip(decl.initializer) as ts.Expression;
            const target = (typescript.isIdentifier(value) || typescript.isPropertyAccessExpression(value)) && this.ix.checker.getSymbolAtLocation(value);
            if (target) {
                return this.canonical(target, seen);
            }
        }
        return symbol;
    }

    of(call: ts.CallExpression): KeyValue | undefined {
        const symbol = this.ix.checker.getSymbolAtLocation(call.expression);
        const target = symbol && this.canonical(symbol);
        return target ? this.entries.get(target) : undefined;
    }
}
