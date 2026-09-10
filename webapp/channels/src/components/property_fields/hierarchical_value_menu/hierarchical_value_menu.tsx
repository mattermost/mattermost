// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

import {
    HierarchicalMenuSearch,
    HierarchicalMenuStatus,
    SelectedValueChips,
    hierarchicalMenuStatusKind,
    isGraphFieldWithheld,
} from './hierarchical_value_menu_parts';
import type {ChipLabel} from './hierarchical_value_menu_parts';
import HierarchicalValueRow, {isKeydownSynthesisedClick} from './hierarchical_value_row';

import type {GraphOccurrence, GraphOptionJoin} from '../graph';
import {
    alsoUnderLabel,
    expandToSelected,
    flattenSearch,
    selectedDescendantCount,
} from '../graph';
import {unavailableValueMessage} from '../graph/graph_value_summary';
import type {GraphFieldRef} from '../graph/page_all_access_control_field_options';
import {useGraphOptionJoin} from '../graph/use_graph_option_join';

import './hierarchical_value_menu.scss';

export type {GraphFieldRef};

const messages = defineMessages({
    selectValues: {
        id: 'property_fields.hierarchical_value_menu.select_values',
        defaultMessage: 'Select values...',
    },
    alsoUnder: {
        id: 'property_fields.hierarchical_value_menu.also_under',
        defaultMessage: 'Also under {names}',
    },
});

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

    const {options, join, status, refetch} = useGraphOptionJoin(field, {
        prefetch: prefetchOnMount,
        open: isOpen,
        onOptionsLoaded,
    });

    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());
    const statusRowRef = useRef<HTMLLIElement | null>(null);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
            return {text: formatMessage(unavailableValueMessage), state: 'unavailable'};
        }

        if (status !== 'loaded') {
            return {text: '', state: 'pending'};
        }

        // Successful read omitted this id: keep it selected. For a stale policy name the id is the name.
        return {text: id, state: 'named'};
    }, [join, fallbackLabels, status, formatMessage]);

    useEffect(() => {
        if (isOpen) {
            return;
        }
        setQuery('');
        setExpandedOccKeys(null);
    }, [isOpen]);

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

    const isWithheld = useMemo(() => isGraphFieldWithheld(field.attrs), [field.attrs]);
    const statusKind = useMemo(
        () => hierarchicalMenuStatusKind({
            status,
            visibleRowCount: visibleRows.length,
            isSearching,
            isWithheld,
            optionCount: options?.length ?? null,
        }),
        [status, visibleRows.length, isSearching, isWithheld, options],
    );

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

        refetch();
    };

    const handleStatusKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            refetch();
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
                        onRetry={isRetryableStatus ? refetch : undefined}
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
