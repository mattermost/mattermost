// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect} from 'react';

import ShowFormat from 'components/advanced_text_editor/show_formatting/show_formatting';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';

import './advanced_textbox.scss';

type AdvancedTextboxProps = {
    id: string;
    value: string;
    channelId: string;
    onChange: (e: React.ChangeEvent<TextboxElement>) => void;
    onKeypress: (e: React.KeyboardEvent<TextboxElement>) => void;
    createMessage: string;
    characterLimit: number;
    minCharacterLimit?: number;
    minLengthErrorMessage?: string;
    preview: boolean;
    togglePreview: () => void;
    textboxRef?: React.RefObject<TextboxClass>;
    useChannelMentions?: boolean;
    descriptionMessage?: JSX.Element | string;
    hasError?: boolean;
    errorMessage?: string | JSX.Element;
    onValidate?: (value: string) => { isValid: boolean; errorMessage?: string };
    showCharacterCount?: boolean;
    readOnly?: boolean;
};

const AdvancedTextbox = ({
    id,
    value,
    channelId,
    onChange,
    onKeypress,
    createMessage,
    characterLimit,
    minCharacterLimit,
    minLengthErrorMessage,
    preview,
    togglePreview,
    textboxRef,
    useChannelMentions = false,
    descriptionMessage,
    hasError,
    errorMessage,
    onValidate,
    showCharacterCount = false,
    readOnly = false,
}: AdvancedTextboxProps) => {
    const [internalError, setInternalError] = useState<string | JSX.Element | undefined>(errorMessage);
    const [characterCount, setCharacterCount] = useState(value.length);
    const [errorType, setErrorType] = useState<'min' | 'max' | null>(null);

    // Update internal error when prop changes
    useEffect(() => {
        setInternalError(errorMessage);
    }, [errorMessage]);

    // Update character count when value changes
    useEffect(() => {
        setCharacterCount(value.length);

        // Validate maximum character limit
        if (value && value.length > characterLimit) {
            setInternalError(`Text exceeds the maximum character limit of ${characterLimit} characters.`);
            setErrorType('max');
        } else if (minCharacterLimit && value && value.length > 0 && value.length < minCharacterLimit) {
            // Validate minimum character limit (only if field is not empty)
            setInternalError(minLengthErrorMessage ||
                `Text must be at least ${minCharacterLimit} characters.`);
            setErrorType('min');
        } else {
            // Clear internal error if value is now valid
            const shouldClearError = internalError &&
                                   errorMessage === undefined &&
                                   (!minCharacterLimit || value.length === 0 || value.length >= minCharacterLimit) &&
                                   value.length <= characterLimit;
            if (shouldClearError) {
                setInternalError(undefined);
                setErrorType(null);
            }
        }
    }, [value, characterLimit, minCharacterLimit, minLengthErrorMessage, internalError, errorMessage]);

    // Handle validation on change
    const handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;
        setCharacterCount(newValue.length);

        // Run validation if provided
        if (onValidate) {
            const validationResult = onValidate(newValue);
            const isValid = validationResult.isValid;
            if (isValid === false) {
                setInternalError(validationResult.errorMessage);
            } else {
                setInternalError(undefined);
            }
        }

        // Call original onChange
        onChange(e);
    };

    let localPreview = preview;
    if (readOnly) {
        localPreview = true;
    }

    return (
        <div className='AdvancedTextbox'>
            <Textbox
                value={value}
                onChange={handleChange}
                onKeyPress={onKeypress}
                supportsCommands={false}
                suggestionListPosition='bottom'
                createMessage={createMessage}
                ref={textboxRef}
                channelId={channelId}
                id={id}
                characterLimit={characterLimit}
                preview={localPreview}
                useChannelMentions={useChannelMentions}
                hasError={hasError}
            />
            {!readOnly && (
                <ShowFormat
                    onClick={togglePreview}
                    active={preview}
                />)
            }

            {/* Character count display */}
            {(showCharacterCount && (internalError || errorType)) && (
                <div
                    className={classNames('AdvancedTextbox__character-count', {
                        'exceeds-limit': characterCount > characterLimit,
                        'below-minimum': minCharacterLimit && characterCount > 0 && characterCount < minCharacterLimit,
                    })}
                >
                    {characterCount}{'/'}
                    {errorType === 'min' ? minCharacterLimit : characterLimit}
                </div>
            )}

            {/* Error message display */}
            {internalError && (
                <div className='AdvancedTextbox__error-message'>
                    <i className='icon icon-alert-circle-outline'/>
                    <span>{internalError}</span>
                </div>
            )}

            {/* Error message display */}
            {(descriptionMessage && !internalError) && (
                <p
                    data-testid='AdvancedTextbox__description'
                    className='AdvancedTextbox__description'
                >
                    {descriptionMessage}
                </p>
            )}
        </div>
    );
};

export default AdvancedTextbox;
