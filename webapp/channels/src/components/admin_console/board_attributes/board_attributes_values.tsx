// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {CheckIcon, CloseCircleIcon, LockOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {supportsOptions, type BoardPropertyField, type PropertyFieldOption} from '@mattermost/types/properties';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import * as Menu from 'components/menu';

import {ValidationWarningOptionsUnique, isOptionNameTaken} from './board_attributes_utils';

import {DangerText} from '../system_properties/controls';

// Color tokens for select-option chips. Each token is a stable string stored
// on `PropertyFieldOption.color`. The map below renders the token as a light
// pastel background. Order matches the picker's display order.
const COLOR_TOKEN_NAMES = ['default', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
type ColorToken = typeof COLOR_TOKEN_NAMES[number];

const colorTokenMap: Record<ColorToken, string> = {
    default: 'rgba(var(--center-channel-color-rgb), 0.08)',
    brown: '#e9e5e3',
    orange: '#fadec9',
    yellow: '#fdecc8',
    green: '#dbeddb',
    blue: '#d3e5ef',
    purple: '#e8deee',
    pink: '#f5e0e9',
    red: '#ffe2dd',
};

// Backward-compat: prior seeds and earlier dev installs stored "neutral".
// Treat it as `default` so existing data renders correctly.
const COLOR_ALIASES: Record<string, ColorToken> = {
    neutral: 'default',
};

const normalizeColor = (token: string | undefined): ColorToken => {
    const t = token ?? 'default';
    const aliased = COLOR_ALIASES[t] ?? (t as ColorToken);
    return COLOR_TOKEN_NAMES.includes(aliased) ? aliased : 'default';
};

const resolveColor = (token: string | undefined): string => colorTokenMap[normalizeColor(token)];

const colorTokenLabels: Record<ColorToken, MessageDescriptor> = defineMessages({
    default: {id: 'admin.board_attributes.values.color.default', defaultMessage: 'Default'},
    brown: {id: 'admin.board_attributes.values.color.brown', defaultMessage: 'Brown'},
    orange: {id: 'admin.board_attributes.values.color.orange', defaultMessage: 'Orange'},
    yellow: {id: 'admin.board_attributes.values.color.yellow', defaultMessage: 'Yellow'},
    green: {id: 'admin.board_attributes.values.color.green', defaultMessage: 'Green'},
    blue: {id: 'admin.board_attributes.values.color.blue', defaultMessage: 'Blue'},
    purple: {id: 'admin.board_attributes.values.color.purple', defaultMessage: 'Purple'},
    pink: {id: 'admin.board_attributes.values.color.pink', defaultMessage: 'Pink'},
    red: {id: 'admin.board_attributes.values.color.red', defaultMessage: 'Red'},
});

const MAX_OPTION_NAME_LENGTH = 64;

type Props = {
    field: BoardPropertyField;
    updateField: (field: BoardPropertyField) => void;
    warning?: string;
    autoFocus?: boolean;
}

const BoardAttributesValues = ({field, updateField, warning}: Props) => {
    const {formatMessage} = useIntl();

    if (!supportsOptions(field) || field.type === 'user' || field.type === 'multiuser') {
        return (
            <EmptyValues>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {'—'}
            </EmptyValues>
        );
    }

    const options = field.attrs?.options ?? [];

    if (field.protected) {
        return (
            <WithTooltip
                title={formatMessage({
                    id: 'admin.board_attributes.values.protected_tooltip',
                    defaultMessage: 'System attribute options cannot be modified',
                })}
            >
                <ProtectedValues data-testid='property-values-readonly'>
                    {options.map((option) => (
                        <ReadonlyChip
                            key={option.id}
                            style={{backgroundColor: resolveColor(option.color)}}
                        >
                            <ChipLabel>{option.name}</ChipLabel>
                        </ReadonlyChip>
                    ))}
                    <LockOutlineIcon
                        size={14}
                        color='rgba(var(--center-channel-color-rgb), 0.48)'
                    />
                </ProtectedValues>
            </WithTooltip>
        );
    }

    const generateDefaultName = () => {
        const existing = new Set(options.map((o) => o.name.toLowerCase()));
        let counter = 1;
        let name = `Option ${counter}`;
        while (existing.has(name.toLowerCase())) {
            counter++;
            name = `Option ${counter}`;
        }
        return name;
    };

    const setOptions = (next: PropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options: next}});
    };

    const handleAdd = () => {
        setOptions([...options, {id: '', name: generateDefaultName()}]);
    };

    return (
        <>
            <ValuesContainer data-testid='property-values-input'>
                {options.map((option, index) => (
                    <EditableChip
                        key={option.id || `pending-${index}`}
                        option={option}
                        options={options}
                        setOptions={setOptions}
                    />
                ))}
                <WithTooltip
                    title={formatMessage({
                        id: 'admin.board_attributes.values.add_value',
                        defaultMessage: 'Add value',
                    })}
                >
                    <AddButton
                        onClick={handleAdd}
                        aria-label={formatMessage({
                            id: 'admin.board_attributes.values.add_value',
                            defaultMessage: 'Add value',
                        })}
                        type='button'
                    >
                        <PlusIcon size={14}/>
                    </AddButton>
                </WithTooltip>
            </ValuesContainer>
            {warning === ValidationWarningOptionsUnique && (
                <FormattedMessage
                    tagName={DangerText}
                    id='admin.board_attributes.table.validation.values_unique'
                    defaultMessage='Values must be unique.'
                />
            )}
        </>
    );
};

