// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {CheckIcon, CloseCircleIcon, LockOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {supportsOptions} from '@mattermost/types/properties';
import {type BoardsPropertyField, type BoardsPropertyFieldOption} from '@mattermost/types/properties_board';

import * as Menu from 'components/menu';

import {useFLIPAnimation} from 'hooks/use_flip_animation';
import {
    COLOR_DESCRIPTOR,
    BOARDS_COLOR_TOKEN_NAMES,
    type BoardsColorToken,
    normalizeColor,
} from 'utils/board_property_colors';

import {ValidationWarningOptionsUnique, canEditFieldOptions, isOptionNameTaken, newPendingId} from './board_attributes_utils';
import {useBoardOptionDnd} from './hooks/use_board_option_dnd';
import {useBoardOptionsDnd} from './hooks/use_board_options_dnd';

import {DangerText} from '../system_properties/controls';

const MAX_OPTION_NAME_LENGTH = 64;

type Props = {
    field: BoardsPropertyField;
    updateField: (field: BoardsPropertyField) => void;
    warning?: string;
    autoFocus?: boolean;
};

const BoardAttributesValues = ({field, updateField, warning}: Props) => {
    const {formatMessage} = useIntl();
    const containerRef = useRef<HTMLDivElement | null>(null);

    const isEditable = canEditFieldOptions(field);

    const options = field.attrs?.options ?? [];

    const setOptions = (next: BoardsPropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options: next}});
    };

    const chipKeys = options.map((option) => option.id);
    useFLIPAnimation({
        items: chipKeys,
        getElement: (key) => containerRef.current?.querySelector<HTMLElement>(`[data-flip-key="${key}"]`) ?? null,
    });

    useBoardOptionsDnd({fieldId: field.id, options, setOptions, enabled: isEditable});

    if (!supportsOptions(field)) {
        return (
            <EmptyValues>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {'—'}
            </EmptyValues>
        );
    }

    if (field.protected) {
        // Reuse the editable layout — same ValuesContainer, same ChipDropZone,
        // same ChipShell — so protected and editable rows align by construction
        // rather than by keeping two separate styled trees in sync.
        return (
            <WithTooltip
                title={formatMessage({
                    id: 'admin.board_attributes.values.protected_tooltip',
                    defaultMessage: 'System attribute options cannot be modified',
                })}
            >
                <ValuesContainer data-testid='property-values-readonly'>
                    {options.map((option) => (
                        <EditableChip
                            key={option.id}
                            option={option}
                            options={options}
                            setOptions={setOptions}
                            fieldId={field.id}
                            readonly={true}
                        />
                    ))}
                    <LockOutlineIcon
                        size={14}
                        color='rgba(var(--center-channel-color-rgb), 0.48)'
                    />
                </ValuesContainer>
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

    const handleAdd = () => {
        setOptions([...options, {id: newPendingId(), name: generateDefaultName()}]);
    };

    return (
        <>
            <ValuesContainer
                ref={containerRef}
                data-testid='property-values-input'
            >
                {options.map((option) => (
                    <EditableChip
                        key={option.id}
                        option={option}
                        options={options}
                        setOptions={setOptions}
                        fieldId={field.id}
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
    option: BoardsPropertyFieldOption;
    options: BoardsPropertyFieldOption[];
    setOptions: (next: BoardsPropertyFieldOption[]) => void;
    fieldId: string;

    // When true, render the chip with no menu, no delete affordance, and no
    // drag-and-drop wiring — but keep the exact same outer markup so
    // protected (Status) rows align pixel-for-pixel with editable rows.
    readonly?: boolean;
};

const EditableChip = ({option, options, setOptions, fieldId, readonly = false}: ChipProps) => {
    const {formatMessage} = useIntl();
    const [editValue, setEditValue] = useState(option.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const [chipElement, setChipElement] = useState<HTMLElement | null>(null);
    const [dropZoneElement, setDropZoneElement] = useState<HTMLElement | null>(null);
    const canDelete = options.length > 1;

    // Normalize once: unknown legacy values fall back to `default` consistently
    // across the chip's background, the drag preview, and the menu's
    // selected-state check.
    const color = normalizeColor(option.color);

    // The committed name conflicts with a sibling — render the chip with a
    // red border so the conflict is visible without opening the dropdown.
    const isInvalid = isOptionNameTaken(option.name, options, option);

    useEffect(() => {
        setEditValue(option.name);
    }, [option.name]);

    const optionKey = option.id;
    const {closestEdge} = useBoardOptionDnd({
        fieldId,
        optionKey,
        chipElement,
        dropZoneElement,
        getDragPreview: () => {
            const node = document.createElement('span');
            node.className = 'BoardAttributes__optionDragPreview';
            node.style.backgroundColor = COLOR_DESCRIPTOR[color].color;
            node.textContent = option.name;
            return node;
        },
    });

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

    const setColor = (color: BoardsColorToken) => {
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

    if (readonly) {
        // Same outer wrappers as the editable chip so protected chips align
        // pixel-for-pixel with editable ones (no separate ReadonlyChip
        // styled component to drift over time). No Menu.Container, no
        // delete button, and the chip + dropzone refs stay unset so
        // useBoardOptionDnd never wires up DnD for this option.
        return (
            <ChipDropZone data-flip-key={option.id}>
                <ChipShell
                    $invalid={false}
                    $readonly={true}
                    style={{backgroundColor: COLOR_DESCRIPTOR[color].color}}
                >
                    <span
                        className='property-option-chip-trigger'
                        data-testid={`property-option-chip-${option.id || option.name}`}
                    >
                        <ChipLabel>{option.name}</ChipLabel>
                    </span>
                </ChipShell>
            </ChipDropZone>
        );
    }

    return (
        <ChipDropZone
            ref={setDropZoneElement}
            data-flip-key={option.id}
        >
            <ChipShell
                ref={setChipElement}
                $invalid={isInvalid}
                style={{backgroundColor: COLOR_DESCRIPTOR[color].color}}
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
                    {BOARDS_COLOR_TOKEN_NAMES.map((token) => (
                        <Menu.Item
                            key={token}
                            id={`${menuId}-color-${token}`}
                            role='menuitemradio'
                            aria-checked={color === token}
                            forceCloseOnSelect={false}
                            onClick={() => setColor(token)}
                            leadingElement={<ColorPreview style={{backgroundColor: COLOR_DESCRIPTOR[token].color}}/>}
                            labels={<FormattedMessage {...COLOR_DESCRIPTOR[token].label}/>}
                            trailingElements={color === token ? (
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
                            defaultMessage: 'Delete option {name}',
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
            {closestEdge && <DropIndicator edge={closestEdge}/>}
        </ChipDropZone>
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
    row-gap: 3px;
    column-gap: 0;
    align-items: center;
    padding: 6px 0;
    min-height: 40px;
`;

const ChipDropZone = styled.span`
    position: relative;
    display: inline-flex;
    padding: 0 3px;
`;

/* Outer pill: takes the option's colour as background, holds the menu-trigger
   button and the inline X delete button as siblings so they render as one
   visual chip but remain individually focusable. Read-only chips reuse this
   same shell (via EditableChip's `readonly` branch) so protected and editable
   rows align by construction.
   position: relative is required so DropIndicator (absolute-positioned) clips
   to the chip boundary.

   All chip-internal CSS lives on this component (trigger button reset, focus
   ring, readonly variant) so the rules are scoped to a single chip rather
   than to whatever container the chip happens to render inside. */
const ChipShell = styled.span<{$invalid?: boolean; $readonly?: boolean}>`
    position: relative;
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    user-select: none;
    cursor: ${({$readonly}) => ($readonly ? 'default' : 'grab')};
    transition: filter 0.15s ease, box-shadow 0.15s ease;

    &:active {
        cursor: ${({$readonly}) => ($readonly ? 'default' : 'grabbing')};
    }

    ${({$readonly}) => !$readonly && css`
        &:hover {
            filter: brightness(0.97);
        }
    `}

    ${({$invalid}) => $invalid && css`
        box-shadow: 0 0 0 1px var(--error-text);
    `}

    /* Trigger element inside the chip: the menu button in editable mode, a
       plain <span> wrapping the label in readonly mode. Same class either
       way; readonly-specific tweaks are conditional on $readonly below. */
    .property-option-chip-trigger {
        padding: 2px 4px 2px 8px;
        margin: 0;
        border: 0;
        background: transparent;
        min-height: 0;
        line-height: normal;
        box-shadow: none;
        outline: none;
        color: var(--center-channel-color);
        font-family: 'Open Sans';
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }

    /* Keyboard focus ring on the trigger button — mirrors ChipDeleteButton's
       pattern. Mouse focus (:focus without :focus-visible) stays ring-less. */
    .property-option-chip-trigger:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
        border-radius: 4px;
    }

    ${({$readonly}) => $readonly && css`
        /* Readonly: balance the right padding (no trailing X), and use the
           default cursor since the span has no menu to open. */
        .property-option-chip-trigger {
            padding-right: 8px;
            cursor: default;
        }
    `}
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

/* Rounded-square colour preview shown inside menu items. 20px square with a
   1px hairline border, per Figma node 696:91067. Rendered as a block so it
   centres on the parent flex row's cross-axis without inheriting an
   inline-block baseline offset. */
const ColorPreview = styled.span`
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
    align-self: center;
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

