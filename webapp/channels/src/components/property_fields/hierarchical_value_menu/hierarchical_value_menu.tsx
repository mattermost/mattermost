// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, useIntl} from 'react-intl';

import {
    AlertOutlineIcon,
    CheckboxBlankOutlineIcon,
    CheckboxMarkedIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {GraphOccurrence, GraphOptionJoin} from '../graph_option_tree';
import {
    alsoUnderLabel,
    expandToSelected,
    flattenSearch,
    joinGraphOptions,
    selectedDescendantCount,
} from '../graph_option_tree';
import {pageAllPropertyFieldOptions} from '../page_all_property_field_options';

import './hierarchical_value_menu.scss';

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
    nInside: {
        id: 'property_fields.hierarchical_value_menu.n_inside',
        defaultMessage: '{count} inside',
    },
    loading: {
        id: 'property_fields.hierarchical_value_menu.loading',
        defaultMessage: 'Loading values…',
    },
    error: {
        id: 'property_fields.hierarchical_value_menu.error',
        defaultMessage: 'These values could not be loaded.',
    },
    errorMissingIdentity: {
        id: 'property_fields.hierarchical_value_menu.error_missing_identity',
        defaultMessage: 'This attribute is missing the information needed to load its values.',
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
    pendingValue: {
        id: 'property_fields.hierarchical_value_menu.pending_value',
        defaultMessage: 'Loading value',
    },
});

export type HierarchicalValueMenuField = {
    id?: string;
    object_type?: string;
    type?: string;
    attrs?: {
        options?: PropertyFieldOption[];
        options_omitted?: boolean;
        options_count?: number;
        access_mode?: '' | 'source_only' | 'shared_only';
    };
};

export type HierarchicalValueMenuProps = {

    // The resolved field this menu reads. Never a template, never linked_field_id.
    field: HierarchicalValueMenuField;

    // Selection is always by option id. A stale id with no option in the fetched
    // set stays in here and stays emitted.
    selectedIds: string[];
    onSelectedIdsChange: (ids: string[]) => void;

    // Fetch once on mount, closed, so chips can show names on first paint.
    // Assignment-only: policy chips are already names.
    prefetchOnMount?: boolean;

    disabled?: boolean;

    // id -> last known name, for a selected id the fetch does not return.
    fallbackLabels?: Record<string, string>;

    // Fires with the join of every successful fetch, never on abort or error.
    // Must be memoised by the caller: its identity is a fetch dependency.
    onOptionsLoaded?: (join: GraphOptionJoin) => void;

    // Also fires once with `false` on mount, because Menu.Container does.
    onMenuOpenChange?: (open: boolean) => void;

    // Must start with `value-selector-menu` at the policy call site: the
    // Playwright spec locates the popup with [id^="value-selector-menu"].
    menuId: string;
    buttonId: string;

    // `valueSelectorMenuButton` at the policy call site.
    buttonDataTestId?: string;

    placeholder?: string;

    // Accessible name for the trigger and the menu. Defaults to the placeholder.
    ariaLabel?: string;

    className?: string;
    buttonClassName?: string;

    // Rendered after the chips inside the trigger. Phase 4 passes <MaskedChip/>.
    trailingChips?: ReactNode;

    // Appended after the rows inside the <ul>. Must be an array rather than a
    // fragment: MUI's MenuList console.errors on a Fragment child.
    extraMenuItems?: ReactNode[];
};

