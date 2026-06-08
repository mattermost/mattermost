// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {KeyboardEvent} from 'react';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {components} from 'react-select';

import {CheckIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption, UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';

import {DangerText} from './controls';
import RankBadge from './rank_badge';
import {moveOptionByAscIndex, nextRank, sortOptionsByRankAsc} from './rank_utils';

import './user_properties_rank_values.scss';

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

    const setOptions = (newOptions: PropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options: newOptions}});
    };

    const handleRename = (ascIndex: number, name: string) => {
        const trimmed = name.trim();
        if (!trimmed || ascOptions[ascIndex]?.name === trimmed) {
            return;
        }

        // Ignore a rename that would collide with another option's name.
        if (options.some((option, i) => option.name === trimmed && i !== options.indexOf(ascOptions[ascIndex]))) {
            return;
        }
        setOptions(ascOptions.map((option, i) => (i === ascIndex ? {...option, name: trimmed} : option)));
    };

    const handleMoveToPosition = (ascIndex: number, targetAscIndex: number) => {
        setOptions(moveOptionByAscIndex(options, ascIndex, targetAscIndex));
    };

    const handleRemove = (ascIndex: number) => {
        setOptions(ascOptions.filter((_, i) => i !== ascIndex));
    };

    const addValue = () => {
        if (!trimmedQuery || isDuplicate) {
            return;
        }
        setOptions([...options, {id: '', name: trimmedQuery, rank: nextRank(options)}]);
        setQuery('');
    };

    const handleQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addValue();
        }
    };

    return (
        <div className='user-property-rank-values'>
            <div className='user-property-rank-values__chips'>
                {ascOptions.map((option, ascIndex) => (
                    <RankChip
                        key={option.id || option.name}
                        option={option}
                        ascIndex={ascIndex}
                        sortedRanks={sortedRanks}
                        disabled={isDisabled}
                        onRename={handleRename}
                        onMoveToPosition={handleMoveToPosition}
                        onRemove={handleRemove}
                    />
                ))}
                {!isDisabled && (
                    <input
                        ref={addInputRef}
                        type='text'
                        className='user-property-rank-values__add-input'
                        value={query}
                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                        placeholder={formatMessage({
                            id: 'admin.system_properties.user_properties.rank_values.add_placeholder',
                            defaultMessage: 'Add value…',
                        })}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleQueryKeyDown}
                        onBlur={addValue}
                    />
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
    onRename: (ascIndex: number, name: string) => void;
    onMoveToPosition: (ascIndex: number, targetAscIndex: number) => void;
    onRemove: (ascIndex: number) => void;
};

// A single ranked chip plus its inline editing popover. Owns the label-edit
// draft so the popover's items can be direct children of Menu.Container.
const RankChip = ({option, ascIndex, sortedRanks, disabled, onRename, onMoveToPosition, onRemove}: RankChipProps) => {
    const {formatMessage} = useIntl();
    const total = sortedRanks.length;
    const [label, setLabel] = useState(option.name);

    useEffect(() => {
        setLabel(option.name);
    }, [option.name]);

    const commitLabel = () => onRename(ascIndex, label);

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
        >
            <RankBadge rank={option.rank}/>
            <Menu.Container
                menuButton={{
                    id: chipId,
                    class: 'user-property-rank-values__chip-name',
                    children: (
                        <span className='user-property-rank-values__chip-label'>{option.name}</span>
                    ),
                    dataTestId: chipId,
                    disabled,
                }}
                menu={{
                    id: `${chipId}-popover`,
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
                    value={label}
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
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
