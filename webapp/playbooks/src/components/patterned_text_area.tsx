// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {useUpdateEffect} from 'react-use';

interface Props {
    enabled: boolean;
    placeholderText: string;
    errorText: string;
    input: string;
    pattern: string;
    delimiter?: string;
    onChange?: (updatedInput: string) => void;
    onValidationChange?: (isValid: boolean) => void;
    onBlur?: (updatedInput: string) => void;
    maxLength?: number;
    rows?: number;
    maxRows?: number;
    maxErrorText?: string;
    resize?: 'horizontal' | 'vertical' | 'none';
}

const PatternedTextArea = (props: Props) => {
    const [invalid, setInvalid] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string>(props.errorText);
    const [value, setValue] = useState(props.input);

    props.onValidationChange?.(!invalid);

    useUpdateEffect(() => {
        setValue(props.input);
    }, [props.input]);

    const handleOnBlur = (urls: string) => {
        if (!props.enabled) {
            setInvalid(false);
            return;
        }

        if (props.maxRows && urls.split(props.delimiter || '\n').filter((v) => v.trim().length > 0).length > props.maxRows) {
            setInvalid(true);
            if (props.maxErrorText) {
                setErrorText(props.maxErrorText);
            }
            return;
        }

        if (!isPatternValid(urls, props.pattern, props.delimiter)) {
            setInvalid(true);
            setErrorText(props.errorText);
            return;
        }

        props.onBlur?.(urls);

        setInvalid(false);
    };

    return (
        <>
            <TextArea
                disabled={!props.enabled}
                required={true}
                rows={props.rows}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    props.onChange?.(e.target.value);
                }}
                onBlur={(e) => handleOnBlur(e.target.value)}
                placeholder={props.placeholderText}
                maxLength={props.maxLength}
                invalid={invalid}
                resize={props.resize}
            />
            <ErrorMessage>
                {errorText}
            </ErrorMessage>
        </>
    );
};

const isPatternValid = (value: string, pattern: string, delimiter = '\n'): boolean => {
    const regex = new RegExp(pattern);
    const trimmed = value.split(delimiter).filter((v) => v.trim().length);
    const invalid = trimmed.filter((v) => !regex.test(v));
    return invalid.length === 0;
};

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    display: none;
`;

interface TextAreaProps {
    disabled: boolean;
    invalid: boolean;
    resize?: Props['resize'];
}

const TextArea = styled.textarea<TextAreaProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: auto;
    width: 100%;

    background-color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};
    color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color);')};
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    padding: 10px 16px;
    resize: ${(props) => (props.disabled && 'none') || props.resize || 'none'};

    ${(props) => props.invalid && !props.disabled && props.value && css`
        :not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);
            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;

export default PatternedTextArea;
