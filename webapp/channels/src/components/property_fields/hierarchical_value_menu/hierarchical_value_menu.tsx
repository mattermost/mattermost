// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, useIntl} from 'react-intl';

import {
    AlertOutlineIcon,
    ChevronDownIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import HierarchicalValueRow, {isKeydownSynthesisedClick} from './hierarchical_value_row';

import type {GraphOccurrence, GraphOptionJoin} from '../graph';
import {
    alsoUnderLabel,
    expandToSelected,
    flattenSearch,
    joinGraphOptions,
    selectedDescendantCount,
} from '../graph';
import {pageAllAccessControlFieldOptions} from '../graph/page_all_access_control_field_options';
import type {GraphFieldRef} from '../graph/page_all_access_control_field_options';

import './hierarchical_value_menu.scss';

export type {GraphFieldRef};

const messages = defineMessages({
    selectValues: {
        id: 'property_fields.hierarchical_value_menu.select_values',
        defaultMessage: 'Select values...',
    },
    searchPlaceholder: {
        id: 'property_fields.hierarchical_value_menu.search',
        defaultMessage: 'Search values',
    },
    alsoUnder: {
        id: 'property_fields.hierarchical_value_menu.also_under',
        defaultMessage: 'Also under {names}',
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
    unavailableValue: {
        id: 'property_fields.hierarchical_value_menu.unavailable_value',
        defaultMessage: 'Value unavailable',
    },
    removeUnnamedValue: {
        id: 'property_fields.hierarchical_value_menu.remove_unnamed_value',
        defaultMessage: 'Remove value',
    },
});

export const unavailableValueMessage = messages.unavailableValue;

export type HierarchicalValueMenuProps = {
    field: GraphFieldRef;

    // Option ids. A stale id with no fetched option stays selected and emitted.
    selectedIds: string[];
    onSelectedIdsChange: (ids: string[]) => void;

    // Fetch once on mount so chips can show names before the menu opens.
    prefetchOnMount?: boolean;

    disabled?: boolean;

    // Last known name for a selected id the fetch does not return.
    fallbackLabels?: Record<string, string>;

    // Successful fetches only. Caller must memoise: an unstable identity re-announces every render.
    onOptionsLoaded?: (join: GraphOptionJoin) => void;

    onMenuOpenChange?: (open: boolean) => void;

    // Policy rows must keep the `value-selector-menu` prefix for Playwright.
    menuId: string;
    buttonId: string;
    buttonDataTestId?: string;

    placeholder?: string;
    ariaLabel?: string;

    className?: string;
    buttonClassName?: string;

    trailingChips?: ReactNode;

    // Array, not a fragment: MenuList console.errors on Fragment children.
    extraMenuItems?: ReactNode[];
};

type ChipLabel = {
    text: string;
    state: 'named' | 'pending' | 'unavailable';
};

type VisibleRow = {
    occKey: string;
    valueId: string;
    label: string;
    hint: string | null;
    depth: number;
    isBranch: boolean;
    isExpanded: boolean;
    insideCount: number;
};

type HierarchicalMenuStatusKind =
    | 'loading' |
    'error_fetch' |
    'withheld' |
    'empty' |
    'no_results';

const STATUS_MESSAGES: Record<HierarchicalMenuStatusKind, MessageDescriptor> = {
    loading: messages.loading,
    error_fetch: messages.error,
    withheld: messages.withheld,
    empty: messages.empty,
    no_results: messages.noResults,
};

type SelectedValueChipsProps = {
    selectedIds: string[];
    labelForId: (id: string) => ChipLabel;
    disabled: boolean;
    onRemove: (id: string) => void;
    trailingChips?: ReactNode;
};

const SelectedValueChips = ({selectedIds, labelForId, disabled, onRemove, trailingChips}: SelectedValueChipsProps) => {
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
};

type HierarchicalMenuSearchProps = {
    inputName: string;
    value: string;
    disabled: boolean;
    onChange: (next: string) => void;
    onArrowDown: () => void;
    inputRef: React.Ref<HTMLInputElement>;
};

const HierarchicalMenuSearch = ({inputName, value, disabled, onChange, onArrowDown, inputRef}: HierarchicalMenuSearchProps) => {
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
};

type HierarchicalMenuStatusProps = {
    kind: HierarchicalMenuStatusKind;
    onRetry?: () => void;
};

const HierarchicalMenuStatus = ({kind, onRetry}: HierarchicalMenuStatusProps) => {
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
};

export default function HierarchicalValueMenu({
    field,
    selectedIds,
    onSelectedIdsChange,
    prefetchOnMount = false,
    disabled,
    fallbackLabels,
    onOptionsLoaded,
    onMenuOpenChange,
    menuId,
    buttonId,
    buttonDataTestId,
    placeholder,
    ariaLabel,
    className,
    buttonClassName,
    trailingChips,
    extraMenuItems,
}: HierarchicalValueMenuProps) {
    const {formatMessage} = useIntl();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [expandedOccKeys, setExpandedOccKeys] = useState<Set<string> | null>(null);

    const [loaded, setLoaded] = useState<{options: PropertyFieldOption[]; join: GraphOptionJoin} | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

    const abortRef = useRef<AbortController | null>(null);

    // Shared walks keep running after abort; ignore late results from a stale request.
    const seqRef = useRef(0);

    // Menu.Container reports onToggle(false) on mount; only a real close aborts.
    const wasOpenRef = useRef(false);
    const prefetchedRef = useRef(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());
    const statusRowRef = useRef<HTMLLIElement | null>(null);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const emptyJoin = useMemo(() => joinGraphOptions([]), []);
    const options = loaded?.options ?? null;
    const join = loaded?.join ?? emptyJoin;

    const isSearching = query.trim() !== '';
    const searchRows = useMemo(
        () => (isSearching ? flattenSearch(options ?? [], query) : []),
        [isSearching, options, query],
    );

    const resolvedPlaceholder = placeholder ?? formatMessage(messages.selectValues);
    const resolvedAriaLabel = ariaLabel ?? resolvedPlaceholder;

    const labelForId = useCallback((id: string): ChipLabel => {
        const name = join.byId.get(id)?.name;
        if (name) {
            return {text: name, state: 'named'};
        }

        const fallback = fallbackLabels?.[id];
        if (fallback) {
            return {text: fallback, state: 'named'};
        }

        if (status === 'error') {
            return {text: formatMessage(messages.unavailableValue), state: 'unavailable'};
        }

        if (status !== 'loaded') {
            return {text: '', state: 'pending'};
        }

        // Successful read omitted this id: keep it selected. For a stale policy name the id is the name.
        return {text: id, state: 'named'};
    }, [join, fallbackLabels, status, formatMessage]);

    const runFetch = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        const seq = seqRef.current + 1;
        seqRef.current = seq;

        const controller = new AbortController();
        abortRef.current = controller;

        setStatus('loading');

        pageAllAccessControlFieldOptions(
            {id: field.id, object_type: field.object_type},
            {signal: controller.signal},
        ).then(
            (fetched) => {
                if (seqRef.current !== seq) {
                    return;
                }
                const fetchedJoin = joinGraphOptions(fetched);
                setLoaded({options: fetched, join: fetchedJoin});

                // Same commit as the status flip so expand-to-selected seeds from the hydrated ids.
                onOptionsLoaded?.(fetchedJoin);
                setStatus('loaded');
            },
            (error: unknown) => {
                if (seqRef.current !== seq) {
                    return;
                }

                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                setStatus('error');
            },
        );
    }, [field.id, field.object_type, onOptionsLoaded]);

    useEffect(() => {
        if (isOpen) {
            wasOpenRef.current = true;
            runFetch();
            return;
        }

        if (!wasOpenRef.current) {
            return;
        }
        wasOpenRef.current = false;
        abortRef.current?.abort();
        abortRef.current = null;
        setQuery('');
        setExpandedOccKeys(null);
    }, [isOpen, runFetch]);

    useEffect(() => {
        if (prefetchOnMount && !prefetchedRef.current) {
            prefetchedRef.current = true;
            runFetch();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => () => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    // Seed expansion once per open; after that the user owns it.
    useEffect(() => {
        if (!isOpen || status !== 'loaded' || expandedOccKeys !== null) {
            return;
        }
        setExpandedOccKeys(expandToSelected(join.roots, selectedIdSet));
    }, [isOpen, status, expandedOccKeys, join, selectedIdSet]);

    useEffect(() => {
        if (isOpen) {
            searchInputRef.current?.focus();
        }
    }, [isOpen]);

    const visibleRows = useMemo<VisibleRow[]>(() => {
        if (isSearching) {
            return searchRows.map((row) => ({
                occKey: `search::${row.valueId}`,
                valueId: row.valueId,
                label: row.label,
                hint: row.path || null,
                depth: 1,
                isBranch: false,
                isExpanded: false,
                insideCount: 0,
            }));
        }

        const open = expandedOccKeys ?? new Set<string>();
        const rows: VisibleRow[] = [];

        const walk = (nodes: GraphOccurrence[], depth: number) => {
            for (const node of nodes) {
                const isBranch = node.children.length > 0;
                const isExpanded = isBranch && open.has(node.key);
                rows.push({
                    occKey: node.key,
                    valueId: node.valueKey,
                    label: node.option.name,
                    hint: node.alsoUnder.length > 0 ? formatMessage(messages.alsoUnder, {names: alsoUnderLabel(node.alsoUnder)}) : null,
                    depth,
                    isBranch,
                    isExpanded,
                    insideCount: isBranch && !isExpanded ? selectedDescendantCount(node, selectedIdSet) : 0,
                });
                if (isExpanded) {
                    walk(node.children, depth + 1);
                }
            }
        };

        walk(join.roots, 1);
        return rows;
    }, [isSearching, searchRows, expandedOccKeys, join, selectedIdSet, formatMessage]);

    const isWithheld = useMemo(() => {
        const attrs = field.attrs;
        return Boolean(
            attrs?.options_omitted ||
            attrs?.access_mode === 'source_only' ||
            attrs?.access_mode === 'shared_only',
        );
    }, [field.attrs]);

    const statusKind = useMemo<HierarchicalMenuStatusKind | null>(() => {
        if (status === 'error') {
            return 'error_fetch';
        }
        if (status === 'idle' || status === 'loading') {
            return 'loading';
        }
        if (visibleRows.length > 0) {
            return null;
        }
        if (isSearching) {
            return 'no_results';
        }
        if (isWithheld) {
            return 'withheld';
        }

        // A cycle can yield no roots from a non-empty list; only an empty graph is empty.
        return options?.length ? null : 'empty';
    }, [status, visibleRows.length, isSearching, isWithheld, options]);

    const handleToggle = useCallback((open: boolean) => {
        setIsOpen(open);
        onMenuOpenChange?.(open);
    }, [onMenuOpenChange]);

    const handleToggleSelect = useCallback((valueId: string) => {
        onSelectedIdsChange(
            selectedIds.includes(valueId) ? selectedIds.filter((id) => id !== valueId) : [...selectedIds, valueId],
        );
    }, [selectedIds, onSelectedIdsChange]);

    const handleToggleExpand = useCallback((occKey: string) => {
        setExpandedOccKeys((current) => {
            const next = new Set(current ?? []);
            if (next.has(occKey)) {
                next.delete(occKey);
            } else {
                next.add(occKey);
            }
            return next;
        });
    }, []);

    const handleRemoveChip = useCallback((id: string) => {
        onSelectedIdsChange(selectedIds.filter((selected) => selected !== id));
    }, [selectedIds, onSelectedIdsChange]);

    const focusSearch = useCallback((seedChar: string) => {
        if (seedChar) {
            setQuery((current) => current + seedChar);
        }
        searchInputRef.current?.focus();
    }, []);

    const focusFirstRow = useCallback(() => {
        const first = visibleRows[0];
        if (first) {
            rowRefs.current.get(first.occKey)?.focus();
            return;
        }

        statusRowRef.current?.focus();
    }, [visibleRows]);

    const setRowRef = useCallback((occKey: string) => (element: HTMLLIElement | null) => {
        if (element) {
            rowRefs.current.set(occKey, element);
        } else {
            rowRefs.current.delete(occKey);
        }
    }, []);

    const isRetryableStatus = statusKind === 'error_fetch';

    const handleStatusActivate = (event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        if (isKeydownSynthesisedClick(event)) {
            return;
        }

        runFetch();
    };

    const handleStatusKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            runFetch();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            focusSearch('');
        }
    };

    const menuChildren: ReactNode[] = [];

    if (statusKind) {
        menuChildren.push(
            <Menu.Item
                key='status'
                id={`${menuId}-status`}
                ref={isRetryableStatus ? statusRowRef : undefined}
                role='menuitem'

                // `disabled` would set pointer-events: none on Retry. aria-disabled
                // lets MenuList skip message rows; the retryable row stays focusable
                // because AT treats menuitem descendants as presentational.
                aria-disabled={isRetryableStatus ? undefined : true}
                disableCloseOnSelect={true}
                className={classNames('hierarchical-value-menu__status', {
                    'hierarchical-value-menu__status--actionable': isRetryableStatus,
                })}
                onClick={isRetryableStatus ? handleStatusActivate : undefined}
                onKeyDown={isRetryableStatus ? handleStatusKeyDown : undefined}
                labels={
                    <HierarchicalMenuStatus
                        kind={statusKind}
                        onRetry={isRetryableStatus ? runFetch : undefined}
                    />
                }
            />,
        );
    } else {
        for (const [index, row] of visibleRows.entries()) {
            menuChildren.push(
                <HierarchicalValueRow
                    key={row.occKey}
                    rowId={`${menuId}-row-${row.occKey}`}
                    label={row.label}
                    hint={row.hint}
                    depth={row.depth}
                    isBranch={row.isBranch}
                    isExpanded={row.isExpanded}
                    isSelected={selectedIdSet.has(row.valueId)}
                    insideCount={row.insideCount}
                    isFirstRow={index === 0}
                    onToggleSelect={() => handleToggleSelect(row.valueId)}
                    onToggleExpand={() => handleToggleExpand(row.occKey)}
                    onFocusSearch={focusSearch}
                    innerRef={setRowRef(row.occKey)}
                />,
            );
        }
    }

    if (extraMenuItems) {
        menuChildren.push(...extraMenuItems);
    }

    return (
        <div className={classNames('hierarchical-value-menu', className)}>
            <Menu.Container
                menuButton={{
                    id: buttonId,
                    dataTestId: buttonDataTestId,
                    class: classNames('hierarchical-value-menu__button', buttonClassName, {disabled}),
                    disabled,
                    'aria-label': resolvedAriaLabel,
                    children: (
                        <span className='hierarchical-value-menu__button-inner'>
                            {selectedIds.length === 0 && !trailingChips ? (
                                <span className='hierarchical-value-menu__placeholder'>
                                    {resolvedPlaceholder}
                                </span>
                            ) : (
                                <SelectedValueChips
                                    selectedIds={selectedIds}
                                    labelForId={labelForId}
                                    disabled={Boolean(disabled)}
                                    onRemove={handleRemoveChip}
                                    trailingChips={trailingChips}
                                />
                            )}
                            <ChevronDownIcon
                                size={18}
                                color='rgba(var(--center-channel-color-rgb), 0.5)'
                            />
                        </span>
                    ),
                }}
                menu={{
                    id: menuId,
                    'aria-label': resolvedAriaLabel,
                    className: 'hierarchical-value-menu__menu',
                    onToggle: handleToggle,
                    autoFocusItem: false,
                }}
                menuHeader={
                    <HierarchicalMenuSearch
                        inputName={`${menuId}-search`}
                        value={query}
                        disabled={Boolean(disabled)}
                        onChange={setQuery}
                        onArrowDown={focusFirstRow}
                        inputRef={searchInputRef}
                    />
                }
            >
                {menuChildren}
            </Menu.Container>
        </div>
    );
}
