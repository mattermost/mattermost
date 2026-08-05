// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent} from 'react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {components} from 'react-select';
import {css} from 'styled-components';

import {CheckIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import RankBadge from 'components/admin_console/system_properties/rank_badge';
import {moveOptionByAscIndex, nextRank, sortOptionsByRankAsc} from 'components/admin_console/system_properties/rank_utils';
import * as Menu from 'components/menu';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {useOptionChipEditor} from './use_option_chip_editor';

import './attribute_options_rank_values.scss';

const labelInputCustomStyles = css`
    padding-bottom: 4px;
`;

type Props = {
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    disabled?: boolean;
};

// Renders a ranked field's options as numbered chips in ascending rank order
// (lowest on the left), each opening a popover for quick label/rank/remove edits,
// plus an input that appends a new value with the next rank. Ports the
// interaction shape of system_properties/user_properties_rank_values.tsx,
// trimmed of CPA-only concerns (sync/owners/plugin/delete_at) that don't apply
// to a brand-new, unsaved attribute draft. Shared add/remove/rename/duplicate
// logic lives in use_option_chip_editor.ts, consumed by this and the
// Select/Multiselect editor.
const AttributeOptionsRankValues = ({options, onOptionsChange, disabled = false}: Props) => {
    const {formatMessage} = useIntl();

    const ascOptions = useMemo(() => sortOptionsByRankAsc(options), [options]);
    const sortedRanks = useMemo(() => ascOptions.map((option) => option.rank ?? 0), [ascOptions]);

    const buildNewOption = useCallback(
        (name: string): PropertyFieldOption => ({id: '', name, rank: nextRank(options)}),
        [options],
    );

    const {
        query, setQuery, addInputRef, isDuplicate, nameCollidesWith,
        handleRename, handleRemove, addValue, handleQueryKeyDown,
        placeholderText, showPlaceholder, focusInput, maxOptionNameLength,
    } = useOptionChipEditor({orderedOptions: ascOptions, onOptionsChange, buildNewOption});

    const handleMoveToPosition = useCallback((ascIndex: number, targetAscIndex: number) => {
        onOptionsChange(moveOptionByAscIndex(options, ascIndex, targetAscIndex));
    }, [options, onOptionsChange]);

    return (
        <div
            className='attribute-options-rank-values'
            data-testid='attributeOptionsRankValues'
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mousedown only forwards focus to the keyboard-accessible add input */}
            <div
                className='attribute-options-rank-values__chips'
                onMouseDown={focusInput}
            >
                {ascOptions.map((option, ascIndex) => (
                    <RankChip
                        key={option.id || option.name}
                        option={option}
                        ascIndex={ascIndex}
                        sortedRanks={sortedRanks}
                        maxOptionNameLength={maxOptionNameLength}
                        nameCollidesWith={nameCollidesWith}
                        onRename={handleRename}
                        onMoveToPosition={handleMoveToPosition}
                        onRemove={handleRemove}
                        disabled={disabled}
                    />
                ))}
                <span
                    className='attribute-options-rank-values__add-sizer'
                    data-value={query || (showPlaceholder ? placeholderText : '')}
                >
                    <input
                        ref={addInputRef}
                        type='text'
                        className='attribute-options-rank-values__add-input'
                        data-testid='attributeOptionsRankValues__addInput'
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
                    className='attribute-options-rank-values__danger-text'
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

type RankChipProps = {
    option: PropertyFieldOption;
    ascIndex: number;
    sortedRanks: number[];
    maxOptionNameLength: number;
    nameCollidesWith: (name: string, exceptAscIndex: number) => boolean;
    onRename: (ascIndex: number, name: string) => void;
    onMoveToPosition: (ascIndex: number, targetAscIndex: number) => void;
    onRemove: (ascIndex: number) => void;
    disabled?: boolean;
};

// A single ranked chip plus its inline editing popover.
const RankChip = ({option, ascIndex, sortedRanks, maxOptionNameLength, nameCollidesWith, onRename, onMoveToPosition, onRemove, disabled = false}: RankChipProps) => {
    const {formatMessage} = useIntl();
    const total = sortedRanks.length;
    const [label, setLabel] = useState(option.name);

    useEffect(() => {
        setLabel(option.name);
    }, [option.name]);

    const commitLabel = useCallback(() => onRename(ascIndex, label), [onRename, ascIndex, label]);

    const trimmedLabel = label.trim();
    const labelError = useMemo<CustomMessageInputType>(() => {
        if (!trimmedLabel || !nameCollidesWith(trimmedLabel, ascIndex)) {
            return null;
        }
        return {
            type: 'error',
            value: formatMessage({
                id: 'admin.global_attributes.attribute_details.options.values_unique',
                defaultMessage: 'Values must be unique.',
            }),
        };
    }, [trimmedLabel, nameCollidesWith, ascIndex, formatMessage]);

    // Index-based, not name-based: an option name is free-form user text and
    // may contain characters that aren't valid in an HTML id (e.g. spaces),
    // unlike the React `key` above (which is fine being name-based since it
    // only needs to be unique, not a valid id string).
    const chipId = `attribute-rank-chip-${ascIndex}`;

    const rankSuffix = (() => {
        if (ascIndex === 0) {
            return formatMessage({
                id: 'admin.global_attributes.attribute_details.options.rank_lowest',
                defaultMessage: '{rank} (Lowest)',
            }, {rank: option.rank});
        }
        if (ascIndex === total - 1) {
            return formatMessage({
                id: 'admin.global_attributes.attribute_details.options.rank_highest',
                defaultMessage: '{rank} (Highest)',
            }, {rank: option.rank});
        }
        return String(option.rank);
    })();

    const removeLabel = formatMessage({
        id: 'admin.global_attributes.attribute_details.options.remove_option',
        defaultMessage: 'Remove option',
    });

    return (
        <span
            className='attribute-options-rank-values__chip'
            data-testid='attributeOptionsRankValues__chip'
        >
            <RankBadge rank={option.rank}/>
            <Menu.Container
                menuButton={{
                    id: chipId,
                    class: 'attribute-options-rank-values__chip-name',
                    disabled,
                    children: (
                        <span
                            className='attribute-options-rank-values__chip-label'
                            data-testid='attributeOptionsRankValues__chipLabel'
                        >{option.name}</span>
                    ),
                    dataTestId: chipId,
                }}
                menu={{
                    id: `${chipId}-popover`,
                    className: 'attribute-options-rank-values__popover-list',
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
                    id={`${chipId}-rank`}
                    menuId={`${chipId}-rank-menu`}
                    labels={(
                        <span>{formatMessage({
                            id: 'admin.global_attributes.attribute_details.options.rank_menu_label',
                            defaultMessage: 'Rank',
                        })}</span>
                    )}
                    trailingElements={(
                        <>
                            <span className='attribute-options-rank-values__rank-current'>{rankSuffix}</span>
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
            <button
                type='button'
                className='attribute-options-rank-values__chip-remove'
                data-testid={`${chipId}-remove`}
                onClick={() => onRemove(ascIndex)}
                aria-label={removeLabel}
                disabled={disabled}
            >
                <components.CrossIcon size={14}/>
            </button>
        </span>
    );
};

export default AttributeOptionsRankValues;
