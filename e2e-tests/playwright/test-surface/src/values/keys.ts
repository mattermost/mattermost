// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type ts from 'typescript';

import {KeyValues} from './key_values.ts';
import {namedTypeOf, stringLiteralsOf, symbolOf} from './type_utils.ts';
import type {Gap, Value} from './types.ts';

import {propName, shortText, strip, typeText} from '../ast.ts';
import {entityTypeModule, relativeToRoot, type KeyFieldAllow} from '../config.ts';
import {MAX_OBJECT_KEYS_DEPTH} from '../limits.ts';
import type {Diagnostic} from '../manifest_types.ts';
import {type ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** Classify typed key slots against entity declarations and configured identity contracts. */
export class KeyClassifier {
    private readonly checker: ts.TypeChecker;
    private readonly ix: ProgramIndex;
    private readonly keyValues: KeyValues;

    constructor(ix: ProgramIndex) {
        this.ix = ix;
        this.checker = ix.checker;
        this.keyValues = new KeyValues(ix);
        this.keyFieldDiagnostics.push(...this.keyValues.diagnostics);
        this.entityDirs = ix.config.entityTypeDirs.map((d) => (d.endsWith(path.sep) ? d : d + path.sep));
        this.indexKeyFields();
    }

    private readonly entityDirs: string[];

    private readonly keyFieldSymbols = new Map<KeyFieldAllow, Set<ts.Symbol>>();

    private readonly keyFieldsByOwner = new WeakMap<ts.Type, Map<string, KeyFieldAllow | null>>();
    private readonly annotationsByOwner = new WeakMap<ts.Type, Map<string, {owner: ts.Type; field: string} | null>>();

    readonly keyFieldDiagnostics: Diagnostic[] = [];

    /** Resolve exported library types through the program's imports; private app types remain file-qualified. */
    private indexKeyFields(): void {
        const imported = new Map<string, Set<ts.Symbol>>();
        for (const file of this.ix.program.getSourceFiles()) {
            for (const statement of file.statements) {
                if ((typescript.isImportDeclaration(statement) || typescript.isExportDeclaration(statement)) && statement.moduleSpecifier && typescript.isStringLiteral(statement.moduleSpecifier)) {
                    const symbol = this.checker.getSymbolAtLocation(statement.moduleSpecifier);
                    if (symbol && !statement.moduleSpecifier.text.startsWith('.') && !path.isAbsolute(statement.moduleSpecifier.text)) {
                        const modules = imported.get(statement.moduleSpecifier.text) ?? new Set<ts.Symbol>();
                        modules.add(symbol);
                        imported.set(statement.moduleSpecifier.text, modules);
                    }
                }
            }
        }
        for (const entry of this.ix.config.checks.keyFields.allow) {
            const symbols = new Set<ts.Symbol>();
            const add = (symbol: ts.Symbol) => {
                const resolved = symbol.flags & typescript.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
                if (this.checker.getDeclaredTypeOfSymbol(resolved).getProperty(entry.field)) {
                    symbols.add(resolved);
                }
            };
            let files: readonly ts.SourceFile[];
            let exported = false;
            if (entry.module) {
                // A config specifier resolves from the tsconfig directory; already-imported modules use the
                // program's own symbols, including package export conditions and nearest dependency versions.
                const resolved = typescript.resolveModuleName(entry.module, this.ix.config.tsconfig, this.ix.program.getCompilerOptions(), typescript.sys).resolvedModule?.resolvedFileName;
                const relative = entry.module.startsWith('.');
                const candidates = relative ? [resolved] : [resolved, ...['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '/index.d.ts'].map((suffix) => path.resolve(this.ix.config.root, entry.module! + suffix))];
                files = [...new Set(candidates.flatMap((file) => (file && this.ix.program.getSourceFile(file) ? [this.ix.program.getSourceFile(file)!] : [])))].slice(0, 1);
                const modules = new Set(relative ? [] : imported.get(entry.module));
                for (const file of files) {
                    const module = this.checker.getSymbolAtLocation(file);
                    if (module) {
                        modules.add(module);
                    }
                }
                for (const module of modules) {
                    const type = this.checker.getExportsOfModule(module).find((symbol) => symbol.getName() === entry.entity);
                    const resolved = type && (type.flags & typescript.SymbolFlags.Alias ? this.checker.getAliasedSymbol(type) : type);
                    if (resolved && (resolved.flags & typescript.SymbolFlags.Type)) {
                        exported = true;
                        add(resolved);
                    }
                }
            } else {
                files = this.ix.program.getSourceFiles().filter((file) => this.isEntityDecl(file));
            }
            if (!exported) {
                const visit = (node: ts.Node) => {
                    if ((typescript.isTypeAliasDeclaration(node) || typescript.isInterfaceDeclaration(node) || typescript.isClassDeclaration(node)) && node.name?.text === entry.entity) {
                        const symbol = this.checker.getSymbolAtLocation(node.name);
                        if (symbol) {
                            add(symbol);
                        }
                    }
                    typescript.forEachChild(node, visit);
                };
                files.forEach(visit);
            }
            this.keyFieldSymbols.set(entry, symbols);
            if (!symbols.size || (entry.module && symbols.size !== 1)) {
                this.keyFieldDiagnostics.push({rule: 'allow', severity: 'error', at: relativeToRoot(this.ix.config, this.ix.config.configPath), message: entry.module ? `Cannot resolve a unique ${entry.entity}.${entry.field} declaration in keyFields module ${entry.module}.` : `keyFields entry ${entry.entity}.${entry.field} needs module unless its type is a declared entity.`});
            }
        }
    }

    // ---- gaps: typed {key} slots --------------------------------------------------------

    /** Check whether a declaration belongs to a configured entity directory. */
    private isEntityDecl(decl: ts.Declaration | undefined): boolean {
        if (!decl) {
            return false;
        }
        const f = path.resolve(decl.getSourceFile().fileName);
        return this.entityDirs.some((d) => f.startsWith(d));
    }

    /**
     * The entity type a field belongs to: the owner itself (`Channel`), or else the named entity type
     * that declares the field (`FileInfo & UploadInfo` -> `FileInfo`).
     */
    private entityOwner(owner: ts.Type, field: string): {name: string; decl: ts.Declaration} | null {
        const os = owner.aliasSymbol ?? owner.getSymbol();
        const decl = os?.declarations?.[0];
        if (os && decl && this.isEntityDecl(decl)) {
            return {name: os.getName(), decl};
        }

        // declarations from local types (a multiselect's `Value`, an upload's progress) add no identity;
        // the entity types that declare it must agree (`Channel & UserProfile` is ambiguous)
        const decls = owner.getProperty(field)?.declarations ?? [];
        const entities = decls.map(namedTypeOf).filter((n): n is {name: string; decl: ts.Declaration} => Boolean(n && this.isEntityDecl(n.decl)));
        const first = entities[0];
        if (first && entities.every((n) => n.name === first.name && n.decl.getSourceFile() === first.decl.getSourceFile())) {
            return first;
        }
        return null;
    }

    /** Read only explicit entity field annotations, agreeing across every declaration and non-null union arm. */
    annotatedField(owner: ts.Type, field: string): {owner: ts.Type; field: string} | null {
        const cache = this.annotationsByOwner.get(owner) ?? new Map<string, {owner: ts.Type; field: string} | null>();
        this.annotationsByOwner.set(owner, cache);
        if (cache.has(field)) {
            return cache.get(field)!;
        }
        const property = owner.getProperty(field);
        const declarations = property ? this.checker.getRootSymbols(property).flatMap((symbol) => symbol.declarations ?? []) : [];
        const read = (node: ts.TypeNode): {owner: ts.Type; field: string; symbol: ts.Symbol} | null => {
            if (typescript.isParenthesizedTypeNode(node)) {
                return read(node.type);
            }
            if (typescript.isUnionTypeNode(node)) {
                const present = node.types.filter((member) => !(member.kind === typescript.SyntaxKind.UndefinedKeyword || (typescript.isLiteralTypeNode(member) && member.literal.kind === typescript.SyntaxKind.NullKeyword)));
                const origins = present.map(read);
                const first = origins[0];
                return first && origins.every((origin) => origin?.symbol === first.symbol && origin.field === first.field) ? first : null;
            }
            if (!typescript.isIndexedAccessTypeNode(node) || !typescript.isTypeReferenceNode(node.objectType) || node.objectType.typeArguments?.length ||
                !typescript.isLiteralTypeNode(node.indexType) || !typescript.isStringLiteral(node.indexType.literal)) {
                return null;
            }
            const referenced = this.checker.getSymbolAtLocation(node.objectType.typeName);
            const symbol = referenced && (referenced.flags & typescript.SymbolFlags.Alias ? this.checker.getAliasedSymbol(referenced) : referenced);
            if (!symbol?.declarations?.some((declaration) => this.isEntityDecl(declaration))) {
                return null;
            }
            const type = this.checker.getDeclaredTypeOfSymbol(symbol);
            const key = node.indexType.literal.text;
            return type.getProperty(key) && (key === 'id' || this.keyFieldEntry(type, key)) ? {owner: type, field: key, symbol} : null;
        };
        const origins = declarations.map((declaration) => ((typescript.isPropertySignature(declaration) || typescript.isPropertyDeclaration(declaration)) && declaration.type ? read(declaration.type) : null));
        const first = origins[0];
        const result = first && origins.every((origin) => origin?.symbol === first.symbol && origin.field === first.field) ? {owner: first.owner, field: first.field} : null;
        cache.set(field, result);
        return result;
    }

    /** Classify literal, numeric and entity-field origins without guessing from field spelling. */
    classify(info: Gap, t: ts.Type | null, owner: ts.Type | null, field: string | null): {owner: ts.Type | null; field: string | null} {
        const annotation = owner && field ? this.annotatedField(owner, field) : null;
        const originOwner = annotation?.owner ?? owner;
        const originField = annotation?.field ?? field;
        const members = t ? [t] : [];
        const present = t?.isUnion() ? t.types.filter((member) => !(member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Null))) : members;
        if (present.length && present.every((member) => Boolean(member.flags & typescript.TypeFlags.NumberLike))) {
            info.kind = 'number';
        }
        const lits = t ? stringLiteralsOf(t) : null;
        if (lits) {
            info.kind = 'set';
            info.values = lits;
        }
        const ent = originOwner && originField ? this.entityOwner(originOwner, originField) : null;
        if (ent && originField) {
            const {name, decl} = ent;
            info.kind = 'entity';
            info.entity = name;
            info.field = originField;
            info.entityIdentity = this.ix.where(decl);
            const file = path.resolve(decl.getSourceFile().fileName);
            const dir = this.entityDirs.find((d) => file.startsWith(d))!;
            info.module = entityTypeModule(this.ix.config, dir, file);
        }
        return {owner: originOwner, field: originField};
    }

    /** Describe the typed runtime key an expression supplies, including configured identity boundaries. */
    gapFor(e: ts.Expression): Value {
        const t = this.checker.getTypeAtLocation(e);
        const info: Gap = {kind: 'string', type: typeText(this.checker, t), expr: shortText(e)};
        let owner: ts.Type | null = null;
        let field: string | null = null;
        const fieldExpression = typescript.isElementAccessExpression(e) && (this.checker.getTypeAtLocation(e.argumentExpression).flags & typescript.TypeFlags.NumberLike) && this.checker.isArrayLikeType(this.checker.getTypeAtLocation(e.expression)) ? strip(e.expression) as ts.Expression : e;
        if (typescript.isPropertyAccessExpression(fieldExpression)) {
            owner = this.checker.getNonNullableType(this.checker.getTypeAtLocation(fieldExpression.expression));
            field = fieldExpression.name.text;
        } else {
            const declaration = this.fieldOf(fieldExpression);
            owner = declaration?.owner ?? null;
            field = declaration?.field ?? null;
        }
        const origin = this.classify(info, t, owner, field);
        this.configuredField(info, origin.owner, origin.field);
        if (typescript.isCallExpression(strip(e) as ts.Expression)) {
            const call = strip(e) as ts.CallExpression;
            const entry = this.keyValues.of(call);
            if (entry) {
                info.kind = 'id';
                info.value = entry.function.replace(/Key$/, '').toLowerCase();
                info.keyValueEntry = entry;
            }
        }
        return {k: 'pat', parts: [{gap: info}]};
    }

    /**
     * The names a keyFields entry may give a field's owner: the owner's own name, the members of an intersection it is,
     * and the types the property is declared on, followed through intersections and mapped types (Omit, Pick). An owner
     * that is a union matches only when every member does, through the same entry.
     */
    private ownerSymbols(owner: ts.Type, field: string, depth = 0): Set<ts.Symbol> {
        const names = new Set<ts.Symbol>();
        const add = (type: ts.Type) => {
            const symbol = type.aliasSymbol ?? type.getSymbol();
            const name = symbol?.getName();
            if (name && !name.startsWith('__')) {
                names.add(symbol!);
            }
        };
        add(owner);

        // a union answers directly only to its own name; what its members declare counts through every member (keyFieldEntry)
        if (owner.isUnion()) {
            return names;
        }
        if (owner.isIntersection()) {
            owner.types.forEach(add);
        }

        // a mapped alias over the owner (Readonly<State>, Partial<T>, Omit<T, …>): the owner is also the argument it maps,
        // never an ordinary generic's payload (Box<Base> is not a Base)
        if (depth < MAX_OBJECT_KEYS_DEPTH && this.isMappedAlias(owner)) {
            for (const argument of owner.aliasTypeArguments ?? []) {
                if ((argument.flags & typescript.TypeFlags.Object || argument.isIntersection()) && argument.getProperty(field)) {
                    this.ownerSymbols(argument, field, depth + 1).forEach((name) => names.add(name));
                }
            }
        }
        const seen = new Set<ts.Symbol>();
        const visit = (symbol: ts.Symbol) => {
            if (seen.has(symbol)) {
                return;
            }
            seen.add(symbol);
            for (const root of this.checker.getRootSymbols(symbol)) {
                if (root !== symbol) {
                    visit(root);
                }
                for (const declaration of root.declarations ?? []) {
                    for (let node: ts.Node | undefined = declaration.parent; node && !typescript.isSourceFile(node); node = node.parent) {
                        if (typescript.isTypeAliasDeclaration(node) || typescript.isInterfaceDeclaration(node) || typescript.isClassDeclaration(node)) {
                            if (node.name) {
                                const declared = this.checker.getSymbolAtLocation(node.name);
                                if (declared) {
                                    names.add(declared);
                                }
                            }
                            break;
                        }
                    }

                    // an unannotated class field's initializer (`state = {pluginSiteStats: {}}` in a
                    // `PureComponent<Props, State>`) overrides the base class's field: its object type is that field's
                    // type (`Readonly<State>`) too
                    const literal = declaration.parent;
                    const classField = literal && typescript.isObjectLiteralExpression(literal) && typescript.isPropertyDeclaration(literal.parent) && literal.parent.initializer === literal && !literal.parent.type ? literal.parent : undefined;
                    if (classField && depth < MAX_OBJECT_KEYS_DEPTH && typescript.isClassLike(classField.parent)) {
                        const instance = this.checker.getTypeAtLocation(classField.parent);
                        const fieldName = propName(classField.name);
                        const bases = instance.isClassOrInterface() ? this.checker.getBaseTypes(instance) : [];
                        for (const base of bases) {
                            const inherited = fieldName ? base.getProperty(fieldName) : undefined;
                            const type = inherited && this.checker.getTypeOfSymbolAtLocation(inherited, classField);
                            if (type) {
                                this.ownerSymbols(type, field, depth + 1).forEach((name) => names.add(name));
                            }
                        }
                    }
                }
            }
        };
        const property = owner.getProperty(field);
        if (property) {
            visit(property);
        }
        return names;
    }

    /** Whether a type is a mapped type, or an alias that resolves to one (Readonly, Partial, Pick, Omit = Pick<…>). */
    private isMappedAlias(type: ts.Type, depth = 0): boolean {
        if ((type.flags & typescript.TypeFlags.Object) && ((type as ts.ObjectType).objectFlags & typescript.ObjectFlags.Mapped)) {
            return true;
        }
        let node: ts.TypeNode | undefined = type.aliasSymbol?.declarations?.find(typescript.isTypeAliasDeclaration)?.type;
        for (let hop = depth; node && hop < MAX_OBJECT_KEYS_DEPTH; hop++) {
            if (typescript.isMappedTypeNode(node)) {
                return true;
            }
            if (!typescript.isTypeReferenceNode(node)) {
                return false;
            }
            const symbol = this.checker.getSymbolAtLocation(node.typeName);
            const target = symbol && (symbol.flags & typescript.SymbolFlags.Alias) ? this.checker.getAliasedSymbol(symbol) : symbol;
            node = target?.declarations?.find(typescript.isTypeAliasDeclaration)?.type;
        }
        return false;
    }

    /** The keyFields entry for an owner's field, or undefined (see `ownerNames`). */
    keyFieldEntry(owner: ts.Type, field: string, opts: {withValue?: boolean; keys?: boolean} = {}): KeyFieldAllow | undefined {
        const cacheKey = JSON.stringify([field, Boolean(opts.withValue), Boolean(opts.keys)]);
        const cache = this.keyFieldsByOwner.get(owner) ?? new Map<string, KeyFieldAllow | null>();
        this.keyFieldsByOwner.set(owner, cache);
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey) ?? undefined;
        }
        const remember = (entry: KeyFieldAllow | undefined) => {
            cache.set(cacheKey, entry ?? null);
            return entry;
        };

        // an entry with 'keys: true' declares the keys of a record field, never the field's own values
        const entries = this.ix.config.checks.keyFields.allow.filter((entry) => entry.field === field && Boolean(entry.keys) === Boolean(opts.keys) && (!opts.withValue || entry.value));
        if (!entries.length) {
            return remember(undefined);
        }
        const matches = (type: ts.Type, entry: KeyFieldAllow) => {
            const targets = this.keyFieldSymbols.get(entry);
            return Boolean(targets && [...this.ownerSymbols(type, field)].some((symbol) => targets.has(symbol)));
        };
        const direct = entries.find((entry) => matches(owner, entry));
        if (direct || !owner.isUnion()) {
            return remember(direct);
        }
        const members = owner.types.filter((member) => !(member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Null)));
        return remember(entries.find((entry) => members.length > 0 && members.every((member) => matches(member, entry))));
    }

    /** Apply the symbol-matched field contract while retaining an importable entity origin. */
    configuredField(info: Gap, owner: ts.Type | null, field: string | null): void {
        if (owner && field) {
            const allowed = this.keyFieldEntry(owner, field);
            if (allowed) {
                info.fieldEntry = allowed;
            }
            if (allowed && !(info.kind === 'entity' && info.module)) {
                info.kind = 'id';
                info.entity = allowed.entity;
                info.field = allowed.field;
                info.value = allowed.value ?? allowed.field;
                info.freeForm = Boolean(allowed.freeForm);
                if (allowed.module) {
                    info.module = allowed.module;
                }
            }
        }
    }

    /** The owner type and field an expression reads: `x.field`, or a name destructured from a typed parameter or value. */
    fieldOf(expr: ts.Expression): {owner: ts.Type; field: string} | null {
        const e = strip(expr) as ts.Expression;
        if (typescript.isPropertyAccessExpression(e)) {
            return {owner: this.checker.getNonNullableType(this.checker.getTypeAtLocation(e.expression)), field: e.name.text};
        }
        const declaration = typescript.isIdentifier(e) ? symbolOf(this.checker, e)?.valueDeclaration : undefined;
        if (declaration && typescript.isBindingElement(declaration) && typescript.isObjectBindingPattern(declaration.parent) && !declaration.dotDotDotToken) {
            const field = declaration.propertyName ? propName(declaration.propertyName) : propName(declaration.name);
            const holder = declaration.parent.parent;
            if (field && (typescript.isParameter(holder) || typescript.isVariableDeclaration(holder))) {
                return {owner: this.checker.getNonNullableType(this.checker.getTypeAtLocation(holder)), field};
            }
        }
        return null;
    }
}
