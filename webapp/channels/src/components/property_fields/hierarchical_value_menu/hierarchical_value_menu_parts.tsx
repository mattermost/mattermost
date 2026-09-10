// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, useIntl} from 'react-intl';

import {
    AlertOutlineIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';

import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {GraphFieldRef} from '../page_all_property_field_options';

const messages = defineMessages({
    searchPlaceholder: {
        id: 'property_fields.hierarchical_value_menu.search',
        defaultMessage: 'Search values',
    },
    loading: {
        id: 'property_fields.hierarchical_value_menu.loading',
        defaultMessage: 'Loading values…',
    },
    error: {
        id: 'property_fields.hierarchical_value_menu.error',
        defaultMessage: 'These values could not be loaded.',
    },
    retry: {
        id: 'property_fields.hierarchical_value_menu.retry',
        defaultMessage: 'Retry',
    },
    withheld: {
        id: 'property_fields.hierarchical_value_menu.withheld',
        defaultMessage: 'The values for this attribute are not available to you here.',
    },
    empty: {
        id: 'property_fields.hierarchical_value_menu.empty',
        defaultMessage: 'This attribute has no values yet.',
    },
    noResults: {
        id: 'property_fields.hierarchical_value_menu.no_results',
        defaultMessage: 'No values match.',
    },
    removeValue: {
        id: 'property_fields.hierarchical_value_menu.remove_value',
        defaultMessage: 'Remove {name}',
    },
    removeUnnamedValue: {
        id: 'property_fields.hierarchical_value_menu.remove_unnamed_value',
        defaultMessage: 'Remove value',
    },
});

export type ChipLabel = {
    text: string;
    state: 'named' | 'pending' | 'unavailable';
};

type GraphJoinStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type HierarchicalMenuStatusKind =
    | 'loading'
    | 'error_fetch'
    | 'withheld'
    | 'empty'
    | 'no_results';

const STATUS_MESSAGES: Record<HierarchicalMenuStatusKind, MessageDescriptor> = {
    loading: messages.loading,
    error_fetch: messages.error,
    withheld: messages.withheld,
    empty: messages.empty,
    no_results: messages.noResults,
};

export function isGraphFieldWithheld(attrs: GraphFieldRef['attrs']): boolean {
    return Boolean(
        attrs?.options_omitted ||
        attrs?.access_mode === 'source_only' ||
        attrs?.access_mode === 'shared_only',
    );
}

export function hierarchicalMenuStatusKind(input: {
    status: GraphJoinStatus;
    visibleRowCount: number;
    isSearching: boolean;
    isWithheld: boolean;
    optionCount: number | null;
}): HierarchicalMenuStatusKind | null {
    if (input.status === 'error') {
        return 'error_fetch';
    }
    if (input.status === 'idle' || input.status === 'loading') {
        return 'loading';
    }
    if (input.visibleRowCount > 0) {
        return null;
    }
    if (input.isSearching) {
        return 'no_results';
    }
    if (input.isWithheld) {
        return 'withheld';
    }

    // A cycle can yield no roots from a non-empty list; only an empty graph is empty.
    return input.optionCount ? null : 'empty';
}

export type SelectedValueChipsProps = {
    selectedIds: string[];
    labelForId: (id: string) => ChipLabel;
    disabled: boolean;
    onRemove: (id: string) => void;
    trailingChips?: ReactNode;
};

export function SelectedValueChips({selectedIds, labelForId, disabled, onRemove, trailingChips}: SelectedValueChipsProps) {
    const {formatMessage} = useIntl();

    return (
        <span className='hierarchical-value-menu__chips'>
            {selectedIds.map((id) => {
                const {text, state} = labelForId(id);

                return (
                    <span
                        key={id}
                        className={classNames('hierarchical-value-menu__chip', {
                            'hierarchical-value-menu__chip--pending': state === 'pending',
                            'hierarchical-value-menu__chip--unavailable': state === 'unavailable',
                        })}
                    >
                        <span className='hierarchical-value-menu__chip-label'>{text}</span>
                        {!disabled && (
                            <span
                                className='hierarchical-value-menu__chip-remove'
                                role='button'
                                tabIndex={0}
                                aria-label={state === 'named' ? formatMessage(messages.removeValue, {name: text}) : formatMessage(messages.removeUnnamedValue)}

                                // Inside the trigger: without stopPropagation, remove also opens the menu.
                                onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    onRemove(id);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.stopPropagation();
                                        event.preventDefault();
                                        onRemove(id);
                                    }
                                }}
                            >
                                <CloseIcon size={12}/>
                            </span>
                        )}
                    </span>
                );
            })}
            {trailingChips}
        </span>
    );
}

export type HierarchicalMenuSearchProps = {
    inputName: string;
    value: string;
    disabled: boolean;
    onChange: (next: string) => void;
    onArrowDown: () => void;
    inputRef: React.Ref<HTMLInputElement>;
};

export function HierarchicalMenuSearch({inputName, value, disabled, onChange, onArrowDown, inputRef}: HierarchicalMenuSearchProps) {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage(messages.searchPlaceholder);

    return (
        <div
            className='hierarchical-value-menu__search'
            role='presentation'
        >
            <Input
                ref={inputRef as React.Ref<HTMLInputElement>}
                type='text'
                name={inputName}
                value={value}
                disabled={disabled}
                autoComplete='off'
                useLegend={false}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(event) => {
                    event.stopPropagation();
                    onChange(event.target.value);
                }}
                onKeyUp={(event) => {
                    event.stopPropagation();
                }}
                onKeyDown={(event) => {
                    // Swallow Space/Enter/arrows so the Popover and MenuList do not steal them.
                    // Tab and Escape still close the menu.
                    if (event.key !== 'Tab' && event.key !== 'Escape') {
                        event.stopPropagation();
                    }
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        onArrowDown();
                    }
                }}
            />
        </div>
    );
}

export type HierarchicalMenuStatusProps = {
    kind: HierarchicalMenuStatusKind;
    onRetry?: () => void;
};

export function HierarchicalMenuStatus({kind, onRetry}: HierarchicalMenuStatusProps) {
    const {formatMessage} = useIntl();
    const isError = kind === 'error_fetch';

    return (
        <span className='hierarchical-value-menu__status-inner'>
            {kind === 'loading' && <LoadingSpinner/>}
            {isError && <AlertOutlineIcon size={16}/>}
            <span>{formatMessage(STATUS_MESSAGES[kind])}</span>
            {onRetry && (
                <button
                    type='button'
                    className='hierarchical-value-menu__retry'
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        onRetry();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.stopPropagation();
                        }
                    }}
                >
                    {formatMessage(messages.retry)}
                </button>
            )}
        </span>
    );
}
