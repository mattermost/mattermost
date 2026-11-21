// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {compareStr} from './strings.mjs';
import {isFunctionLike, lineOf, parseSource, propName, readText, ts, unwrap} from './ts.mjs';

const EXTS = ['', '.ts', '.tsx', '.js', '.mjs'];

export function toPosix(p) {
    return p.split(path.sep).join('/');
}

export function walkFiles(dir, accept, out = []) {
    if (!fs.existsSync(dir)) {
        return out;
    }
    const entries = fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => compareStr(a.name, b.name));
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) {
            continue;
        }
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walkFiles(full, accept, out);
        } else if (accept(full)) {
            out.push(full);
        }
    }
    return out;
}

const isSource = (f) => /\.(ts|tsx|js|mjs)$/.test(f) && !/\.d\.ts$/.test(f);

function isConstLikeInit(init) {
    const n = unwrap(init);
    return (
        ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isTemplateExpression(n) ||
        ts.isObjectLiteralExpression(n) ||
        ts.isBinaryExpression(n)
    );
}

export class RepoIndex {
    constructor(root) {
        this.root = root;
        this.files = new Map();
        this.cypressCommands = new Map();
        this.libExports = new Map();
        this.classes = new Map();
        this.poCache = new Map();
        this.cypressRoot = path.join(root, 'e2e-tests/cypress/tests');
        this.pwLibRoot = path.join(root, 'e2e-tests/playwright/lib/src');
        this.built = false;
    }

    rel(abs) {
        return toPosix(path.relative(this.root, abs));
    }