type ChipLabel = {
    text: string;
    pending: boolean;
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
    'error_missing_identity' |
    'withheld' |
    'empty' |
    'no_results';

const STATUS_MESSAGES: Record<HierarchicalMenuStatusKind, MessageDescriptor> = {
    loading: messages.loading,
    error_fetch: messages.error,
    error_missing_identity: messages.errorMissingIdentity,
    withheld: messages.withheld,
    empty: messages.empty,
    no_results: messages.noResults,
};

const ROW_BASE_INSET = 20;
const ROW_DEPTH_INSET = 16;

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
                const {text, pending} = labelForId(id);

                return (
                    <span
                        key={id}
                        className={classNames('hierarchical-value-menu__chip', {
                            'hierarchical-value-menu__chip--pending': pending,
                        })}
                    >
                        <span className='hierarchical-value-menu__chip-label'>{text}</span>
                        {!disabled && (
                            <span
                                className='hierarchical-value-menu__chip-remove'
                                role='button'
                                tabIndex={0}
                                aria-label={pending ? formatMessage(messages.pendingValue) : formatMessage(messages.removeValue, {name: text})}

                                // Both handlers stop propagation because this control
                                // lives inside the menu trigger button: without it,
                                // removing a chip also opens the menu.
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
                    // Everything but Tab and Escape is swallowed here: the Popover
                    // closes the menu on Space and Enter, and MUI's MenuList would
                    // read arrows as row navigation. Those two have to get through
                    // -- Tab for closeMenuOnTab, Escape for the Modal's own close.
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
    const isError = kind === 'error_fetch' || kind === 'error_missing_identity';

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
                        // Space and Enter would otherwise reach the Popover, which
                        // closes the menu on both.
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

type HierarchicalValueRowProps = {
    rowId: string;
    label: string;
    hint: string | null;
    depth: number;
    isBranch: boolean;
    isExpanded: boolean;
    isSelected: boolean;
    insideCount: number;
    isFirstRow: boolean;
    onToggleSelect: () => void;
    onToggleExpand: () => void;
    onFocusSearch: (seedChar: string) => void;
    innerRef: (element: HTMLLIElement | null) => void;
} & Record<string, unknown>;

const HierarchicalValueRow = ({
    rowId,
    label,
    hint,
    depth,
    isBranch,
    isExpanded,
    isSelected,
    insideCount,
    isFirstRow,
    onToggleSelect,
    onToggleExpand,
    onFocusSearch,
    innerRef,
    ...rest
}: HierarchicalValueRowProps) => {
    const {formatMessage} = useIntl();
    const showInsideCount = isBranch && !isExpanded && insideCount > 0;
    const insideCountId = `${rowId}-inside`;

    // The hit split, prototype polarity: the checkbox selects, and on a branch
    // everything else -- name, hint, count, chevron, and the row's own padding --
    // expands. A leaf and a search row have nothing to expand, so they select
    // wherever they are clicked.
    const activate = (event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        // ButtonBase synthesises a click from an Enter keydown after our own
        // onKeyDown has already acted on it. Handling it again would toggle twice.
        if (event.type === 'keydown') {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (isBranch && !target?.closest('[data-hit="select"]')) {
            onToggleExpand();
            return;
        }

        onToggleSelect();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
        // Space and Enter select on a branch as much as on a leaf: the row is a
        // menuitemcheckbox and its activation is its checkbox.
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelect();
            return;
        }

        if (event.key === 'ArrowRight') {
            if (isBranch && !isExpanded) {
                event.preventDefault();
                event.stopPropagation();
                onToggleExpand();
            }
            return;
        }

        if (event.key === 'ArrowLeft') {
            if (isBranch && isExpanded) {
                event.preventDefault();
                event.stopPropagation();
                onToggleExpand();
            }
            return;
        }

        if (event.key === 'ArrowUp' && isFirstRow) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch('');
            return;
        }

        // A printable key belongs to the search box. Stopping propagation is also
        // what pre-empts MUI MenuList's own typeahead, which would otherwise move
        // focus between rows by label text.
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch(event.key);
        }

        // ArrowDown, ArrowUp on a later row, Home, End, Escape and Tab all fall
        // through to MUI's MenuList and to the Popover.
    };

    return (
        <Menu.Item
            id={rowId}
            ref={innerRef}
            role='menuitemcheckbox'
            forceCloseOnSelect={false}
            aria-checked={isSelected}
            aria-expanded={isBranch ? isExpanded : undefined}

            // Pins the accessible name to the label alone, so neither the hint
            // line nor the "{n} inside" count can leak into it.
            aria-label={label}
            aria-describedby={showInsideCount ? insideCountId : undefined}
            className={classNames('hierarchical-value-menu__row', {
                'hierarchical-value-menu__row--selected': isSelected,
            })}
            style={{paddingInlineStart: `${ROW_BASE_INSET + ((depth - 1) * ROW_DEPTH_INSET)}px`}}
            onClick={activate}
            onKeyDown={handleKeyDown}
            leadingElement={
                <span
                    className='hierarchical-value-menu__checkbox'
                    data-hit='select'
                    aria-hidden={true}
                >
                    {isSelected ? <CheckboxMarkedIcon size={16}/> : <CheckboxBlankOutlineIcon size={16}/>}
                </span>
            }
            labels={
                <span className='hierarchical-value-menu__labels'>
                    <span className='hierarchical-value-menu__label'>{label}</span>
                    {hint ? <span className='hierarchical-value-menu__hint'>{hint}</span> : null}
                </span>
            }
            trailingElements={
                <span className='hierarchical-value-menu__trailing'>
                    {showInsideCount ? (
                        <span
                            className='hierarchical-value-menu__count'
                            id={insideCountId}
                        >
                            {formatMessage(messages.nInside, {count: insideCount})}
                        </span>
                    ) : null}
                    {isBranch ? (
                        <span
                            className='hierarchical-value-menu__chevron'
                            aria-hidden={true}
                        >
                            {isExpanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                        </span>
                    ) : null}
                </span>
            }
            {...rest}
        />
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
    const [options, setOptions] = useState<PropertyFieldOption[] | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    const [errorKind, setErrorKind] = useState<'fetch_failed' | 'missing_identity' | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    // Monotonic request id, belt-and-braces next to abort: the shared walk keeps
    // running after we abort, and a co-caller can still deliver.
    const seqRef = useRef(0);

    // Menu.Container reports onToggle(false) once on mount; only a real close
    // aborts and resets.
    const wasOpenRef = useRef(false);
    const prefetchedRef = useRef(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const join = useMemo(() => joinGraphOptions(options ?? []), [options]);
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
            return {text: name, pending: false};
        }

        const fallback = fallbackLabels?.[id];
        if (fallback) {
            return {text: fallback, pending: false};
        }

        // Nothing has been fetched yet, so the id is not known to be stale.
        if (options === null && (status === 'idle' || status === 'loading')) {
            return {text: '', pending: true};
        }

        // The fetch settled and this id is not in it. Keep the chip, keep the
        // selection, keep emitting: a policy's rule must not shrink on its own.
        return {text: id, pending: false};
    }, [join, fallbackLabels, options, status]);

    const runFetch = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        const seq = seqRef.current + 1;
        seqRef.current = seq;

        // A plugin mount may hand us a field with neither. The pager answers []
        // for that, which is indistinguishable from an empty graph, so the check
        // happens here and the request is never made.
        if (!field.id || !field.object_type) {
            setStatus('error');
            setErrorKind('missing_identity');
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;

        setStatus('loading');
        setErrorKind(null);

        pageAllPropertyFieldOptions(
            {id: field.id, object_type: field.object_type},
            {signal: controller.signal},
        ).then(
            (fetched) => {
                if (seqRef.current !== seq) {
                    return;
                }
                setOptions(fetched);
                setErrorKind(null);

                // Announced before the status flips to 'loaded': an adapter may
                // translate the reported join into a different selectedIds, and
                // expand-to-selected seeds off the first 'loaded' render.
                onOptionsLoaded?.(joinGraphOptions(fetched));
                setStatus('loaded');
            },
            (error: unknown) => {
                if (seqRef.current !== seq) {
                    return;
                }

                // An abort is this widget closing or unmounting, not a failure the
                // user can act on. The shared walk is not cancellable, so every
                // aborted caller lands here.
                if ((error as {name?: string} | null)?.name === 'AbortError') {
                    return;
                }

                setStatus('error');
                setErrorKind('fetch_failed');
            },
        );
    }, [field.id, field.object_type, onOptionsLoaded]);

    // Fetch on every open. A graph is never cached: a stale tree is worse than a
    // second walk, and the pager keeps no result cache anyway.
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

    // Assignment only: chips need names before the menu is ever opened.
    useEffect(() => {
        if (prefetchOnMount && !prefetchedRef.current) {
            prefetchedRef.current = true;
            runFetch();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Dependency-free so it survives every unmount path, including the policy
    // row being omitted after its last value is unchecked.
    useEffect(() => () => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    // Seeded once per open, when the tree first exists. Not re-seeded when the
    // selection changes: once the menu is open, expansion belongs to the user.
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
                const isExpanded = isBranch && open.has(node.occKey);
                rows.push({
                    occKey: node.occKey,
                    valueId: node.valueId,
                    label: node.label,
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

    // options_count is tested for truthiness deliberately: a genuinely empty
    // graph reports 0 or omits the key, and that case has to be allowed to say
    // there are no values.
    const isWithheld = useMemo(() => {
        const attrs = field.attrs;
        return Boolean(
            attrs?.options_omitted ||
            attrs?.options_count ||
            attrs?.access_mode === 'source_only' ||
            attrs?.access_mode === 'shared_only',
        );
    }, [field.attrs]);

    const statusKind = useMemo<HierarchicalMenuStatusKind | null>(() => {
        if (status === 'error') {
            return errorKind === 'missing_identity' ? 'error_missing_identity' : 'error_fetch';
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
        return isWithheld ? 'withheld' : 'empty';
    }, [status, errorKind, visibleRows.length, isSearching, isWithheld]);

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
        }
    }, [visibleRows]);

    // A factory rather than an inline arrow so the map is not churned on every
    // render by a fresh callback ref.
    const setRowRef = useCallback((occKey: string) => (element: HTMLLIElement | null) => {
        if (element) {
            rowRefs.current.set(occKey, element);
        } else {
            rowRefs.current.delete(occKey);
        }
    }, []);

    // A flat array, never a fragment: MUI's MenuList console.errors on one, and
    // arrow navigation only walks direct children of the <ul>.
    const menuChildren: ReactNode[] = [];

    if (statusKind) {
        menuChildren.push(
            <Menu.Item
                key='status'
                id={`${menuId}-status`}
                role='menuitem'

                // aria-disabled rather than MUI's `disabled`: that sets
                // pointer-events: none on the row, which would make the nested
                // Retry button unclickable. MenuList's moveFocus skips a row on
                // aria-disabled too, so arrow keys still step past this one.
                aria-disabled={true}
                disableCloseOnSelect={true}
                className='hierarchical-value-menu__status'
                labels={
                    <HierarchicalMenuStatus
                        kind={statusKind}
                        onRetry={statusKind === 'error_fetch' ? runFetch : undefined}
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

                    // The search box owns focus on open; MUI must not take it for
                    // the first row.
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
