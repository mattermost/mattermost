// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import './editor.scss';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {MonacoLanguageProvider} from 'components/admin_console/access_control/cel_editor/language_provider';
import Markdown from 'components/markdown';

import TestResultsModal from '../test_modal/test_modal';

import type {AccessControlTestResult} from '@mattermost/types/admin';

export const PolicyLanguage = 'expressionLanguage';

interface CELEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    placeholder?: string;
    className?: string;
}

const schemas = {

    // Root objects
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
    useEffect(() => {
        setExpression(value);
    }, [value]);

    const handleChange = (newValue: string) => {
        setExpression(newValue);
        onChange(newValue);

        // Reset status bar color and validation state when user types
        setStatusBarColor('var(--button-bg)'); // back to blue
        setValidationErrors([]);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        const value = target.value;
        const selectionStart = target.selectionStart;

        // Handle Alt/Option + Enter for validation
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            validateSyntax();
            return;
        }

        const textBeforeCursor = value.substring(0, selectionStart);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;

        setCursorPosition({line: currentLine, column: currentColumn});
    };

    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        const value = target.value;
        const selectionStart = target.selectionStart;

        const textBeforeCursor = value.substring(0, selectionStart);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;

        setCursorPosition({line: currentLine, column: currentColumn});
    };

    const validateSyntax = async () => {
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
    };

    const testAccessRule = async () => {
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
    };

    // return (
    //     <div className={`cel-editor ${className}`}>
    //         <div
    //             className="cel-editor__container"
    //             data-status-color={statusBarColor}
    //         >
    //             <textarea
    //                 className="cel-editor__input"
    //                 value={expression}
    //                 onChange={handleChange}
    //                 onKeyUp={handleKeyUp}
    //                 onClick={handleClick}
    //                 placeholder={placeholder}
    //                 aria-label="CEL Expression Editor"
    //             />
    //             <div
    //                 className="cel-editor__status-bar"
    //                 style={{ backgroundColor: statusBarColor }}
    //             >
    //                 <div className="cel-editor__status-message">
    //                     {validationErrors.length > 0 ? (
    //                         <span className="cel-editor__error">
    //                             <i
    //                                 className="icon icon-refresh"
    //                                 onClick={validateSyntax}
    //                                 role="button"
    //                                 aria-label="Retry validation"
    //                             />
    //                             {validationErrors[0]}
    //                         </span>
    //                     ) : isValid && statusBarColor === 'var(--online-indicator)' ? (
    //                         <span className="cel-editor__valid">
    //                             <i className="icon icon-check" />
    //                             Valid
    //                         </span>
    //                     ) : (
    //                         <button
    //                             className="cel-editor__inline-validate-btn"
    //                             onClick={validateSyntax}
    //                             disabled={isValidating}
    //                         >
    //                             {isValidating ? (
    //                                 <span className="cel-editor__loading">
    //                                     <i className="fa fa-spinner fa-spin" />
    //                                     <FormattedMessage
    //                                         id="admin.access_control.cel.validating"
    //                                         defaultMessage="Validating..."
    //                                     />
    //                                 </span>
    //                             ) : (
    //                                 <span className="cel-editor__loading">
    //                                 <i className="icon icon-magnify" />
    //                                 <FormattedMessage
    //                                     id="admin.access_control.cel.validateSyntax"
    //                                     defaultMessage="Validate syntax"
    //                                 />
    //                             </span>
    //                             )}
    //                         </button>
    //                     )}
    //                 </div>
    //                 <div className="cel-editor__cursor-position">
    //                     L{cursorPosition.line}:{cursorPosition.column}
    //                 </div>
    //             </div>
    //         </div>
    //
    //         <div className="cel-editor__footer">
    //             <button
    //                 className="cel-editor__test-btn"
    //                 onClick={testAccessRule}
    //                 disabled={!isValid || isValidating}
    //             >
    //                 <i className="icon icon-lock-outline" />
    //                 <FormattedMessage
    //                     id="admin.access_control.cel.testAccessRule"
    //                     defaultMessage="Test access rule"
    //                 />
    //             </button>
    //         </div>
    //
    //         <div className="cel-editor__help-text">
    //             <Markdown
    //                 message={"Write rules like `user.<attribute> == <value>`. Use `&&` / `||` (and/or) for multiple conditions. Group conditions with `()`."}
    //                 options={{mentionHighlight: false}}
    //             />
    //             <a href="#" className="cel-editor__learn-more">
    //                 <FormattedMessage
    //                     id="admin.access_control.cel.learnMore"
    //                     defaultMessage="Learn more about creating access expressions with examples."
    //                 />
    //             </a>
    //         </div>
    //         {showTestResults && (
    //             <TestResultsModal
    //                 testResults={testResults}
    //                 onExited={() => setShowTestResults(false)}
    //                 actions={{
    //                     openModal: () => {},
    //                     setModalSearchTerm: (term: string): ActionResult => ({data: term}),
    //                 }}
    //             />
    //         )}
    //     </div>
    // );

    const editorRef = useRef(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);

    useEffect(() => {
        if (!editorRef.current || monacoRef.current) {
            // returning no-op cleanup function to satisfy
            // the useEffect cleanup type definition
            return () => {};
        }

        monacoRef.current = monaco.editor.create(editorRef.current, {
            extraEditorClassName: 'policyEditor',
            language: PolicyLanguage,
            // theme: 'expressionTheme',
            automaticLayout: true,
            minimap: {enabled: false},
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            lineNumbersMinChars: 1,
            occurrencesHighlight: 'off',
        });

        // add on change event handler for monaco editor
        // monacoRef.current.onDidChangeModelContent(() => {
        //     const newValue = monacoRef.current?.getValue() || '';
        //     handleChange(newValue);
        // });

        // monacoRef.current.onDidChangeCursorPosition((e) => {
        //     console.log({column: e.position.column, lineNumber: e.position.lineNumber});
        // });

        // monaco.editor.addKeybindingRule({
        //     keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
        //     command: null,
        // });

        return () => {
            if (monacoRef.current) {
                monacoRef.current.dispose();
                monacoRef.current = null;
            }
        };
    }, [handleChange]);

    // return (
    //     <div className='flex flex-col'>
    //         <MonacoLanguageProvider schemas={schemas}/>
    //
    //         <div
    //             ref={editorRef}
    //             className="editor w-full h-96 border border-gray-300 rounded shadow-md"
    //         />
    //     </div>
    // );

    return (
        <div className={`cel-editor ${className}`}>
            <MonacoLanguageProvider schemas={schemas}/>

            <div
                className='cel-editor__container'
                data-status-color={statusBarColor}
            >
                {/*<textarea*/}
                {/*    className='cel-editor__input'*/}
                {/*    value={expression}*/}
                {/*    onChange={handleChange}*/}
                {/*    onKeyUp={handleKeyUp}*/}
                {/*    onClick={handleClick}*/}
                {/*    placeholder={placeholder}*/}
                {/*    aria-label='CEL Expression Editor'*/}
                {/*/>*/}
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
                                Valid
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
                        L{cursorPosition.line}:{cursorPosition.column}
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
