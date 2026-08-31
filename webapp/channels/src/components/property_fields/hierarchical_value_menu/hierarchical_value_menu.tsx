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
    // Must be memoised by the caller: an unstable identity re-announces the
    // current join on every render.
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

    // named       -- text is the option's name, or the last name we knew for it.
    // pending     -- nothing has been read yet; text is empty and the chip is a
    //                skeleton.
    // unavailable -- the read failed, so nothing at all is known about this id.
    //                Not the same as pending: there is no walk to wait for.
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

                                // Named after what the control does, not after the
                                // chip's state: this button removes the value in
                                // every state, including while its name is still
                                // being read.
                                aria-label={state === 'named' ? formatMessage(messages.removeValue, {name: text}) : formatMessage(messages.removeUnnamedValue)}

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

    // The fetched options and the tree built from them, as one state because they
    // must never disagree. Holding the join here rather than deriving it means one
    // walk per fetch instead of one for the render and another for the announce,
    // and it means the caller is handed the very join this menu renders.
    const [loaded, setLoaded] = useState<{options: PropertyFieldOption[]; join: GraphOptionJoin} | null>(null);
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

    // Only ever set for a retryable status row, which is the one status row that
    // may take focus.
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

        // A read that failed says nothing about this id, so it is not stale and
        // it is not loading either. An omitted-options assignment field supplies
        // no fallbackLabels at all, so on a 403/404 this is the only branch its
        // chips can reach -- and a raw identifier is never an acceptable chip.
        if (status === 'error') {
            return {text: formatMessage(messages.unavailableValue), state: 'unavailable'};
        }

        // Nothing has been read yet, so the id is not known to be stale.
        if (status !== 'loaded') {
            return {text: '', state: 'pending'};
        }

        // A successful read settled and this id is not in it. Keep the chip, keep
        // the selection, keep emitting: a policy's rule must not shrink on its
        // own. Only this branch may show the id, and only because for a stale
        // policy name the id *is* the name.
        return {text: id, state: 'named'};
    }, [join, fallbackLabels, status, formatMessage]);

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
                const fetchedJoin = joinGraphOptions(fetched);
                setLoaded({options: fetched, join: fetchedJoin});
                setErrorKind(null);

                // Announced from inside this callback, in the same batch as the
                // status flip, and NOT from an effect keyed on the options.
                //
                // The order of these two lines does not matter -- React 18
                // batches them either way, so the reordering the plan and the
                // implementation summary argued about is unobservable. What does
                // matter is that both land in one commit: an adapter translates
                // this join into a different `selectedIds`, and the
                // expand-to-selected effect seeds once off the first 'loaded'
                // render. Announce a commit later and it seeds from the
                // pre-hydration selection, leaving an omitted-payload policy row
                // opened to a collapsed tree. Locked by `hydrates from the
                // fetched options when the payload omitted them` and by
                // `opens expanded to a hydrated selection`.
                onOptionsLoaded?.(fetchedJoin);
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
        if (isWithheld) {
            return 'withheld';
        }

        // visibleRows comes from join.roots, and an option is only a root when it
        // has no resolvable parent -- so a parent cycle yields no roots from a
        // non-empty option list. Only a genuinely empty graph may say it has no
        // values. With options but no rows the menu shows no message at all: the
        // values are real and still reachable by typing.
        return options?.length ? null : 'empty';
    }, [status, errorKind, visibleRows.length, isSearching, isWithheld, options]);

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

        // No rows means a status row is showing, and if that row is retryable it
        // is the only focusable thing in the list. The search box swallows
        // ArrowDown before MenuList sees it, so this is the only way focus gets
        // there -- and without it Retry has no keyboard route at all.
        statusRowRef.current?.focus();
    }, [visibleRows]);

    // The returned closure is fresh on every render, so React does detach and
    // reattach every row ref each render, exactly as an inline arrow would. That
    // is harmless here -- the detach deletes the key and the attach re-adds it in
    // the same commit, and nothing reads the map in between -- but it is not an
    // optimisation, so do not read it as one.
    const setRowRef = useCallback((occKey: string) => (element: HTMLLIElement | null) => {
        if (element) {
            rowRefs.current.set(occKey, element);
        } else {
            rowRefs.current.delete(occKey);
        }
    }, []);

    // The retryable error row is the one status row that does something, so it is
    // the only one that may take focus.
    const isRetryableStatus = statusKind === 'error_fetch';

    const handleStatusActivate = (event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        // The keyboard path belongs to handleStatusKeyDown. See
        // isKeydownSynthesisedClick: without this Enter would retry twice.
        if (isKeydownSynthesisedClick(event)) {
            return;
        }

        runFetch();
    };

    const handleStatusKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            // The Popover closes the menu on both, and recovering from a failed
            // read must not close the thing being recovered.
            event.preventDefault();
            event.stopPropagation();
            runFetch();
            return;
        }

        // Same as a first row: the only thing above this is the search box.
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            focusSearch('');
        }
    };

    // A flat array, never a fragment: MUI's MenuList console.errors on one, and
    // arrow navigation only walks direct children of the <ul>.
    const menuChildren: ReactNode[] = [];

    if (statusKind) {
        menuChildren.push(
            <Menu.Item
                key='status'
                id={`${menuId}-status`}
                ref={isRetryableStatus ? statusRowRef : undefined}
                role='menuitem'

                // aria-disabled rather than MUI's `disabled`: that sets
                // pointer-events: none on the row, which would make the nested
                // Retry button unclickable in a browser.
                //
                // A message row stays aria-disabled so MenuList's moveFocus steps
                // past it. The retryable row does not, because it has to be
                // reachable: Tab closes the menu (closeMenuOnTab), the arrows skip
                // anything aria-disabled, and WAI-ARIA 1.2 makes a menuitem's DOM
                // descendants presentational -- so real assistive tech never
                // exposes the nested Retry <button> at all, however green a jsdom
                // role query looks. Carrying the action on the row itself is what
                // gives a keyboard or AT user any route to recovery other than
                // guessing that closing and reopening refetches.
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
