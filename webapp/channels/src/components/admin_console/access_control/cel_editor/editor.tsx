// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {MonacoLanguageProvider} from 'components/admin_console/access_control/cel_editor/language_provider';
import Markdown from 'components/markdown';

import TestResultsModal from '../test_modal/test_modal';

import './editor.scss';

export const POLICY_LANGUAGE = 'expressionLanguage';
const VALIDATE_POLICY_SYNTAX_COMMAND_ID = 'policyEditorValidateSyntaxCommand';

const MONACO_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
    extraEditorClassName: 'policyEditor',
    language: POLICY_LANGUAGE,
    automaticLayout: true,
    minimap: {enabled: false},
    lineNumbers: 'on',
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
    renderWhitespace: 'none',
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
}

// TODO: this is just a sample schema for the editor, we need to get the actual schema from the server
const schemas = {
    user: ['attributes', 'profile', 'program'],
    channel: ['attributes'],
    'user.attributes': ['clearance', 'level', 'role'],
    'user.profile': ['location', 'region', 'name', 'email'],
    'user.profile.location': ['country', 'city', 'zipcode'],
    'channel.attributes': ['required_level', 'restricted', 'visibility'],
};

const CELEditor: React.FC<CELEditorProps> = ({
    value,
    onChange,
    onValidate,
    placeholder = 'user.attributes.<attribute> == <value>',
    className = '',
}) => {
    const [expression, setExpression] = useState(value);
    const [isValidating, setIsValidating] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [cursorPosition, setCursorPosition] = useState({line: 1, column: 1});
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [statusBarColor, setStatusBarColor] = useState('var(--button-bg)'); // default color
    const [showTestResults, setShowTestResults] = useState(false);
    const [testResults, setTestResults] = useState<AccessControlTestResult | null>(null);

    const editorRef = useRef(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        setExpression(value);
    }, [value]);

    const handleChange = useCallback((newValue: string) => {
        setExpression(newValue);
        onChange(newValue);

        // Reset status bar color and validation state when user types
        setStatusBarColor('var(--button-bg)'); // back to blue
        setValidationErrors([]);
    }, [onChange]);

    const validateSyntax = useCallback(async () => {
        setIsValidating(true);

        try {
            const errors = await Client4.checkAccessControlExpression(expression);
            if (errors.length > 0) {
                setIsValid(false);
                setValidationErrors(errors.map((error) =>
                    `${error.message} @L${error.line}:${error.column + 1}`,
                ));
                setStatusBarColor('var(--error-text)'); // red for errors
                if (onValidate) {
                    onValidate(false);
                }
            } else {
                setIsValid(true);
                setValidationErrors([]);
                setStatusBarColor('var(--online-indicator)'); // green for success
                if (onValidate) {
                    onValidate(true);
                }
            }
        } catch (error) {
            setIsValid(false);
            setValidationErrors([error.detailed_error || 'Unknown error']);
            setStatusBarColor('var(--error-text)');
            if (onValidate) {
                onValidate(false);
            }
        } finally {
            setIsValidating(false);
        }
    }, [expression, onValidate]);

    const testAccessRule = useCallback(async () => {
        try {
            const result = await Client4.testAccessControlExpression(expression);
            setTestResults({
                attributes: result.attributes || {},
                users: result.users || [],
            });
            setShowTestResults(true);
        } catch (error) {
            console.error('Error testing access rule:', error);
        }
    }, [expression]);

    // initialize monaco editor
    useEffect(() => {
        if (!editorRef.current || monacoRef.current) {
            // returning no-op cleanup function to satisfy typescript
            // constraint of consistent return types. Since we're
            // returning a cleanup function at the end,
            // we also need to return a () => void function in every code path.
            return () => {};
        }

        monacoRef.current = monaco.editor.create(editorRef.current, MONACO_EDITOR_OPTIONS);

        monacoRef.current.getModel()?.onDidChangeContent(() => {
            const newValue = monacoRef.current?.getValue() || '';
            handleChange(newValue);
        });

        monacoRef.current.onDidChangeCursorPosition((e) => {
            setCursorPosition({line: e.position.lineNumber, column: e.position.column});
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
                data-status-color={statusBarColor}
            >
                {
                    !expression &&
                    <div
                        className='policy-editor-placeholder'
                        aria-label='CEL Expression Editor'
                    >
                        {placeholder}
                    </div>
                }

                <div
                    ref={editorRef}
                    className='cel-editor__input'
                />
                <div
                    className='cel-editor__status-bar'
                    style={{backgroundColor: statusBarColor}}
                >
                    <div className='cel-editor__status-message'>
                        {validationErrors.length > 0 ? (
                            <span className='cel-editor__error'>
                                <i
                                    className='icon icon-refresh'
                                    onClick={validateSyntax}
                                    role='button'
                                    aria-label='Retry validation'
                                />
                                {validationErrors[0]}
                            </span>
                        ) : isValid && statusBarColor === 'var(--online-indicator)' ? (
                            <span className='cel-editor__valid'>
                                <i className='icon icon-check'/>
                                {'Valid'}
                            </span>
                        ) : (
                            <button
                                className='cel-editor__inline-validate-btn'
                                onClick={validateSyntax}
                                disabled={isValidating}
                            >
                                {isValidating ? (
                                    <span className='cel-editor__loading'>
                                        <i className='fa fa-spinner fa-spin'/>
                                        <FormattedMessage
                                            id='admin.access_control.cel.validating'
                                            defaultMessage='Validating...'
                                        />
                                    </span>
                                ) : (
                                    <span className='cel-editor__loading'>
                                        <i className='icon icon-magnify'/>
                                        <FormattedMessage
                                            id='admin.access_control.cel.validateSyntax'
                                            defaultMessage='Validate syntax'
                                        />
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                    <div className='cel-editor__cursor-position'>
                        <FormattedMessage
                            id='admin.access_control.cel.line_and_column_number'
                            defaultMessage='L{lineNumber}:{columnNumber}'
                            values={{
                                lineNumber: cursorPosition.line,
                                columnNumber: cursorPosition.column,
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className='cel-editor__footer'>
                <button
                    className='cel-editor__test-btn'
                    onClick={testAccessRule}
                    disabled={!isValid || isValidating}
                >
                    <i className='icon icon-lock-outline'/>
                    <FormattedMessage
                        id='admin.access_control.cel.testAccessRule'
                        defaultMessage='Test access rule'
                    />
                </button>
            </div>

            <div className='cel-editor__help-text'>
                <Markdown
                    message={'Write rules like `user.<attribute> == <value>`. Use `&&` / `||` (and/or) for multiple conditions. Group conditions with `()`.'}
                    options={{mentionHighlight: false}}
                />
                <a
                    href='#'
                    className='cel-editor__learn-more'
                >
                    <FormattedMessage
                        id='admin.access_control.cel.learnMore'
                        defaultMessage='Learn more about creating access expressions with examples.'
                    />
                </a>
            </div>
            {showTestResults && (
                <TestResultsModal
                    testResults={testResults}
                    onExited={() => setShowTestResults(false)}
                    actions={{
                        openModal: () => {},
                        setModalSearchTerm: (term: string): ActionResult => ({data: term}),
                    }}
                />
            )}
        </div>
    );
};

export default CELEditor;
