// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/access_control';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {Client4} from 'mattermost-redux/client';

import {MonacoLanguageProvider} from './language_provider';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import TestResultsModal from '../../modals/policy_test/test_modal';
import {TestButton, HelpText} from '../shared';

import './editor.scss';

export const POLICY_LANGUAGE = 'expressionLanguage';
const VALIDATE_POLICY_SYNTAX_COMMAND_ID = 'policyEditorValidateSyntaxCommand';

const MONACO_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
    extraEditorClassName: 'policyEditor',
    language: POLICY_LANGUAGE,
    automaticLayout: true,
    minimap: {enabled: false},
    lineNumbers: 'off',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    renderLineHighlight: 'none',
    lineNumbersMinChars: 1,
    occurrencesHighlight: 'off',
    stickyScroll: {enabled: false},
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    autoIndent: 'keep',
    autoSurround: 'never',
    codeLens: false,
    folding: false,
    fontFamily: 'monospace',
    hideCursorInOverviewRuler: true,
    fontSize: 12,
    guides: {indentation: false},
    links: true,
    matchBrackets: 'never',
    multiCursorLimit: 1,
    overviewRulerBorder: false,
    quickSuggestions: false,
    renderControlCharacters: false,
    scrollbar: {
        horizontal: 'hidden',
        useShadows: false,
    },
    selectionHighlight: false,
    showFoldingControls: 'never',
    suggestOnTriggerCharacters: true,
    unicodeHighlight: {
        ambiguousCharacters: false,
        invisibleCharacters: false,
    },
    unusualLineTerminators: 'auto',
    wordWrapColumn: 400,
    wrappingIndent: 'none',
    wrappingStrategy: 'advanced',
    contextmenu: false,
};

interface CELEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    placeholder?: string;
    className?: string;
    userAttributes: Array<{
        attribute: string;
        values: string[];
    }>;
}

// TODO: this is just a sample schema for the editor, we need to get the actual schema from the server

