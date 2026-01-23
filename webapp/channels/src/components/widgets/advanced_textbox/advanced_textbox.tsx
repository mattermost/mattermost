// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import ShowFormat from 'components/advanced_text_editor/show_formatting/show_formatting';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';

import './advanced_textbox.scss';

type AdvancedTextboxProps = {
    id: string;
    value: string;
    channelId: string;
    onChange: (e: React.ChangeEvent<TextboxElement>) => void;
    onKeyPress: (e: React.KeyboardEvent<TextboxElement>) => void;
    createMessage: string;
    maxLength: number;
    minLength?: number;
    minLengthErrorMessage?: string;
    preview: boolean;
    togglePreview: () => void;
    useChannelMentions?: boolean;
    descriptionMessage?: JSX.Element | string;
    hasError?: boolean;
    errorMessage?: string | JSX.Element;
    onValidate?: (value: string) => { isValid: boolean; errorMessage?: string };
    showCharacterCount?: boolean;
    readOnly?: boolean;
    name?: string; // Added name prop for floating label
};

const AdvancedTextbox = ({
    id,
    value,
    channelId,
    onChange,
    onKeyPress,
    createMessage,
    maxLength,
    minLength,
    minLengthErrorMessage,
    preview,
    togglePreview,
    useChannelMentions = false,
    descriptionMessage,
    hasError,
    errorMessage,
    onValidate,
    showCharacterCount = false,
    readOnly = false,
    name,
}: AdvancedTextboxProps) => {
    const {formatMessage} = useIntl();
    const [internalError, setInternalError] = useState<string | JSX.Element | undefined>(errorMessage);
    const [isFocused, setIsFocused] = useState(false);

    // Derived values
    const isTooLong = value.length > maxLength;
    const isTooShort = minLength !== undefined && value.length > 0 && value.length < minLength;

    // Update internal error when prop changes or when validation state changes
    useEffect(() => {
        if (errorMessage) {
            setInternalError(errorMessage);
        } else if (isTooLong) {
            setInternalError(formatMessage(
                {id: 'advanced_textbox.max_length_error', defaultMessage: 'Text exceeds the maximum character limit of {maxLength} characters.'},
                {maxLength},
            ));
        } else if (isTooShort) {
            setInternalError(minLengthErrorMessage || formatMessage(
                {id: 'advanced_textbox.min_length_error', defaultMessage: 'Text must be at least {minLength} characters.'},
                {minLength},
            ));
        } else {
            setInternalError(undefined);
        }
    }, [errorMessage, isTooLong, isTooShort, maxLength, minLength, minLengthErrorMessage, formatMessage]);

    // Handle focus events
    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    // Handle validation on change
    const handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;

        // Run validation if provided
        if (onValidate) {
            const validationResult = onValidate(newValue);
            if (validationResult.isValid === false) {
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
            <div className='AdvancedTextbox__wrapper'>
                {name && (
                    <div className={`AdvancedTextbox__label ${(value || isFocused) ? 'AdvancedTextbox__label--active' : ''} ${isFocused ? 'AdvancedTextbox__label--focused' : ''} ${hasError || internalError ? 'AdvancedTextbox__label--error' : ''}`}>
                        {name}
                    </div>
                )}
                <Textbox
                    value={value}
                    onChange={handleChange}
                    onKeyPress={onKeyPress}
                    supportsCommands={false}
                    suggestionListPosition='bottom'
                    createMessage={createMessage}
                    channelId={channelId}
                    id={id}
                    characterLimit={maxLength}
                    preview={localPreview}
                    useChannelMentions={useChannelMentions}
                    hasError={hasError}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    disabled={readOnly}
                />
            </div>
            {!readOnly && value.trim().length > 0 && (
                <ShowFormat
                    onClick={togglePreview}
                    active={preview}
                />)
            }

            <div className='AdvancedTextbox__error-wrapper'>
                {/* Error message display */}
                {internalError && (
                    <div className='AdvancedTextbox__error-message'>
                        <i className='icon icon-alert-circle-outline'/>
                        <span>{internalError}</span>
                    </div>
                )}

                {/* Character count display */}
                {showCharacterCount && (isTooLong || isTooShort || internalError) && (
                    <div
                        className={classNames('AdvancedTextbox__character-count', {
                            'exceeds-limit': isTooLong,
                            'below-minimum': isTooShort,
                        })}
                    >
                        {value.length}{'/'}
                        {isTooShort ? minLength : maxLength}
                    </div>
                )}
            </div>

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
