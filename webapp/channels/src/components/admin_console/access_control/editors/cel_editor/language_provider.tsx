// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import {useEffect} from 'react';

const POLICY_LANGUAGE_NAME = 'expressionLanguage';

// Enhanced schema interface to support different types of values
interface SchemaValue {
    [key: string]: string[] | boolean | SchemaValue;
}

interface SchemaMap {
    [schemaName: string]: string[] | SchemaValue | boolean;
}

interface MonacoLanguageProviderProps {
    schemas: SchemaMap;

    // Monaco model owned by this editor instance. Required so the
    // module-level completion provider can pick the right schemas when
    // multiple CELEditors are mounted concurrently (e.g., the Post
    // Policies tab renders one editor per rule card).
    model: monaco.editor.ITextModel | null;
}

// Module-level state — see `ensureLanguageRegistered` for the why.
//
// SCHEMAS_BY_MODEL maps a Monaco model URI string to that model's current
// schemas. Each MonacoLanguageProvider instance is responsible for
// inserting / removing its own entry as its host editor mounts / unmounts.
// The completion provider is registered exactly ONCE per module load and
// looks up schemas from this map at invocation time.
const SCHEMAS_BY_MODEL = new Map<string, SchemaMap>();
let languageRegistered = false;

// ensureLanguageRegistered is idempotent: it registers the `expressionLanguage`
// language id, its Monarch tokenizer, and a single completion item provider.
//
// WHY MODULE-LEVEL: `monaco.languages.registerCompletionItemProvider` is
// scoped by language id, not by editor. Registering it from inside the
// component's useEffect adds a NEW provider on every mount — Monaco
// invokes all registered providers and concatenates their suggestions,
// so with N editors visible the user sees N copies of "post", N copies
// of "user", etc. Registering exactly once eliminates the duplicates.
function ensureLanguageRegistered() {
    if (languageRegistered) {
        return;
    }
    languageRegistered = true;

    if (!monaco.languages.getLanguages().some((lang) => lang.id === POLICY_LANGUAGE_NAME)) {
        monaco.languages.register({id: POLICY_LANGUAGE_NAME});

        monaco.languages.setMonarchTokensProvider(POLICY_LANGUAGE_NAME, {
            tokenizer: {
                root: [

                    // Comments
                    [/\/\/.*$/, 'comment'],

                    // Object and property paths
                    [/[a-zA-Z][\w$]*(?=\.)/, 'variable'],
                    [/\./, 'delimiter'],
                    [/[a-zA-Z][\w$]*/, 'property'],

                    // Operators
                    [/&&|\|\||==|!=/, 'operator'],

                    // Whitespace
                    [/[ \t\r\n]+/, 'white'],

                    // Parentheses
                    [/[()]/, '@brackets'],

                    // String literals
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/"/, {token: 'string.quote', bracket: '@open', next: '@string'}],
                    [/'([^'\\]|\\.)*$/, 'string.invalid'],
                    [
                        /'/,
                        {token: 'string.quote', bracket: '@open', next: '@string2'},
                    ],

                    // Numbers
                    [/\d+/, 'number'],
                ],
                string: [
                    [/[^\\"]+/, 'string'],
                    [/"/, {token: 'string.quote', bracket: '@close', next: '@pop'}],
                ],
                string2: [
                    [/[^'\\]+/, 'string'],
                    [/'/, {token: 'string.quote', bracket: '@close', next: '@pop'}],
                ],
            },
        });
    }

    // Get properties from a schema path. Returns leaf names for dot
    // completion; for object-shaped schema items, the keys of the object
    // are the property names.
    const getPropertiesFromPath = (schemas: SchemaMap, path: string): string[] => {
        const schemaItem = schemas[path];

        if (!schemaItem) {
            return [];
        }

        if (Array.isArray(schemaItem)) {
            return schemaItem;
        } else if (typeof schemaItem === 'object') {
            return Object.keys(schemaItem);
        }

        return [];
    };

    // Get allowed values for a property at a fully-qualified path.
    const getValuesForPath = (schemas: SchemaMap, fullPath: string): string[] | null => {
        const directValue = schemas[fullPath];

        if (Array.isArray(directValue)) {
            return directValue;
        }

        const pathParts = fullPath.split('.');

        if (pathParts.length >= 2) {
            const property = pathParts.pop();
            if (!property) {
                return null;
            }
            const parentPath = pathParts.join('.');

            const schemaItem = schemas[parentPath];

            if (!schemaItem || Array.isArray(schemaItem) || typeof schemaItem === 'boolean') {
                return null;
            }

            const propValue = (schemaItem as SchemaValue)[property];

            if (Array.isArray(propValue)) {
                return propValue;
            } else if (propValue === true) {
                return null; // Property exists but no predefined values
            }
        }

        return null;
    };

    monaco.languages.registerCompletionItemProvider(
        POLICY_LANGUAGE_NAME,
        {
            triggerCharacters: ['.', ' ', '"', "'", '='],
            provideCompletionItems: (model, position) => {
                // Pick this model's schemas at completion time. If the
                // model isn't registered (e.g., the provider unmounted
                // mid-flight), bail with no suggestions rather than
                // returning a stale set from a different editor.
                const schemas = SCHEMAS_BY_MODEL.get(model.uri.toString());
                if (!schemas) {
                    return {suggestions: []};
                }

                const lineNumber = position.lineNumber;
                const column = position.column;
                const lineContent = model.getLineContent(lineNumber);
                const textBeforePosition = lineContent.substring(0, column - 1);

                // Check if we're after an operator that expects a value
                // Pattern: path followed by an operator that expects a value
                const valueOperatorPattern =
                    /(\w+(?:\.\w+)*)\s+(==|!=|>|<|>=|<=)\s+["']?(\w*)$/;
                const valueMatch = textBeforePosition.match(valueOperatorPattern);

                if (valueMatch) {
                    const [, fullPath, , currentValue] = valueMatch;

                    const allowedValues = getValuesForPath(schemas, fullPath);

                    if (allowedValues && allowedValues.length > 0) {
                        const wordStartColumn = column - currentValue.length;

                        return {
                            suggestions: allowedValues.
                                filter((val) =>
                                    val.
                                        toString().
                                        toLowerCase().
                                        startsWith(currentValue.toLowerCase()),
                                ).
                                map((val) => ({
                                    label: val.toString(),
                                    kind: monaco.languages.CompletionItemKind.Value,
                                    insertText: `"${val}"`,
                                    range: {
                                        startLineNumber: lineNumber,
                                        startColumn: wordStartColumn,
                                        endLineNumber: lineNumber,
                                        endColumn: column,
                                    },
                                })),
                        };
                    }
                }

                // Operator suggestion: entity (word possibly with dots) followed by space
                const operatorPattern = /(\w+(?:\.\w+)*)\s+$/;
                const operatorMatch = textBeforePosition.match(operatorPattern);

                if (operatorMatch) {
                    const operators = ['&&', '||', '==', '!=', 'in'];

                    return {
                        suggestions: operators.map((op) => ({
                            label: op,
                            kind: monaco.languages.CompletionItemKind.Operator,
                            insertText: op + ' ',
                            range: {
                                startLineNumber: lineNumber,
                                startColumn: column,
                                endLineNumber: lineNumber,
                                endColumn: column,
                            },
                        })),
                    };
                }

                // Dot completion (property access)
                const dotMatch = textBeforePosition.match(/(\w+)(?:\.(\w+))*\.$/);
                if (dotMatch) {
                    const fullPath = dotMatch[0].slice(0, -1);

                    const properties = getPropertiesFromPath(schemas, fullPath);

                    if (properties.length > 0) {
                        return {
                            suggestions: properties.map((field) => ({
                                label: field,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: field,
                                range: {
                                    startLineNumber: lineNumber,
                                    startColumn: column,
                                    endLineNumber: lineNumber,
                                    endColumn: column,
                                },
                            })),
                        };
                    }
                }

                // Root objects when not after a dot or space.
                const wordMatch = textBeforePosition.match(
                    /(?:^|\s+|[&|=!<>()]|\()(\w*)$/,
                );
                if (wordMatch) {
                    const word = wordMatch[1] || '';
                    const wordStartColumn = column - word.length;

                    const rootSchemas = Object.keys(schemas).filter(
                        (key) => !key.includes('.'),
                    );

                    const suggestions = rootSchemas.
                        filter((schema) =>
                            schema.toLowerCase().startsWith(word.toLowerCase()),
                        ).
                        map((schema) => ({
                            label: schema,
                            kind: monaco.languages.CompletionItemKind.Class,
                            insertText: schema,
                            range: {
                                startLineNumber: lineNumber,
                                startColumn: wordStartColumn,
                                endLineNumber: lineNumber,
                                endColumn: column,
                            },
                        }));

                    return {suggestions};
                }

                return {suggestions: []};
            },
        },
    );
}

export function MonacoLanguageProvider({schemas, model}: MonacoLanguageProviderProps) {
    // Ensure the single global provider is registered. Idempotent —
    // first caller pays the cost, the rest are no-ops.
    ensureLanguageRegistered();

    useEffect(() => {
        if (!model) {
            return undefined;
        }
        const key = model.uri.toString();
        SCHEMAS_BY_MODEL.set(key, schemas);
        return () => {
            // Only remove if this is still our entry — a fast remount
            // could otherwise delete a fresh entry written by the next
            // generation of the same provider.
            if (SCHEMAS_BY_MODEL.get(key) === schemas) {
                SCHEMAS_BY_MODEL.delete(key);
            }
        };
    }, [schemas, model]);

    return null; // This component doesn't render anything
}