function CELEditor({
    value,
    onChange,
    onValidate,
    placeholder = 'user.attributes.<attribute> == <value>',
    className = '',
    userAttributes,
}: CELEditorProps): JSX.Element {
    const [editorState, setEditorState] = useState({
        expression: value,
        isValidating: false,
        isValid: true,
        cursorPosition: {line: 1, column: 1},
        validationErrors: [] as string[],
        statusBarColor: 'var(--button-bg)',
        showTestResults: false,
        testResults: null as AccessControlTestResult | null,
    });

    const schemas = {
        user: ['attributes'],
        'user.attributes': userAttributes.map((attr) => attr.attribute),
    };

    const editorRef = useRef(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        setEditorState((prev) => ({...prev, expression: value}));
    }, [value]);

    useEffect(() => {
        if (monacoRef.current && monacoRef.current.getValue() !== editorState.expression) {
            monacoRef.current.setValue(editorState.expression);
        }
    }, [editorState.expression]);

    const handleChange = useCallback((newValue: string) => {
        setEditorState((prev) => ({
            ...prev,
            expression: newValue,
            statusBarColor: 'var(--button-bg)',
            validationErrors: [],
        }));
        onChange(newValue);
    }, [onChange]);

    const validateSyntax = useCallback(async () => {
        setEditorState((prev) => ({...prev, isValidating: true}));

        try {
            const errors = await Client4.checkAccessControlExpression(editorState.expression);
            const isValid = errors.length === 0;
            setEditorState((prev) => ({
                ...prev,
                isValid,
                validationErrors: errors.map((error) => `${error.message} @L${error.line}:${error.column + 1}`),
                statusBarColor: isValid ? 'var(--online-indicator)' : 'var(--error-text)',
                isValidating: false,
            }));
            onValidate?.(isValid);
        } catch (error) {
            setEditorState((prev) => ({
                ...prev,
                isValid: false,
                validationErrors: [error.detailed_error || 'Unknown error'],
                statusBarColor: 'var(--error-text)',
                isValidating: false,
            }));
            onValidate?.(false);
        }
    }, [editorState.expression, onValidate]);

    // initialize monaco editor
    useEffect(() => {
        if (!editorRef.current || monacoRef.current) {
            return () => {};
        }

        monacoRef.current = monaco.editor.create(editorRef.current, MONACO_EDITOR_OPTIONS);

        // Set the initial value from the expression state
        monacoRef.current.setValue(editorState.expression);

        monacoRef.current.getModel()?.onDidChangeContent(() => {
            const newValue = monacoRef.current?.getValue() || '';
            handleChange(newValue);
        });

        monacoRef.current.onDidChangeCursorPosition((e) => {
            setEditorState((prev) => ({
                ...prev,
                cursorPosition: {line: e.position.lineNumber, column: e.position.column},
            }));
        });

        // To disable monaco's default behavior of opening the find and replace widget
        monaco.editor.addKeybindingRule({
            keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
            command: null,
        });

        monaco.editor.addCommand({
            id: VALIDATE_POLICY_SYNTAX_COMMAND_ID,
            run: validateSyntax,
        });

        monaco.editor.addKeybindingRule({
            keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Enter,
            command: VALIDATE_POLICY_SYNTAX_COMMAND_ID,
        });

        return () => {
            if (monacoRef.current) {
                monacoRef.current.dispose();
                monacoRef.current = null;
            }
        };
    }, []);

    return (
        <div className={`cel-editor ${className}`}>
            <MonacoLanguageProvider schemas={schemas}/>

            <div
                className='cel-editor__container'
                data-status-color={editorState.statusBarColor}
            >
                {!editorState.expression && (
                    <div
                        className='policy-editor-placeholder'
                        aria-label='CEL Expression Editor'
                    >
                        {placeholder}
                    </div>
                )}

                <div
                    ref={editorRef}
                    className='cel-editor__input'
                />
                <div
                    className='cel-editor__status-bar'
                    style={{backgroundColor: editorState.statusBarColor}}
                    onClick={() => {
                        if (!editorState.isValidating && editorState.validationErrors.length === 0 &&
                            !(editorState.isValid && editorState.statusBarColor === 'var(--online-indicator)')) {
                            validateSyntax();
                        }
                    }}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            if (!editorState.isValidating && editorState.validationErrors.length === 0 &&
                                !(editorState.isValid && editorState.statusBarColor === 'var(--online-indicator)')) {
                                validateSyntax();
                            }
                        }
                    }}
                    data-validation-state={
                        (() => {
                            if (editorState.isValidating) {
                                return 'validating';
                            }

                            if (editorState.validationErrors.length > 0) {
                                return 'error';
                            }

                            if (editorState.isValid && editorState.statusBarColor === 'var(--online-indicator)') {
                                return 'validated';
                            }

                            return 'unvalidated';
                        })()
                    }
                >
                    <div className='cel-editor__status-message'>
                        {(() => {
                            if (editorState.validationErrors.length > 0) {
                                return (
                                    <span className='cel-editor__error'>
                                        <i
                                            className='icon icon-refresh'
                                            onClick={validateSyntax}
                                            role='button'
                                            aria-label='Retry validation'
                                        />
                                        {editorState.validationErrors[0]}
                                    </span>
                                );
                            }

                            if (editorState.isValid && editorState.statusBarColor === 'var(--online-indicator)') {
                                return (
                                    <span className='cel-editor__valid'>
                                        <i className='icon icon-check'/>
                                        {'Valid'}
                                    </span>
                                );
                            }

                            return (
                                <button
                                    className='cel-editor__inline-validate-btn'
                                    onClick={validateSyntax}
                                    disabled={editorState.isValidating}
                                >
                                    <span className='cel-editor__loading'>
                                        {editorState.isValidating ? (
                                            <>
                                                <i className='fa fa-spinner fa-spin'/>
                                                <FormattedMessage
                                                    id='admin.access_control.cel.validating'
                                                    defaultMessage='Validating...'
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <i className='icon icon-magnify'/>
                                                <FormattedMessage
                                                    id='admin.access_control.cel.validateSyntax'
                                                    defaultMessage='Validate syntax'
                                                />
                                            </>
                                        )}
                                    </span>
                                </button>
                            );
                        })()}
                    </div>
                    <div className='cel-editor__cursor-position'>
                        <FormattedMessage
                            id='admin.access_control.cel.line_and_column_number'
                            defaultMessage='L{lineNumber}:{columnNumber}'
                            values={{
                                lineNumber: editorState.cursorPosition.line,
                                columnNumber: editorState.cursorPosition.column,
                            }}
                        />
                    </div>
                </div>
            </div>
            <div className='cel-editor__footer'>
                <div className='help-text-container'>
                    <div>
                        <HelpText
                            message={'Write rules like `user.<attribute> == <value>`. Use `&&` / `||` (and/or) for multiple conditions. Group conditions with `()`.'}
                            onLearnMoreClick={() => setShowHelpModal(true)}
                        />
                    </div>
                </div>
                <TestButton
                    onClick={() => setEditorState((prev) => ({...prev, showTestResults: true}))}
                    disabled={!editorState.isValid || editorState.isValidating}
                />
            </div>
            {editorState.showTestResults && (
                <TestResultsModal
                    onExited={() => setEditorState((prev) => ({...prev, showTestResults: false}))}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            return searchUsersForExpression(editorState.expression, term, after, limit);
                        },
                    }}
                />
            )}
            {showHelpModal && (
                <CELHelpModal
                    onExited={() => setShowHelpModal(false)}
                />
            )}
        </div>
    );
}

export default CELEditor;
