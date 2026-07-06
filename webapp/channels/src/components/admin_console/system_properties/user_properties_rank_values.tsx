// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {KeyboardEvent, MouseEvent} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {components} from 'react-select';
import {css} from 'styled-components';

import {CheckIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import * as Menu from 'components/menu';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import {DangerText} from './controls';
import RankBadge from './rank_badge';
import {moveOptionByAscIndex, nextRank, sortOptionsByRankAsc} from './rank_utils';

import './user_properties_rank_values.scss';

// Tighten the shared MenuItemInput's bottom padding (10px → 4px) so the label
// input sits closer to the Rank submenu item below it; its top/side padding is
// left at the shared 10px. The popover list's own 8px padding is dropped
// separately (see the .MuiList-root rule in the scss) so the spacing reads right.
const labelInputCustomStyles = css`
    padding-bottom: 4px;
`;

type Props = {
    field: UserPropertyField;
    updateField: (field: UserPropertyField) => void;
    autoFocus?: boolean;
};

// Renders a ranked field's options as numbered chips in ascending rank order
// (lowest on the left), each opening a popover for quick label/rank/remove edits,
// plus an input that appends a new value with the next rank.
const UserPropertyRankValues = ({field, updateField, autoFocus}: Props) => {
    const {formatMessage} = useIntl();
    const [query, setQuery] = useState('');

    const options = useMemo(() => field.attrs.options ?? [], [field.attrs.options]);
    const ascOptions = useMemo(() => sortOptionsByRankAsc(options), [options]);
    const sortedRanks = useMemo(() => ascOptions.map((option) => option.rank ?? 0), [ascOptions]);

    const isDisabled = field.delete_at !== 0;

    const addInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus) {
            addInputRef.current?.focus();
        }
    }, [autoFocus]);

    const trimmedQuery = query.trim();
    const isDuplicate = useMemo(
        () => Boolean(trimmedQuery) && options.some((option) => option.name === trimmedQuery),
        [options, trimmedQuery],
    );

    const setOptions = useCallback((newOptions: PropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options: newOptions}});
    }, [field, updateField]);

    // Whether `name` already belongs to an option other than the one at
    // exceptAscIndex (an index into the ascending-rank ordering). Names are
    // compared exactly, matching the add-value duplicate check below.
    const nameCollidesWith = useCallback(
        (name: string, exceptAscIndex: number) =>
            ascOptions.some((option, i) => i !== exceptAscIndex && option.name === name),
        [ascOptions],
    );

    const handleRename = useCallback((ascIndex: number, name: string) => {
        const trimmed = name.trim();
        if (!trimmed || ascOptions[ascIndex]?.name === trimmed) {
            return;
        }

        // Block a rename that would collide with another option's name. The chip
        // surfaces the duplicate inline, so this no-op isn't a silent dead end.
        if (nameCollidesWith(trimmed, ascIndex)) {
            return;
        }
        setOptions(ascOptions.map((option, i) => (i === ascIndex ? {...option, name: trimmed} : option)));
    }, [ascOptions, nameCollidesWith, setOptions]);

    const handleMoveToPosition = useCallback((ascIndex: number, targetAscIndex: number) => {
        setOptions(moveOptionByAscIndex(options, ascIndex, targetAscIndex));
    }, [options, setOptions]);

    const handleRemove = useCallback((ascIndex: number) => {
        setOptions(ascOptions.filter((_, i) => i !== ascIndex));
    }, [ascOptions, setOptions]);

    const addValue = useCallback(() => {
        if (!trimmedQuery || isDuplicate) {
            return;
        }
        setOptions([...options, {id: '', name: trimmedQuery, rank: nextRank(options)}]);
        setQuery('');
    }, [trimmedQuery, isDuplicate, options, setOptions]);

    const handleQueryKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        // Commit the pending value on Enter, and on Tab when there's a valid value
        // to add — keeping focus in the input for the next value, mirroring the
        // select/multiselect values cell. A blank or duplicate input lets Tab move
        // focus away normally.
        if (event.key === 'Enter') {
            event.preventDefault();
            addValue();
        } else if (event.key === 'Tab' && trimmedQuery && !isDuplicate) {
            event.preventDefault();
            addValue();
        }
    }, [addValue, trimmedQuery, isDuplicate]);

    const placeholderText = formatMessage({
        id: 'admin.system_properties.user_properties.table.values.placeholder',
        defaultMessage: 'Add values… (required)',
    });

    // Mirror react-select: the placeholder shows only in the empty state, not once
    // values have been added.
    const showPlaceholder = ascOptions.length === 0;

    const focusInput = useCallback((event: MouseEvent<HTMLDivElement>) => {
        // The auto-sized input only spans its text, so clicking the well's empty
        // space focuses it — like react-select's control. Clicks on a chip, its
        // popover trigger, or the remove button (children) keep their own behavior.
        if (event.target === event.currentTarget) {
            event.preventDefault();
            addInputRef.current?.focus();
        }
    }, []);

    return (
        <div
            className='user-property-rank-values'
            data-testid='user-property-rank-values'
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mousedown only forwards focus to the keyboard-accessible add input, mirroring react-select's control */}
            <div
                className='user-property-rank-values__chips'
                onMouseDown={focusInput}
            >
                {ascOptions.map((option, ascIndex) => (
                    <RankChip
                        key={option.id || option.name}
                        option={option}
                        ascIndex={ascIndex}
                        sortedRanks={sortedRanks}
                        disabled={isDisabled}
                        nameCollidesWith={nameCollidesWith}
                        onRename={handleRename}
                        onMoveToPosition={handleMoveToPosition}
                        onRemove={handleRemove}
                    />
                ))}
                {!isDisabled && (
                    <span
                        className='user-property-rank-values__add-sizer'
                        data-value={query || (showPlaceholder ? placeholderText : '')}
                    >
                        <input
                            ref={addInputRef}
                            type='text'
                            className='user-property-rank-values__add-input'
                            data-testid='user-property-rank-values__add-input'
                            value={query}
                            maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                            placeholder={showPlaceholder ? placeholderText : undefined}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleQueryKeyDown}
                            onBlur={addValue}
                        />
                    </span>
                )}
            </div>
            {isDuplicate && (
                <DangerText>
                    {formatMessage({
                        id: 'admin.system_properties.user_properties.table.validation.values_unique',
                        defaultMessage: 'Values must be unique.',
                    })}
                </DangerText>
            )}
        </div>
    );
};

