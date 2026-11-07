// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';

import type {PropertyField} from 'src/types/properties';
import Dropdown from 'src/components/dropdown';
import {DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import Tooltip from 'src/components/widgets/tooltip';

type Props = {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
};

type Option = {label: string; id: string; value: string};

const PropertyValuesInput = ({
    field,
    updateField,
}: Props) => {
    const {formatMessage} = useIntl();

    const generateDefaultName = () => {
        const currentOptions = field.attrs.options || [];
        const existingNames = new Set(currentOptions.map((option) => option.name.toLowerCase()));

        let counter = 1;
        let defaultName = `Option ${counter}`;

        while (existingNames.has(defaultName.toLowerCase())) {
            counter++;
            defaultName = `Option ${counter}`;
        }

        return defaultName;
    };

    const addNewValue = () => {
        const currentOptions = field.attrs.options || [];
        const newOption = {
            id: '', // temporary id, real id assigned by server
            name: generateDefaultName(),
        };
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options: [...currentOptions, newOption],
            },
        });
    };

    const setFieldOptions = (options: Array<{id: string; name: string; color?: string}>) => {
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options,
            },
        });
    };

    if (field.type !== 'multiselect' && field.type !== 'select') {
        return (
            <Container>
                <EmptyValues>
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {'-'}
                </EmptyValues>
            </Container>
        );
    }

    return (
        <Container data-testid='property-values-input'>
            <ValuesContainer>
                {field.attrs.options?.map((option) => (
                    <ClickableMultiValue
                        key={option.id}
                        data={{label: option.name, value: option.name, id: option.id}}
                        field={field}
                        setFieldOptions={setFieldOptions}
                        formatMessage={formatMessage}
                    />
                ))}
                <Tooltip
                    id='add_value_tooltip'
                    content={formatMessage({defaultMessage: 'Add value'})}
                >
                    <AddButton
                        onClick={addNewValue}
                        title={formatMessage({defaultMessage: 'Add value'})}
                        aria-label={formatMessage({defaultMessage: 'Add value'})}
                    >
                        <PlusIcon size={16}/>
                    </AddButton>
                </Tooltip>
            </ValuesContainer>
        </Container>
    );
};

// Custom MultiValue component with dropdown functionality
const ClickableMultiValue = (props: {
    data: Option;
    field: PropertyField;
    setFieldOptions: (options: Array<{id: string; name: string; color?: string}>) => void;
    formatMessage: (descriptor: {defaultMessage: string}) => string;
}) => {
    const [editValue, setEditValue] = useState(props.data.label);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(props.data.label);
    }, [props.data.label]);

    const onDropdownChange = (open: boolean) => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        } else {
            handleRename();
            setEditValue(props.data.label);
        }
    };

    const handleRename = () => {
        const trimmedValue = editValue.trim();
        if (trimmedValue && trimmedValue !== props.data.label) {
            // Check for duplicates
            const existingOptions = props.field.attrs.options || [];
            const isDuplicate = existingOptions.some((option) =>
                option.name === trimmedValue && option.id !== props.data.id
            );

            if (!isDuplicate) {
                const updatedOptions = existingOptions.map((option) => (
                    option.id === props.data.id ? {...option, name: trimmedValue} : option
                ));
                props.setFieldOptions(updatedOptions);
            }
        }
    };

    const handleDelete = () => {
        const currentOptions = props.field.attrs.options || [];

        // Prevent deleting the last option
        if (currentOptions.length <= 1) {
            return;
        }

        const updatedOptions = currentOptions.filter((option) => option.id !== props.data.id);
        props.setFieldOptions(updatedOptions);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            handleRename();
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setEditValue(props.data.label);
            inputRef.current?.blur();
        }
    };

    const handleBlur = () => {
        handleRename();
    };

    return (
        <Dropdown
            onOpenChange={onDropdownChange}
            target={
                <MultiValueContainer>
                    <MultiValueLabel>{props.data.label}</MultiValueLabel>
                </MultiValueContainer>
            }
        >
            <DropdownMenu>
                <DropdownInputContainer>
                    <RenameInput
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        maxLength={255}
                        placeholder={props.formatMessage({defaultMessage: 'Enter value name'})}
                    />
                </DropdownInputContainer>
                {props.field.attrs.options && props.field.attrs.options.length > 1 && (
                    <DropdownMenuItem
                        onClick={() => {
                            handleDelete();
                        }}
                    >
                        <IconWrapper className='destructive'>
                            <TrashCanOutlineIcon size={16}/>
                            {props.formatMessage({defaultMessage: 'Delete'})}
                        </IconWrapper>
                    </DropdownMenuItem>
                )}
            </DropdownMenu>
        </Dropdown>
    );
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
`;

const ValuesContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px;
    min-height: 40px;
    background: transparent;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }
`;

const AddButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    cursor: pointer;
    font-family: 'Open Sans';
    font-size: 12px;
    font-weight: 600;
    transition: all 0.15s ease;

    &:hover {
        color: var(--center-channel-color);
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }

    &:active {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const EmptyValues = styled.div`
    padding: 4px 8px;
`;

const MultiValueContainer = styled.div`
    border-radius: 4px;
    padding: 4px 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.12);
    }
`;

const MultiValueLabel = styled.span`
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
`;

const RenameInput = styled.input`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    outline: none;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 14px;
    font-style: normal;
    font-weight: normal;
    line-height: 20px;
    width: 100%;
    padding: 8px 12px;

    &:focus {
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.2);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const DropdownInputContainer = styled.div`
    padding: 10px;
`;

const IconWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    &.destructive {
        color: var(--error-text);

        &:hover {
            color: var(--error-text);
        }
    }
`;

export default PropertyValuesInput;
