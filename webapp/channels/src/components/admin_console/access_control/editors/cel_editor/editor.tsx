// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as monaco from 'monaco-editor';
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlTestResult, CELExpressionError} from '@mattermost/types/access_control';
import {SESSION_ATTRIBUTES_OBJECT_TYPE, USER_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {debounce} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

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
    fixedOverflowWidgets: true,
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

type CELUserAttribute = {
    attribute: string;
    values: string[];

    // 'session' marks a user.session.* attribute; 'user' marks a user.* /
    // user.attributes.* attribute. Always populated by toCELEditorAttributes.
    objectType?: string;

    // Native user attributes (e.g. user.email) complete directly off `user.`
    // rather than under `user.attributes.`.
    isNative?: boolean;
};

// Builds the Monaco autocomplete schema. CPA/user attributes are offered under
// user.attributes.*; enabled session attributes (objectType 'session') are
// offered under user.session.* — the session bucket only appears when present.
// Native attributes (isNative) complete directly off user.* (e.g. user.email).
export function buildCELSchemas(userAttributes: CELUserAttribute[]): Record<string, string[]> {
    const cleanNames = (attrs: CELUserAttribute[]) => attrs.
        map((attr) => attr.attribute).
        filter((name) => !name.includes(' ') && name.trim() !== '');
    const sessionAttrNames = cleanNames(userAttributes.filter((attr) => attr.objectType === SESSION_ATTRIBUTES_OBJECT_TYPE));
    const userAttrs = userAttributes.filter((attr) => !attr.objectType || attr.objectType === USER_OBJECT_TYPE);
    const nativeNames = cleanNames(userAttrs.filter((attr) => attr.isNative));
    const cpaNames = cleanNames(userAttrs.filter((attr) => !attr.isNative));

    const schemas: Record<string, string[]> = {
        user: ['attributes', ...(sessionAttrNames.length ? ['session'] : []), ...nativeNames],
        'user.attributes': cpaNames,
        ...(sessionAttrNames.length ? {'user.session': sessionAttrNames} : {}),
    };

    // createat exposes the youngerThanDays member helper.
    if (nativeNames.includes('createat')) {
        schemas['user.createat'] = ['youngerThanDays'];
    }

    return schemas;
}

/** Optional overrides for the editor's network calls, used by plugins consuming window.Components.AccessControlCELEditor. */
export interface CELEditorActions {

    /** Overrides Client4.checkAccessControlExpression. */
    checkExpression?: (expression: string) => Promise<CELExpressionError[]>;

    /** Overrides the searchUsersForExpression thunk backing the built-in TestResultsModal. */
    searchUsers?: (expression: string, term: string, after: string, limit: number) => Promise<ActionResult<AccessControlTestResult>>;
}

export interface CELEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    placeholder?: string;
    className?: string;
    channelId?: string;
    teamId?: string;
    disabled?: boolean;
    userAttributes: CELUserAttribute[];

    /**
     * When provided, the built-in expression-only TestResultsModal is
     * suppressed and the test button forwards its click to the parent.
     * The parent is responsible for rendering its own results modal —
     * used by the permission-rule editor so its dual-lane simulation
     * modal (SimulateAccessModal) can replace the legacy
     * membership-only one without changing the button's layout.
     */
    onTestClick?: () => void;

    /** Optional label override for the test button. Lets the
     *  permission-rule editor render "Simulate rules" instead of the
     *  default "Test access rule" copy. */
    testButtonLabel?: React.ReactNode;
    hasMaskedRows?: boolean;
    actions?: CELEditorActions;
}

// TODO: this is just a sample schema for the editor, we need to get the actual schema from the server

function CELEditor({
    value,
    onChange,
    onValidate,
    placeholder = 'user.attributes.<attribute> == <value>',
    className = '',
    channelId,
    teamId,
    disabled = false,
    userAttributes,
    onTestClick,
    testButtonLabel,
    hasMaskedRows = false,
    actions,
}: CELEditorProps): JSX.Element {
    const intl = useIntl();
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

    const schemas = buildCELSchemas(userAttributes);

    const injectedCheckExpression = actions?.checkExpression;

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
            let errors: CELExpressionError[];
            if (injectedCheckExpression) {
                errors = await injectedCheckExpression(expression);
            } else {
                errors = await Client4.checkAccessControlExpression(expression, channelId, teamId);
            }
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
    }, [onValidate, injectedCheckExpression, channelId, teamId]);

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

    // Update the editor's readOnly state when disabled or hasMaskedRows changes
    useEffect(() => {
        if (monacoRef.current) {
            monacoRef.current.updateOptions({readOnly: disabled || hasMaskedRows});
        }
    }, [disabled, hasMaskedRows]);

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

            {hasMaskedRows && (
                <div
                    className='cel-editor__masked-banner'
                    role='alert'
                >
                    <i className='icon icon-alert-outline'/>
                    <FormattedMessage
                        id='admin.access_control.cel.masked_values_banner'
                        defaultMessage='This expression contains restricted values. Switch to Simple mode to edit the values you have access to.'
                    />
                </div>
            )}

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
                            message={intl.formatMessage({
                                id: 'admin.access_control.cel.help_text',
                                defaultMessage: 'Write rules like `user.attributes.{lessThan}attribute{greaterThan} == {lessSign}value{greaterSign}`. Use `&&` / `||` (and/or) for multiple conditions. Group conditions with `()`.',
                            }, {
                                lessThan: '<',
                                greaterThan: '>',
                                lessSign: '<',
                                greaterSign: '>',
                            })}
                            onLearnMoreClick={() => setShowHelpModal(true)}
                        />
                    </div>
                </div>
                <TestButton
                    onClick={onTestClick ?? (() => setEditorState((prev) => ({...prev, showTestResults: true})))}
                    label={testButtonLabel}
                    disabled={disabled || hasMaskedRows || !editorState.expression || !editorState.isValid || editorState.isValidating}
                    disabledTooltip={
                        hasMaskedRows ?
                            intl.formatMessage({
                                id: 'admin.access_control.cel_editor.masked_values_tooltip',
                                defaultMessage: 'Test is unavailable because this policy contains restricted attribute values.',
                            }) :
                            undefined
                    }
                />
            </div>
            {/* Built-in expression-only modal. Suppressed when the
              * parent provided an `onTestClick` override (used by the
              * permission-rule editor, which renders its own dual-lane
              * SimulateAccessModal). */}
            {!onTestClick && editorState.showTestResults && (
                <TestResultsModal
                    onExited={() => setEditorState((prev) => ({...prev, showTestResults: false}))}
                    isStacked={true}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            if (actions?.searchUsers) {
                                // Wrap in a thunk so TestResultsModal can dispatch it unchanged.
                                const search = actions.searchUsers;
                                return () => search(editorState.expression, term, after, limit);
                            }
                            return searchUsersForExpression(editorState.expression, term, after, limit, channelId, teamId);
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