type ChipProps = {
    option: PropertyFieldOption;
    options: PropertyFieldOption[];
    setOptions: (next: PropertyFieldOption[]) => void;
};

const EditableChip = ({option, options, setOptions}: ChipProps) => {
    const {formatMessage} = useIntl();
    const [editValue, setEditValue] = useState(option.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const canDelete = options.length > 1;
    const currentColor = normalizeColor(option.color);

    // The committed name conflicts with a sibling — render the chip with a
    // red border so the conflict is visible without opening the dropdown.
    const isInvalid = isOptionNameTaken(option.name, options, option);

    useEffect(() => {
        setEditValue(option.name);
    }, [option.name]);

    // True while the input value (typed or committed) would duplicate a
    // sibling. Provides immediate in-menu feedback before the edit reaches
    // the collection; the hook's beforeUpdate still runs the authoritative
    // check and BoardAttributesValues surfaces the persistent warning under
    // the chip list.
    const liveRenameTaken = useMemo(
        () => Boolean(editValue.trim()) && isOptionNameTaken(editValue, options, option),
        [editValue, options, option],
    );

    // Commit any non-empty distinct value to the collection — even a duplicate.
    // Surfacing the conflict is the warning's job (live in the menu, plus
    // collection-level under the chip list). We don't discard the edit.
    const commitRename = () => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === option.name) {
            setEditValue(option.name);
            return;
        }
        setOptions(options.map((o) => (o === option ? {...o, name: trimmed} : o)));
    };

    const setColor = (color: ColorToken) => {
        setOptions(options.map((o) => (o === option ? {...o, color} : o)));
    };

    const handleDelete = () => {
        if (!canDelete) {
            return;
        }
        setOptions(options.filter((o) => o !== option));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            commitRename();
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setEditValue(option.name);
            inputRef.current?.blur();
        }
    };

    const menuId = `board-option-${option.id || option.name}`;

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleDelete();
    };

    return (
        <ChipShell
            $invalid={isInvalid}
            style={{backgroundColor: resolveColor(option.color)}}
        >
            <Menu.Container
                menuButton={{
                    id: `${menuId}-button`,
                    class: 'property-option-chip-trigger',
                    children: <ChipLabel>{option.name}</ChipLabel>,
                    dataTestId: `property-option-chip-${option.id || option.name}`,
                }}
                menu={{
                    id: `${menuId}-menu`,
                    'aria-label': formatMessage({
                        id: 'admin.board_attributes.values.option_menu_label',
                        defaultMessage: 'Edit option',
                    }),
                    className: 'property-option-menu',
                }}
            >
                <RenameInputWrapper>
                    <RenameInput
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleKeyDown}
                        onBlur={commitRename}
                        maxLength={MAX_OPTION_NAME_LENGTH}
                        placeholder={formatMessage({
                            id: 'admin.board_attributes.values.rename_placeholder',
                            defaultMessage: 'Option name',
                        })}
                        autoFocus={true}
                        aria-invalid={liveRenameTaken}
                    />
                    {liveRenameTaken && (
                        <RenameError role='alert'>
                            <FormattedMessage
                                id='admin.board_attributes.values.rename_duplicate'
                                defaultMessage='A value with this name already exists.'
                            />
                        </RenameError>
                    )}
                </RenameInputWrapper>
                {canDelete && (
                    <Menu.Item
                        id={`${menuId}-delete`}
                        onClick={handleDelete}
                        isDestructive={true}
                        leadingElement={<TrashCanOutlineIcon size={16}/>}
                        labels={(
                            <FormattedMessage
                                id='admin.board_attributes.values.delete'
                                defaultMessage='Delete'
                            />
                        )}
                    />
                )}
                <Menu.Separator/>
                <ColorsLabel>
                    <FormattedMessage
                        id='admin.board_attributes.values.colors_header'
                        defaultMessage='Colors'
                    />
                </ColorsLabel>
                {COLOR_TOKEN_NAMES.map((token) => (
                    <Menu.Item
                        key={token}
                        id={`${menuId}-color-${token}`}
                        role='menuitemradio'
                        aria-checked={currentColor === token}
                        forceCloseOnSelect={false}
                        onClick={() => setColor(token)}
                        leadingElement={<ColorPreview style={{backgroundColor: colorTokenMap[token]}}/>}
                        labels={<FormattedMessage {...colorTokenLabels[token]}/>}
                        trailingElements={currentColor === token ? (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg)'
                            />
                        ) : undefined}
                    />
                ))}
            </Menu.Container>
            {canDelete && (
                <ChipDeleteButton
                    type='button'
                    onClick={handleDeleteClick}
                    aria-label={formatMessage({
                        id: 'admin.board_attributes.values.delete_option',
                        defaultMessage: 'Delete option',
                    }, {name: option.name})}
                    data-testid={`property-option-delete-${option.id || option.name}`}
                >
                    <CloseCircleIcon
                        size={14}
                        color='rgba(var(--center-channel-color-rgb), 0.56)'
                    />
                </ChipDeleteButton>
            )}
        </ChipShell>
    );
};

