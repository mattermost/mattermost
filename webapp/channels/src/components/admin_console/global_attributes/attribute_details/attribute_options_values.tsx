// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent} from 'react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {components} from 'react-select';
import {css} from 'styled-components';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {moveOptionByIndex} from './option_utils';
import {useOptionChipEditor} from './use_option_chip_editor';

import './attribute_options_values.scss';

const labelInputCustomStyles = css`
    padding-bottom: 4px;
`;

type Props = {
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    disabled?: boolean;
};

const buildNewOption = (name: string): PropertyFieldOption => ({id: '', name});

// Renders a Select/Multiselect field's options as removable chips, plus an
// input that appends a new value. Each chip's popover offers a rename input
// and a "Move to position" submenu -- a keyboard-operable alternative to
// drag-and-drop (see plan Design Decision 4). Ports the interaction shape of
// system_properties/user_properties_rank_values.tsx (chip + popover), not
// user_properties_values.tsx's react-select-based editor, since this ticket's
// reorder requirement needs the same keyboard-accessible popover Rank already
// has, not a mouse-only drag surface. Shared add/remove/rename/duplicate logic
// lives in use_option_chip_editor.ts, consumed by this and the Rank editor.
const AttributeOptionsValues = ({options, onOptionsChange, disabled = false}: Props) => {
    const {formatMessage} = useIntl();

    const {
        query, setQuery, addInputRef, isDuplicate, nameCollidesWith,
        handleRename, handleRemove, addValue, handleQueryKeyDown,
        placeholderText, showPlaceholder, focusInput, maxOptionNameLength,
    } = useOptionChipEditor({orderedOptions: options, onOptionsChange, buildNewOption});

    const handleMoveToPosition = useCallback((index: number, targetIndex: number) => {
        onOptionsChange(moveOptionByIndex(options, index, targetIndex));
    }, [options, onOptionsChange]);

    return (
        <div
            className='attribute-options-values'
            data-testid='attributeOptionsValues'
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mousedown only forwards focus to the keyboard-accessible add input */}
            <div
                className='attribute-options-values__chips'
                onMouseDown={focusInput}
            >
                {options.map((option, index) => (
                    <OptionChip
                        key={option.id || option.name}
                        option={option}
                        index={index}
                        total={options.length}
                        nameCollidesWith={nameCollidesWith}
                        maxOptionNameLength={maxOptionNameLength}
                        onRename={handleRename}
                        onMoveToPosition={handleMoveToPosition}
                        onRemove={handleRemove}
                        disabled={disabled}
                    />
                ))}
                <span
                    className='attribute-options-values__add-sizer'
                    data-value={query || (showPlaceholder ? placeholderText : '')}
                >
                    <input
                        ref={addInputRef}
                        type='text'
                        className='attribute-options-values__add-input'
                        data-testid='attributeOptionsValues__addInput'
                        value={query}
                        maxLength={maxOptionNameLength}
                        aria-label={placeholderText}
                        placeholder={showPlaceholder ? placeholderText : undefined}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleQueryKeyDown}
                        onBlur={addValue}
                        disabled={disabled}
                    />
                </span>
            </div>
            {isDuplicate && (
                <span
                    className='attribute-options-values__danger-text'
                    role='alert'
                >
                    {formatMessage({
                        id: 'admin.global_attributes.attribute_details.options.values_unique',
                        defaultMessage: 'Values must be unique.',
                    })}
                </span>
            )}
        </div>
    );
};

type OptionChipProps = {
    option: PropertyFieldOption;
    index: number;
    total: number;
    maxOptionNameLength: number;
    nameCollidesWith: (name: string, exceptIndex: number) => boolean;
    onRename: (index: number, name: string) => void;
    onMoveToPosition: (index: number, targetIndex: number) => void;
    onRemove: (index: number) => void;
    disabled?: boolean;
};

