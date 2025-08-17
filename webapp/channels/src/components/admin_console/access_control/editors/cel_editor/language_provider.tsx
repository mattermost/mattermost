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
}

export function MonacoLanguageProvider({schemas}: MonacoLanguageProviderProps) {
    useEffect(() => {
        // Register our custom expression language
        if (
            !monaco.languages.
                getLanguages().
                some((lang) => lang.id === POLICY_LANGUAGE_NAME)
        ) {
            monaco.languages.register({id: POLICY_LANGUAGE_NAME});

            // Define language tokenizer
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

        // Get properties from a schema path
        const getPropertiesFromPath = (path: string): string[] => {
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

        // Get allowed values for a property or path
        const getValuesForPath = (fullPath: string): string[] | null => {
            // Check if the path exists directly in schemas
            const directValue = schemas[fullPath];

            if (Array.isArray(directValue)) {
                return directValue;
            }

            // Otherwise, try to parse it as parent.property
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

                const propValue = schemaItem[property];

                if (Array.isArray(propValue)) {
                    return propValue;
                } else if (propValue === true) {
                    return null; // Property exists but no predefined values
                }
            }

            return null;
        };

        // Create a completion item provider for our language
        const disposable = monaco.languages.registerCompletionItemProvider(
            'expressionLanguage',
            {
                triggerCharacters: ['.', ' ', '"', "'", '='],
                provideCompletionItems: (model, position) => {
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

                        // Get values for this full path
                        const allowedValues = getValuesForPath(fullPath);

                        if (allowedValues && allowedValues.length > 0) {
                            // Create range that includes the characters already typed
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

                    // Check if we should suggest operators
                    // Pattern: an entity (word possibly with dots) followed by space
                    const operatorPattern = /(\w+(?:\.\w+)*)\s+$/;
                    const operatorMatch = textBeforePosition.match(operatorPattern);

                    if (operatorMatch) {
                        // We have an entity followed by space - suggest operators
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

                    // Check for dot completion (property access)
                    const dotMatch = textBeforePosition.match(/(\w+)(?:\.(\w+))*\.$/);
                    if (dotMatch) {
                        const fullPath = dotMatch[0].slice(0, -1); // Remove trailing dot

                        // Get properties for this path
                        const properties = getPropertiesFromPath(fullPath);

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

                    // When not after a dot or space, suggest root objects
                    const wordMatch = textBeforePosition.match(
                        /(?:^|\s+|[&|=!<>()]|\()(\w*)$/,
                    );
                    if (wordMatch) {
                        const word = wordMatch[1] || '';
                        const wordStartColumn = column - word.length;

                        // Filter schemas that are root objects (don't contain dots)
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

        // Cleanup function
        return () => {
            disposable.dispose();
        };
    }, [schemas]);

    return null; // This component doesn't render anything
}
