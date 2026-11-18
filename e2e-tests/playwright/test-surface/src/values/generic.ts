// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import type {KeyClassifier} from './keys.ts';
import type {Gap, Value} from './types.ts';

import {isFunctionLike, shortText, typeText} from '../ast.ts';
import {MAX_OBJECT_KEYS_DEPTH} from '../limits.ts';
import {isCallUsage, usageAttrs, usageNode, type Loc, type ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** Infer key types separately for each concrete mount of a generic component. */
export class GenericInference {
    private readonly checker: ts.TypeChecker;
    private readonly ix: ProgramIndex;
    private readonly keys: KeyClassifier;

    constructor(ix: ProgramIndex, keys: KeyClassifier) {
        this.ix = ix;
        this.keys = keys;
        this.checker = ix.checker;
    }

    /** Match a source props type containing T against the checker-instantiated props at a JSX mount. */
    private inferParameter(source: ts.Type, actual: ts.Type, parameter: ts.Type, at: ts.Node, depth = 0, seen = new Map<ts.Type, Set<ts.Type>>()): ts.Type | null {
        if (source === parameter) {
            return actual;
        }
        if (depth > MAX_OBJECT_KEYS_DEPTH || seen.get(source)?.has(actual)) {
            return null;
        }
        const targets = seen.get(source) ?? new Set<ts.Type>();
        targets.add(actual);
        seen.set(source, targets);
        const argumentsOf = (type: ts.Type) => type.aliasTypeArguments ?? ((type.flags & typescript.TypeFlags.Object) && (type as ts.ObjectType).objectFlags & typescript.ObjectFlags.Reference ? this.checker.getTypeArguments(type as ts.TypeReference) : []);
        const sourceArguments = argumentsOf(source);
        const actualArguments = argumentsOf(actual);
        if (sourceArguments.length === actualArguments.length) {
            for (let index = 0; index < sourceArguments.length; index++) {
                const found = this.inferParameter(sourceArguments[index], actualArguments[index], parameter, at, depth + 1, seen);
                if (found) {
                    return found;
                }
            }
        }
        const sourceElement = this.checker.getIndexTypeOfType(source, typescript.IndexKind.Number);
        const actualElement = this.checker.getIndexTypeOfType(actual, typescript.IndexKind.Number);
        if (sourceElement && actualElement) {
            const found = this.inferParameter(sourceElement, actualElement, parameter, at, depth + 1, seen);
            if (found) {
                return found;
            }
        }
        for (const property of source.getProperties()) {
            const target = actual.getProperty(property.name);
            if (target) {
                const found = this.inferParameter(this.checker.getTypeOfSymbolAtLocation(property, at), this.checker.getTypeOfSymbolAtLocation(target, at), parameter, at, depth + 1, seen);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    /** Find each concrete instantiation of a component type parameter, following forwarding mounts. */
    private parameterMounts(parameter: ts.Type, seen = new Set<ts.Type>()): Array<{type: ts.Type; via: Loc[]}> {
        if (seen.has(parameter)) {
            return [];
        }
        const declaration = parameter.getSymbol()?.declarations?.find(typescript.isTypeParameterDeclaration);
        const component = declaration?.parent;
        if (!declaration || !component || (!isFunctionLike(component) && !typescript.isClassLike(component))) {
            return [];
        }
        const index = component.typeParameters?.indexOf(declaration) ?? -1;
        const symbol = component.name && this.checker.getSymbolAtLocation(component.name);
        const instance = symbol && typescript.isClassLike(component) ? this.checker.getDeclaredTypeOfSymbol(symbol) : null;
        const props = instance?.getProperty('props');
        let sourceProps: ts.Type | null = null;
        if (props) {
            sourceProps = this.checker.getTypeOfSymbolAtLocation(props, component);
        } else if (isFunctionLike(component) && component.parameters[0]) {
            sourceProps = this.checker.getTypeAtLocation(component.parameters[0]);
        }
        const out: Array<{type: ts.Type; via: Loc[]}> = [];
        for (const usage of this.ix.usages.get(component) ?? []) {
            const node = usageNode(usage);
            let actual: ts.Type | null = null;
            if (!isCallUsage(usage)) {
                const explicit = index >= 0 ? usage.typeArguments?.[index] : undefined;
                if (explicit) {
                    actual = this.checker.getTypeFromTypeNode(explicit);
                }
            }
            if (!actual && sourceProps) {
                for (const attribute of usageAttrs(usage)) {
                    const property = 'name' in attribute && sourceProps.getProperty(attribute.name);
                    if (property && 'name' in attribute && attribute.value) {
                        actual = this.inferParameter(this.checker.getTypeOfSymbolAtLocation(property, node), this.checker.getTypeAtLocation(attribute.value), parameter, node);
                        if (actual) {
                            break;
                        }
                    }
                }
            }
            if (!actual && sourceProps && !isCallUsage(usage)) {
                const signature = this.checker.getResolvedSignature(usage);
                const argument = signature?.parameters[0];
                if (argument) {
                    actual = this.inferParameter(sourceProps, this.checker.getTypeOfSymbolAtLocation(argument, node), parameter, node);
                }
            }
            if (actual) {
                const via = this.ix.where(node);
                if (actual.flags & typescript.TypeFlags.TypeParameter) {
                    const upstream = this.parameterMounts(actual, new Set([...seen, parameter]));
                    out.push(...(upstream.length ? upstream.map((mount) => ({type: mount.type, via: [via, ...mount.via]})) : [{type: actual, via: [via]}]));
                } else {
                    out.push({type: actual, via: [via]});
                }
            } else {
                out.push({type: parameter, via: [this.ix.where(node)]});
            }
        }
        return out;
    }

    /** Classify a generic field separately for each concrete mount’s instantiated type. */
    genericField(expression: ts.Expression): Value[] | null {
        if (!typescript.isPropertyAccessExpression(expression)) {
            return null;
        }
        const ownerType = this.checker.getNonNullableType(this.checker.getTypeAtLocation(expression.expression));
        const fieldType = this.checker.getNonNullableType(this.checker.getTypeAtLocation(expression));
        const fieldParameter = !(ownerType.flags & typescript.TypeFlags.TypeParameter) && Boolean(fieldType.flags & typescript.TypeFlags.TypeParameter);
        const parameter = fieldParameter ? fieldType : ownerType;
        if (!(parameter.flags & typescript.TypeFlags.TypeParameter)) {
            return null;
        }
        const field = expression.name.text;
        const mounts = this.parameterMounts(parameter);
        if (!mounts.length) {
            return null;
        }
        return mounts.map(({type, via}) => {
            const property = type.getProperty(field);
            let valueType = property ? this.checker.getTypeOfSymbolAtLocation(property, expression) : null;
            if (fieldParameter) {
                valueType = type;
            }
            const info: Gap = {kind: 'string', type: valueType ? typeText(this.checker, valueType) : 'unknown', expr: shortText(expression)};
            const origin = this.keys.classify(info, valueType, fieldParameter ? null : type, fieldParameter ? null : field);
            const allowed = origin.owner && origin.field ? this.keys.keyFieldEntry(origin.owner, origin.field, {withValue: true}) : undefined;
            if (allowed) {
                info.fieldEntry = allowed;
            }
            if (allowed && info.kind !== 'entity') {
                info.kind = 'id';
                info.entity = allowed.entity;
                info.field = origin.field!;
                info.value = allowed.value;
                info.freeForm = Boolean(allowed.freeForm);
                if (allowed.module) {
                    info.module = allowed.module;
                }
            }
            return {k: 'pat', parts: [{gap: info}], via};
        });
    }
}