// A single removable chip plus its inline rename/reorder popover.
const OptionChip = ({option, index, total, maxOptionNameLength, nameCollidesWith, onRename, onMoveToPosition, onRemove, disabled = false}: OptionChipProps) => {
    const {formatMessage} = useIntl();
    const [label, setLabel] = useState(option.name);

    useEffect(() => {
        setLabel(option.name);
    }, [option.name]);

    const commitLabel = useCallback(() => onRename(index, label), [onRename, index, label]);

    const trimmedLabel = label.trim();
    const labelError = useMemo<CustomMessageInputType>(() => {
        if (!trimmedLabel || !nameCollidesWith(trimmedLabel, index)) {
            return null;
        }
        return {
            type: 'error',
            value: formatMessage({
                id: 'admin.global_attributes.attribute_details.options.values_unique',
                defaultMessage: 'Values must be unique.',
            }),
        };
    }, [trimmedLabel, nameCollidesWith, index, formatMessage]);

    // Index-based, not name-based: an option name is free-form user text and
    // may contain characters that aren't valid in an HTML id (e.g. spaces),
    // unlike the React `key` above (which is fine being name-based since it
    // only needs to be unique, not a valid id string).
    const chipId = `attribute-option-chip-${index}`;

    const positionSuffix = String(index + 1);

    const removeLabel = formatMessage({
        id: 'admin.global_attributes.attribute_details.options.remove_option',
        defaultMessage: 'Remove option',
    });

    return (
        <span
            className='attribute-options-values__chip'
            data-testid='attributeOptionsValues__chip'
        >
            <Menu.Container
                menuButton={{
                    id: chipId,
                    class: 'attribute-options-values__chip-name',
                    disabled,
                    children: (
                        <span
                            className='attribute-options-values__chip-label'
                            data-testid='attributeOptionsValues__chipLabel'
                        >{option.name}</span>
                    ),
                    dataTestId: chipId,
                }}
                menu={{
                    id: `${chipId}-popover`,
                    className: 'attribute-options-values__popover-list',
                    'aria-label': formatMessage({
                        id: 'admin.global_attributes.attribute_details.options.edit_option',
                        defaultMessage: 'Edit option',
                    }),
                }}
            >
                <Menu.InputItem
                    key='label'
                    id={`${chipId}-label`}
                    type='text'
                    customStyles={labelInputCustomStyles}
                    value={label}
                    maxLength={maxOptionNameLength}
                    customMessage={labelError}
                    placeholder={formatMessage({
                        id: 'admin.global_attributes.attribute_details.options.label_placeholder',
                        defaultMessage: 'Option label',
                    })}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Escape') {
                            // Discard the in-progress edit rather than letting the
                            // popover's close (and the resulting blur) commit it.
                            setLabel(option.name);
                            return;
                        }
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                            commitLabel();
                        }
                    }}
                    onBlur={commitLabel}
                />
                <Menu.SubMenu
                    id={`${chipId}-position`}
                    menuId={`${chipId}-position-menu`}
                    labels={(
                        <span>{formatMessage({
                            id: 'admin.global_attributes.attribute_details.options.position_menu_label',
                            defaultMessage: 'Move to position',
                        })}</span>
                    )}
                    trailingElements={(
                        <span className='attribute-options-values__position-current'>{positionSuffix}</span>
                    )}
                    forceOpenOnLeft={false}
                >
                    {Array.from({length: total}, (_, position) => (
                        <Menu.Item
                            key={position}
                            id={`${chipId}-position-${position}`}
                            role='menuitemradio'
                            forceCloseOnSelect={true}
                            aria-checked={position === index}
                            onClick={() => onMoveToPosition(index, position)}
                            labels={<span>{position + 1}</span>}
                            trailingElements={position === index ? <CheckIcon size={16}/> : undefined}
                        />
                    ))}
                </Menu.SubMenu>
            </Menu.Container>
            <button
                type='button'
                className='attribute-options-values__chip-remove'
                data-testid={`${chipId}-remove`}
                onClick={() => onRemove(index)}
                aria-label={removeLabel}
                disabled={disabled}
            >
                <components.CrossIcon size={14}/>
            </button>
        </span>
    );
};

export default AttributeOptionsValues;
