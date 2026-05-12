// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import styled from 'styled-components';

import {CheckIcon, LockOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {supportsOptions, type BoardPropertyField, type PropertyFieldOption} from '@mattermost/types/properties';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import * as Menu from 'components/menu';

// Color tokens for select-option swatches. Stored as a token name on the option;
// rendered via this map. Falls back to neutral for unknown tokens.
const COLOR_TOKEN_NAMES = ['neutral', 'blue', 'green', 'yellow', 'red', 'purple', 'cyan', 'pink'] as const;
type ColorToken = typeof COLOR_TOKEN_NAMES[number];

const colorTokenMap: Record<ColorToken, string> = {
    neutral: 'rgba(var(--center-channel-color-rgb), 0.48)',
    blue: '#1c58d9',
    green: '#3db887',
    yellow: '#f5ab00',
    red: '#d24b4e',
    purple: '#9b51e0',
    cyan: '#22a0d5',
    pink: '#ef5e7e',
};

const resolveColor = (token: string | undefined): string => colorTokenMap[(token ?? 'neutral') as ColorToken] ?? colorTokenMap.neutral;

const colorTokenLabels: Record<ColorToken, MessageDescriptor> = defineMessages({
    neutral: {id: 'admin.board_attributes.values.color.neutral', defaultMessage: 'Neutral'},
    blue: {id: 'admin.board_attributes.values.color.blue', defaultMessage: 'Blue'},
    green: {id: 'admin.board_attributes.values.color.green', defaultMessage: 'Green'},
    yellow: {id: 'admin.board_attributes.values.color.yellow', defaultMessage: 'Yellow'},
    red: {id: 'admin.board_attributes.values.color.red', defaultMessage: 'Red'},
    purple: {id: 'admin.board_attributes.values.color.purple', defaultMessage: 'Purple'},
    cyan: {id: 'admin.board_attributes.values.color.cyan', defaultMessage: 'Cyan'},
    pink: {id: 'admin.board_attributes.values.color.pink', defaultMessage: 'Pink'},
});

const MAX_OPTION_NAME_LENGTH = 64;

type Props = {
    field: BoardPropertyField;
    updateField: (field: BoardPropertyField) => void;
    autoFocus?: boolean;
}

const BoardAttributesValues = ({field, updateField}: Props) => {
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
                        <ReadonlyChip key={option.id}>
                            <ColorSwatch style={{backgroundColor: resolveColor(option.color)}}/>
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
    const currentColor = (option.color ?? 'neutral') as ColorToken;

    useEffect(() => {
        setEditValue(option.name);
    }, [option.name]);

    const commitRename = () => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === option.name) {
            setEditValue(option.name);
            return;
        }

        const duplicate = options.some((o) => o !== option && o.name.toLowerCase() === trimmed.toLowerCase());
        if (duplicate) {
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

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                class: 'property-option-chip-button',
                children: (
                    <Chip>
                        <ColorSwatch style={{backgroundColor: resolveColor(option.color)}}/>
                        <ChipLabel>{option.name}</ChipLabel>
                    </Chip>
                ),
                dataTestId: `property-option-chip-${option.id || option.name}`,
            }}
            menu={{
                id: `${menuId}-menu`,
                'aria-label': formatMessage({
                    id: 'admin.board_attributes.values.option_menu_label',
                    defaultMessage: 'Edit option',
                }),
                className: 'property-option-menu',
                onToggle: (open: boolean) => {
                    if (!open) {
                        commitRename();
                    }
                },
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
                />
            </RenameInputWrapper>
            <Menu.Separator/>
            {COLOR_TOKEN_NAMES.map((token) => (
                <Menu.Item
                    key={token}
                    id={`${menuId}-color-${token}`}
                    role='menuitemradio'
                    aria-checked={currentColor === token}
                    forceCloseOnSelect={false}
                    onClick={() => setColor(token)}
                    leadingElement={(
                        <SwatchIcon>
                            <ColorSwatch style={{backgroundColor: colorTokenMap[token]}}/>
                        </SwatchIcon>
                    )}
                    labels={<FormattedMessage {...colorTokenLabels[token]}/>}
                    trailingElements={currentColor === token ? (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg, #1c58d9)'
                        />
                    ) : undefined}
                />
            ))}
            {canDelete && <Menu.Separator/>}
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
        </Menu.Container>
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
     * Menu.Container wraps each chip in a <button>. Reset the button's default
     * box model so chip spacing matches the read-only protected variant above.
     */
    .property-option-chip-button,
    & .property-option-chip-button:focus,
    & .property-option-chip-button:hover {
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        min-height: 0;
        line-height: normal;
        box-shadow: none;
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

const Chip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    cursor: pointer;
    user-select: none;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.12);
    }
`;

const ReadonlyChip = styled(Chip)`
    cursor: default;
    background-color: rgba(var(--center-channel-color-rgb), 0.06);

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.06);
    }
`;

const ChipLabel = styled.span`
    white-space: nowrap;
`;

const ColorSwatch = styled.span`
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
`;

/* Wraps a small ColorSwatch into the 18px slot menu items reserve for icons,
   so it is optically centred next to the menu item label and the trailing
   check icon (16px). */
const SwatchIcon = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
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
`;

