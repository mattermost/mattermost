// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/access_control';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {debounce} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import {MonacoLanguageProvider} from './language_provider';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import TestResultsModal from '../../modals/policy_test/test_modal';
import {TestButton, HelpText} from '../shared';

import './editor.scss';

export const POLICY_LANGUAGE = 'expressionLanguage';

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
    channelId?: string;
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
    channelId,
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
        isWaitingForValidation: false,
    });

    const schemas = {
        user: ['attributes'],
        'user.attributes': userAttributes.
            map((attr) => attr.attribute).
            filter((attr) => !attr.includes(' ') && attr.trim() !== ''),
    };

    const editorRef = useRef(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Store the handleChange callback in a ref to avoid recreating the editor
    const handleChangeRef = useRef<(value: string) => void>();

    // Store the validateSyntax callback in a ref to avoid recreating debounced function
    const validateSyntaxRef = useRef<(expression: string) => Promise<void>>();

    useEffect(() => {
        setEditorState((prev) => ({...prev, expression: value}));
    }, [value]);

    useEffect(() => {
        if (monacoRef.current && monacoRef.current.getValue() !== editorState.expression) {
            monacoRef.current.setValue(editorState.expression);
        }
    }, [editorState.expression]);

    const validateSyntax = useCallback(async (expression: string) => {
        // Skip validation if expression is empty
        if (!expression.trim()) {
            setEditorState((prev) => ({
                ...prev,
                isValid: true,
                validationErrors: [],
                statusBarColor: 'var(--button-bg)',
                isValidating: false,
                isWaitingForValidation: false,
            }));
            onValidate?.(true);
            return;
        }

        setEditorState((prev) => ({...prev, isValidating: true, isWaitingForValidation: false}));

        try {
            const errors = await Client4.checkAccessControlExpression(expression, channelId);
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
    }, [onValidate]);

    // Update the validateSyntax ref whenever it changes
    useEffect(() => {
        validateSyntaxRef.current = validateSyntax;
    }, [validateSyntax]);

    // Create a stable debounced version of validateSyntax
    const debouncedValidate = useMemo(
        () => debounce((expression: string) => {
            validateSyntaxRef.current?.(expression);
        }, 1000), // 1000ms delay for typical typing speed
        [], // Empty deps array ensures this is only created once
    );

    const handleChange = useCallback((newValue: string) => {
        setEditorState((prev) => ({
            ...prev,
            expression: newValue,
            statusBarColor: 'var(--button-bg)',
            validationErrors: [],
            isWaitingForValidation: true,
        }));
        onChange(newValue);

        // Trigger debounced validation
        debouncedValidate(newValue);
    }, [onChange, debouncedValidate]);

    // Update the ref whenever handleChange changes
    useEffect(() => {
        handleChangeRef.current = handleChange;
    }, [handleChange]);

    // Validate initial value on mount
    useEffect(() => {
        if (value.trim()) {
            validateSyntax(value);
        }
    }, []); // Only run on mount

    // initialize monaco editor
    useEffect(() => {
        if (!editorRef.current || monacoRef.current) {
            return undefined;
        }

        // Create the editor instance
        const editor = monaco.editor.create(editorRef.current, MONACO_EDITOR_OPTIONS);
        monacoRef.current = editor;

        // Set the initial value from the expression state
        editor.setValue(editorState.expression);

        // Set up event listeners
        const contentChangeDisposable = editor.getModel()?.onDidChangeContent(() => {
            const newValue = editor.getValue();

            // Use the ref to call the latest handleChange
            handleChangeRef.current?.(newValue);
        });

        const cursorChangeDisposable = editor.onDidChangeCursorPosition((e) => {
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

        // Cleanup function
        return () => {
            contentChangeDisposable?.dispose();
            cursorChangeDisposable?.dispose();
            editor.dispose();
            monacoRef.current = null;
        };
    }, []); // Only run once on mount

    // Helper function to determine current validation state
    const getValidationState = useCallback(() => {
        if (editorState.validationErrors.length > 0) {
            return 'error';
        }
        if (editorState.isValid && editorState.statusBarColor === 'var(--online-indicator)') {
            return 'validated';
        }
        if (editorState.isValidating) {
            return 'validating';
        }
        if (!editorState.expression.trim()) {
            return 'empty';
        }
        if (editorState.isWaitingForValidation) {
            return 'waiting';
        }
        return 'unvalidated';
    }, [editorState]);

    // Helper function to render status message based on state
    const renderStatusMessage = useCallback((state: string) => {
        switch (state) {
        case 'error':
            return (
                <span className='cel-editor__error'>
                    <i className='icon icon-alert-circle-outline'/>
                    {editorState.validationErrors[0]}
                </span>
            );
        case 'validated':
            return (
                <span className='cel-editor__valid'>
                    <i className='icon icon-check'/>
                    {'Valid'}
                </span>
            );
        case 'validating':
            return (
                <span className='cel-editor__loading'>
                    <i className='fa fa-spinner fa-spin'/>
                    <FormattedMessage
                        id='admin.access_control.cel.validating'
                        defaultMessage='Validating...'
                    />
                </span>
            );
        case 'empty':
            return (
                <span className='cel-editor__empty'>
                    <FormattedMessage
                        id='admin.access_control.cel.type_expression'
                        defaultMessage='Type an expression...'
                    />
                </span>
            );
        case 'waiting':
            return (
                <span className='cel-editor__waiting'>
                    <FormattedMessage
                        id='admin.access_control.cel.incomplete_expression'
                        defaultMessage='Incomplete expression, awaiting input...'
                    />
                </span>
            );
        default:
            return null;
        }
    }, [editorState.validationErrors]);

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
                    data-validation-state={getValidationState()}
                >
                    <div className='cel-editor__status-message'>
                        {renderStatusMessage(getValidationState())}
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
                    isStacked={true}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            return searchUsersForExpression(editorState.expression, term, after, limit, channelId);
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