type RankChipProps = {
    option: PropertyFieldOption;
    ascIndex: number;
    sortedRanks: number[];
    disabled: boolean;
    nameCollidesWith: (name: string, exceptAscIndex: number) => boolean;
    onRename: (ascIndex: number, name: string) => void;
    onMoveToPosition: (ascIndex: number, targetAscIndex: number) => void;
    onRemove: (ascIndex: number) => void;
};

// A single ranked chip plus its inline editing popover. Owns the label-edit
// draft so the popover's items can be direct children of Menu.Container.
const RankChip = ({option, ascIndex, sortedRanks, disabled, nameCollidesWith, onRename, onMoveToPosition, onRemove}: RankChipProps) => {
    const {formatMessage} = useIntl();
    const total = sortedRanks.length;
    const [label, setLabel] = useState(option.name);

    useEffect(() => {
        setLabel(option.name);
    }, [option.name]);

    const commitLabel = useCallback(() => onRename(ascIndex, label), [onRename, ascIndex, label]);

    // Surface a duplicate-name collision inline beneath the label input, mirroring
    // the add-value flow, so a blocked rename gives feedback instead of silently
    // reverting. Memoized so its stable reference doesn't retrigger the input's
    // customMessage effect on every keystroke.
    const trimmedLabel = label.trim();
    const labelError = useMemo<CustomMessageInputType>(() => {
        if (!trimmedLabel || !nameCollidesWith(trimmedLabel, ascIndex)) {
            return null;
        }
        return {
            type: 'error',
            value: formatMessage({
                id: 'admin.system_properties.user_properties.table.validation.values_unique',
                defaultMessage: 'Values must be unique.',
            }),
        };
    }, [trimmedLabel, nameCollidesWith, ascIndex, formatMessage]);

    const chipId = `rank-chip-${option.id || option.name}`;

    const rankSuffix = (() => {
        if (ascIndex === 0) {
            return formatMessage({
                id: 'admin.system_properties.user_properties.rank_popover.lowest',
                defaultMessage: '{rank} (Lowest)',
            }, {rank: option.rank});
        }
        if (ascIndex === total - 1) {
            return formatMessage({
                id: 'admin.system_properties.user_properties.rank_popover.highest',
                defaultMessage: '{rank} (Highest)',
            }, {rank: option.rank});
        }
        return String(option.rank);
    })();

    const removeLabel = formatMessage({
        id: 'admin.system_properties.user_properties.rank_popover.remove',
        defaultMessage: 'Remove option',
    });

    return (
        <span
            className={classNames('user-property-rank-values__chip', {
                'user-property-rank-values__chip--disabled': disabled,
            })}
            data-testid='user-property-rank-values__chip'
        >
            <RankBadge rank={option.rank}/>
            <Menu.Container
                menuButton={{
                    id: chipId,
                    class: 'user-property-rank-values__chip-name',
                    children: (
                        <span
                            className='user-property-rank-values__chip-label'
                            data-testid='user-property-rank-values__chip-label'
                        >{option.name}</span>
                    ),
                    dataTestId: chipId,
                    disabled,
                }}
                menu={{
                    id: `${chipId}-popover`,
                    className: 'user-property-rank-values__popover-list',
                    'aria-label': formatMessage({
                        id: 'admin.system_properties.user_properties.rank_popover.aria_label',
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
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                    customMessage={labelError}
                    placeholder={formatMessage({
                        id: 'admin.system_properties.user_properties.rank_popover.label_placeholder',
                        defaultMessage: 'Option label',
                    })}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        // Let Escape bubble so the popover closes and focus returns to
                        // the chip. Stop other keys from reaching the menu's
                        // type-ahead/navigation while the label is being edited.
                        if (e.key === 'Escape') {
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
                    id={`${chipId}-rank`}
                    menuId={`${chipId}-rank-menu`}
                    labels={(
                        <span>{formatMessage({
                            id: 'admin.system_properties.user_properties.rank_popover.rank',
                            defaultMessage: 'Rank',
                        })}</span>
                    )}
                    trailingElements={(
                        <>
                            <span className='user-property-rank-values__rank-current'>{rankSuffix}</span>
                            <ChevronRightIcon size={16}/>
                        </>
                    )}
                    forceOpenOnLeft={false}
                >
                    {sortedRanks.map((rankValue, position) => (
                        <Menu.Item
                            key={rankValue}
                            id={`${chipId}-rank-${position}`}
                            role='menuitemradio'
                            forceCloseOnSelect={true}
                            aria-checked={position === ascIndex}
                            onClick={() => onMoveToPosition(ascIndex, position)}
                            labels={<span>{rankValue}</span>}
                            trailingElements={position === ascIndex ? <CheckIcon size={16}/> : undefined}
                        />
                    ))}
                </Menu.SubMenu>
            </Menu.Container>
            {!disabled && (
                <button
                    type='button'
                    className='user-property-rank-values__chip-remove'
                    data-testid={`${chipId}-remove`}
                    onClick={() => onRemove(ascIndex)}
                    aria-label={removeLabel}
                >
                    <components.CrossIcon size={14}/>
                </button>
            )}
        </span>
    );
};

export default UserPropertyRankValues;