export default BoardAttributesValues;

const EmptyValues = styled.span`
    padding: 4px 8px;
    color: rgba(var(--center-channel-color-rgb), 0.48);
`;

const ValuesContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 0;
    min-height: 40px;

    /*
     * Menu.Container wraps the chip label in a <button>. Reset its box model
     * so it can sit transparently inside <ChipShell> and pick up the chip's
     * coloured background, padding, and rounded corners.
     */
    .property-option-chip-trigger,
    & .property-option-chip-trigger:focus,
    & .property-option-chip-trigger:hover {
        padding: 2px 4px 2px 8px;
        margin: 0;
        border: 0;
        background: transparent;
        min-height: 0;
        line-height: normal;
        box-shadow: none;
        color: var(--center-channel-color);
        font-family: 'Open Sans';
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }
`;

const ProtectedValues = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 0;
    min-height: 40px;
`;

/* Outer pill: takes the option's colour as background, holds the menu-trigger
   button and the inline X delete button as siblings so they render as one
   visual chip but remain individually focusable. */
const ChipShell = styled.span<{$invalid?: boolean}>`
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    user-select: none;
    transition: filter 0.15s ease, box-shadow 0.15s ease;

    &:hover {
        filter: brightness(0.97);
    }

    ${({$invalid}) => $invalid && css`
        box-shadow: 0 0 0 1px var(--error-text);
    `}
`;

const ReadonlyChip = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 4px;
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    cursor: default;
`;

const ChipLabel = styled.span`
    white-space: nowrap;
    line-height: 18px;
`;

const ChipDeleteButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px 0 2px;
    margin: 0;
    height: 100%;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        color: var(--center-channel-color);
    }

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: -2px;
        border-radius: 2px;
    }
`;

/* Rounded-square colour preview shown inside menu items, matching the look
   of a paint chip (~18px square, light border for low-saturation colours). */
const ColorPreview = styled.span`
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.08);
`;

const ColorsLabel = styled.div`
    padding: 8px 16px 4px;
    font-family: 'Open Sans';
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const AddButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
        color: var(--center-channel-color);
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const RenameInputWrapper = styled.div`
    padding: 8px 12px;
`;

const RenameInput = styled.input`
    width: 100%;
    padding: 6px 10px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 14px;
    line-height: 20px;
    outline: none;

    &:focus {
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.2);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }

    &[aria-invalid='true'] {
        border-color: var(--error-text);
    }

    &[aria-invalid='true']:focus {
        border-color: var(--error-text);
        box-shadow: 0 0 0 2px rgba(var(--error-text-color-rgb), 0.2);
    }
`;

const RenameError = styled.div`
    margin-top: 6px;
    font-family: 'Open Sans';
    font-size: 12px;
    line-height: 16px;
    color: var(--error-text);
`;

