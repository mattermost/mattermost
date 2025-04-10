// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import type React from 'react';
import {useEffect} from 'react';

interface SchemaMap {
    [schemaName: string]: string[];
}

interface MonacoAutocompleteSuggestionProviderProps {
    schemas: SchemaMap;
}

const MonacoAutocompleteSuggestionProvider: React.FC<MonacoAutocompleteSuggestionProviderProps> = ({schemas}) => {
    useEffect(() => {
        // Create a custom language (only register once)
        if (
            !monaco.languages.
                getLanguages().
                some((lang) => lang.id === 'userTypeAutocomplete')
        ) {
            monaco.languages.register({id: 'userTypeAutocomplete'});
        }

        // Create a completion item provider with more robust matching
        const disposable = monaco.languages.registerCompletionItemProvider(
            'userTypeAutocomplete',
            {
                triggerCharacters: ['.'], // Trigger autocomplete on dot
                provideCompletionItems: (model, position) => {
                    // Get the text before the current position
                    const lineNumber = position.lineNumber;
                    const column = position.column;

                    const lineContent = model.getLineContent(lineNumber);
                    const textBeforePosition = lineContent.substring(0, column - 1);

                    // Create a default range for suggestions
                    const range = {
                        startLineNumber: lineNumber,
                        startColumn: column,
                        endLineNumber: lineNumber,
                        endColumn: column,
                    };

                    const secondarySuggestions = [];

                    // Check if the text matches any of our schema prefixes
                    for (const [schemaName, fields] of Object.entries(schemas)) {
                        if (textBeforePosition.trim().endsWith(schemaName + '.')) {
                            console.log(fields);

                            // Create completion items for the matched schema
                            const suggestions = fields.map((field) => ({
                                label: field,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: field,
                                range,
                            }));

                            console.log(suggestions);

                            return {suggestions};
                        } else if (
                            schemaName.startsWith(textBeforePosition.trim()) &&
                            !schemaName.includes('.')
                        ) {
                            secondarySuggestions.push({
                                label: schemaName,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: schemaName,
                                range,
                            });
                        }
                    }

                    return {suggestions: secondarySuggestions};
                },
            },
        );

        // Cleanup function
        return () => {
            // Cleanup logic (if needed)
            disposable.dispose(); // Properly dispose of the registration
        };
    }, [schemas]); // Add schemas to dependency array to re-run if schemas change

    return null; // This component doesn't render anything
};

export MonacoAutocompleteSuggestionProvider;
