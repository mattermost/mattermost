// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import type {PropertyField} from 'src/types/properties';

interface Props {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
    existingNames: string[];
    autoFocus?: boolean;
}

export interface PropertyNameInputRef {
    focus: () => void;
    select: () => void;
}

const PropertyNameInput = forwardRef<PropertyNameInputRef, Props>(({field, updateField, existingNames, autoFocus}, ref) => {
    const {formatMessage} = useIntl();

    const [localValue, setLocalValue] = useState<string | null>(null);
    const [originalValue, setOriginalValue] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus and select on mount if requested
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [autoFocus]);

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        select: () => inputRef.current?.select(),
    }));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // Check for errors while typing
        const trimmedValue = newValue.trim();

        if (trimmedValue === '') {
            setErrorMessage('Attribute name cannot be empty');
        } else if (trimmedValue === field.name) {
            setErrorMessage(null);
        } else {
            const otherNames = existingNames.filter((name) => name !== field.name);
            const isDuplicate = otherNames.some((name) => name.trim().toLowerCase() === trimmedValue.toLowerCase());

            if (isDuplicate) {
                setErrorMessage('A property with this name already exists');
            } else {
                setErrorMessage(null);
            }
        }
    };

    const handleFocus = () => {
        // Save the original value when focusing
        setOriginalValue(field.name);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const newName = e.target.value.trim();

        // If field is empty, restore original value
        if (newName === '' && originalValue) {
            setLocalValue(originalValue);
            const updatedField = {...field, name: originalValue};
            updateField(updatedField);
        } else if (newName !== field.name) {
            // Check for duplicates (excluding current field's original name)
            const otherNames = existingNames.filter((name) => name !== field.name);
            const isDuplicate = otherNames.some((name) => name.trim().toLowerCase() === newName.trim().toLowerCase());

            if (isDuplicate && originalValue) {
                // Restore original value if duplicate found
                setLocalValue(originalValue);
                const updatedField = {...field, name: originalValue};
                updateField(updatedField);
            } else {
                const updatedField = {...field, name: newName};
                updateField(updatedField);
            }
        }

        setLocalValue(null);
        setOriginalValue(null);
        setErrorMessage(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            // Restore original value on Escape
            if (originalValue) {
                setLocalValue(originalValue);
            } else {
                setLocalValue(null);
            }
            e.currentTarget.blur();
        }
    };

    return (
        <Container>
            <StyledInput
                ref={inputRef}
                type='text'
                aria-label={formatMessage({defaultMessage: 'Attribute name'})}
                value={localValue ?? field.name}
                placeholder={originalValue || field.name}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                $hasError={Boolean(errorMessage)}
            />
            {errorMessage && (
                <ErrorMessage>{errorMessage}</ErrorMessage>
            )}
        </Container>
    );
});

PropertyNameInput.displayName = 'PropertyNameInput';

const Container = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
`;

const StyledInput = styled.input<{$hasError?: boolean}>`
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--center-channel-color);
    padding: 4px 8px;
    border-radius: 0;
    cursor: pointer;
    min-height: 40px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        cursor: text;
    }

    &:focus {
        outline: none;
        background: rgba(var(--button-bg-rgb), 0.08);
        cursor: text;
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const ErrorMessage = styled.div`
    color: #D24B4E;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    margin-top: 4px;
    padding-left: 8px;
`;

export default PropertyNameInput;