    file(abs) {
        const rel = this.rel(abs);
        let info = this.files.get(rel);
        if (info) {
            return info;
        }
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            return null;
        }
        const text = readText(abs);
        const sf = parseSource(abs, text);
        info = {
            rel,
            abs,
            sf,
            text,
            imports: new Map(),
            namespaces: new Map(),
            functions: new Map(),
            consts: new Map(),
            reexports: [],
        };
        this.files.set(rel, info);
        this.scanFile(info);
        return info;
    }

    scanFile(info) {
        const {sf} = info;
        const visit = (node) => {
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                const spec = node.moduleSpecifier.text;
                const clause = node.importClause;
                if (clause?.name) {
                    info.imports.set(clause.name.text, {spec, imported: 'default'});
                }
                const nb = clause?.namedBindings;
                if (nb && ts.isNamedImports(nb)) {
                    for (const el of nb.elements) {
                        info.imports.set(el.name.text, {spec, imported: (el.propertyName ?? el.name).text});
                    }
                } else if (nb && ts.isNamespaceImport(nb)) {
                    info.namespaces.set(nb.name.text, spec);
                }
            } else if (
                ts.isExportDeclaration(node) &&
                node.moduleSpecifier &&
                ts.isStringLiteral(node.moduleSpecifier)
            ) {
                const names =
                    node.exportClause && ts.isNamedExports(node.exportClause)
                        ? new Map(
                              node.exportClause.elements.map((el) => [el.name.text, (el.propertyName ?? el.name).text]),
                          )
                        : null;
                info.reexports.push({spec: node.moduleSpecifier.text, names});
            } else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
                if (!info.functions.has(node.name.text)) {
                    info.functions.set(node.name.text, node);
                }
            } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
                const init = unwrap(node.initializer);
                if (isFunctionLike(init)) {
                    if (!info.functions.has(node.name.text)) {
                        info.functions.set(node.name.text, init);
                    }
                } else if (
                    ts.isCallExpression(init) &&
                    ts.isIdentifier(init.expression) &&
                    init.expression.text === 'require' &&
                    init.arguments[0] &&
                    ts.isStringLiteral(init.arguments[0])
                ) {
                    info.imports.set(node.name.text, {spec: init.arguments[0].text, imported: 'default'});
                } else if (
                    ts.isVariableDeclarationList(node.parent) &&
                    node.parent.flags & ts.NodeFlags.Const &&
                    isConstLikeInit(init)
                ) {
                    info.consts.set(node.name.text, init);
                }
            } else if (
                ts.isVariableDeclaration(node) &&
                ts.isObjectBindingPattern(node.name) &&
                node.initializer &&
                ts.isCallExpression(unwrap(node.initializer))
            ) {
                const call = unwrap(node.initializer);
                if (
                    ts.isIdentifier(call.expression) &&
                    call.expression.text === 'require' &&
                    call.arguments[0] &&
                    ts.isStringLiteral(call.arguments[0])
                ) {
                    for (const el of node.name.elements) {
                        if (ts.isIdentifier(el.name)) {
                            info.imports.set(el.name.text, {
                                spec: call.arguments[0].text,
                                imported:
                                    el.propertyName && ts.isIdentifier(el.propertyName)
                                        ? el.propertyName.text
                                        : el.name.text,
                            });
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }

    resolveModule(fromRel, spec) {
        const fromDir = path.dirname(path.join(this.root, fromRel));
        let base;
        if (spec.startsWith('.')) {
            base = path.resolve(fromDir, spec);
        } else if (spec.startsWith('@/')) {
            const inPwLib = fromRel.startsWith('e2e-tests/playwright/');
            base = path.join(inPwLib ? this.pwLibRoot : this.cypressRoot, spec.slice(2));
        } else {
            return null;
        }
        for (const ext of EXTS) {
            const cand = base + ext;
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                return cand;
            }
        }
        for (const ext of EXTS.slice(1)) {
            const cand = path.join(base, `index${ext}`);
            if (fs.existsSync(cand)) {
                return cand;
            }
        }
        return null;
    }

    build() {
        if (this.built) {
            return;
        }
        this.built = true;
        const cypressSupport = walkFiles(path.join(this.cypressRoot, 'support'), isSource);
        for (const abs of cypressSupport) {
            this.indexCypressCommands(this.file(abs));
        }
        const libFiles = walkFiles(this.pwLibRoot, isSource);
        const ambiguous = new Set();
        for (const abs of libFiles) {
            const info = this.file(abs);
            this.indexClasses(info);
            for (const [name, node] of info.functions) {
                if (!this.isExported(node)) {
                    continue;
                }
                if (this.libExports.has(name)) {
                    ambiguous.add(name);
                } else {
                    this.libExports.set(name, {file: info, node});
                }
            }
        }
        for (const name of ambiguous) {
            this.libExports.delete(name);
        }
    }

    functionByIdentifier(info, node) {
        return ts.isIdentifier(node) ? info.functions.get(node.text) : null;
    }

    isExported(node) {
        let stmt = node;
        while (stmt && !ts.isVariableStatement(stmt) && !ts.isFunctionDeclaration(stmt) && !ts.isSourceFile(stmt)) {
            stmt = stmt.parent;
        }
        if (!stmt || ts.isSourceFile(stmt)) {
            return false;
        }
        return (
            Boolean(ts.getCombinedModifierFlags?.(stmt) & ts.ModifierFlags.Export) ||
            stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        );
    }

    indexCypressCommands(info) {
        const visit = (node) => {
            if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isPropertyAccessExpression(node.expression.expression) &&
                node.expression.expression.name.text === 'Commands' &&
                ['add', 'overwrite'].includes(node.expression.name.text) &&
                node.arguments.length >= 2 &&
                ts.isStringLiteral(node.arguments[0])
            ) {
                const name = node.arguments[0].text;
                const fnArg = unwrap(node.arguments[node.arguments.length - 1]);
                const fn = isFunctionLike(fnArg) ? fnArg : this.functionByIdentifier(info, fnArg);
                if (fn && !this.cypressCommands.has(name)) {
                    this.cypressCommands.set(name, {
                        file: info,
                        node: fn,
                        overwrite: node.expression.name.text === 'overwrite',
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(info.sf);
    }

    indexClasses(info) {
        const visit = (node) => {
            if (ts.isClassDeclaration(node) && node.name) {
                const cls = this.buildClass(info, node);
                if (!this.classes.has(cls.name)) {
                    this.classes.set(cls.name, cls);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(info.sf);
    }

    buildClass(info, node) {
        const cls = {
            name: node.name.text,
            file: info,
            node,
            extends: undefined,
            ctor: {params: [], locals: new Map(), assigns: new Map()},
            fields: new Map(),
            getters: new Map(),
            methods: new Map(),
        };
        const heritage = node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
        if (heritage?.types[0] && ts.isIdentifier(heritage.types[0].expression)) {
            cls.extends = heritage.types[0].expression.text;
        }
        for (const m of node.members) {
            if (ts.isConstructorDeclaration(m) && m.body) {
                cls.ctor.params = m.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : ''));
                for (const p of m.parameters) {
                    if (ts.isIdentifier(p.name) && p.modifiers?.length) {
                        cls.ctor.assigns.set(p.name.text, p.name);
                    }
                }
                for (const st of m.body.statements) {
                    if (ts.isVariableStatement(st)) {
                        for (const d of st.declarationList.declarations) {
                            if (ts.isIdentifier(d.name) && d.initializer) {
                                cls.ctor.locals.set(d.name.text, d.initializer);
                            }
                        }
                    } else if (
                        ts.isExpressionStatement(st) &&
                        ts.isBinaryExpression(st.expression) &&
                        st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
                    ) {
                        const left = st.expression.left;
                        if (ts.isPropertyAccessExpression(left) && left.expression.kind === ts.SyntaxKind.ThisKeyword) {
                            cls.ctor.assigns.set(left.name.text, st.expression.right);
                        }
                    }
                }
            } else if (ts.isPropertyDeclaration(m)) {
                const name = propName(m.name);
                if (name) {
                    cls.fields.set(name, {init: m.initializer, typeNode: m.type});
                }
            } else if (ts.isGetAccessor(m) && m.body) {
                cls.getters.set(propName(m.name), m);
            } else if (ts.isMethodDeclaration(m) && m.body) {
                cls.methods.set(propName(m.name), m);
            }
        }
        return cls;
    }

    findMember(clsName, name, seen = new Set()) {
        const cls = this.classes.get(clsName);
        if (!cls || seen.has(clsName)) {
            return null;
        }
        seen.add(clsName);
        if (cls.methods.has(name)) {
            return {kind: 'method', cls, node: cls.methods.get(name)};
        }
        if (cls.getters.has(name)) {
            return {kind: 'getter', cls, node: cls.getters.get(name)};
        }
        if (cls.ctor.assigns.has(name)) {
            return {kind: 'assign', cls, node: cls.ctor.assigns.get(name)};
        }
        if (cls.fields.has(name)) {
            return {kind: 'field', cls, field: cls.fields.get(name)};
        }
        return cls.extends ? this.findMember(cls.extends, name, seen) : null;
    }

    findFunction(info, name, depth = 0) {
        if (depth > 5) {
            return null;
        }
        const fn = info.functions.get(name);
        if (fn) {
            return {fn, file: info};
        }
        const follow = (spec, exported) => {
            const abs = this.resolveModule(info.rel, spec);
            const target = abs && this.file(abs);
            return target ? this.findFunction(target, exported, depth + 1) : null;
        };
        const imp = info.imports.get(name);
        if (imp && (imp.spec.startsWith('.') || imp.spec.startsWith('@/'))) {
            const hit = follow(imp.spec, imp.imported === 'default' ? name : imp.imported);
            if (hit) {
                return hit;
            }
        }
        for (const r of info.reexports) {
            if (r.names === null || r.names.has(name)) {
                const hit = follow(r.spec, r.names?.get(name) ?? name);
                if (hit) {
                    return hit;
                }
            }
        }
        return null;
    }

    isExternalExport(info, name, depth = 0) {
        if (depth > 5) {
            return false;
        }
        const isLocal = (spec) => spec.startsWith('.') || spec.startsWith('@/');
        const imp = info.imports.get(name);
        if (imp && !isLocal(imp.spec)) {
            return true;
        }
        const follow = (spec, exported) => {
            const abs = this.resolveModule(info.rel, spec);
            const target = abs && this.file(abs);
            return target ? this.isExternalExport(target, exported, depth + 1) : false;
        };
        if (imp) {
            return follow(imp.spec, imp.imported === 'default' ? name : imp.imported);
        }
        for (const r of info.reexports) {
            if (r.names === null || r.names.has(name)) {
                if (!isLocal(r.spec) || follow(r.spec, r.names?.get(name) ?? name)) {
                    return true;
                }
            }
        }
        return false;
    }

    classForVar(varName) {
        const guess = varName.charAt(0).toUpperCase() + varName.slice(1);
        return this.classes.has(guess) ? guess : null;
    }

    locate(info, node) {
        return `${info.rel}:${lineOf(info.sf, node)}`;
    }
}
