// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {DownloadOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import ExternalLink from 'components/external_link';
import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import KeyboardHints from './keyboard_hints';
import LogRow from './log_row';
import type {LogObjectWithAdditionalInfo} from './types';
import {formatLogValue} from './utils';

import './log_list.scss';

type TimePreset = {
    readonly label: MessageDescriptor;
    readonly minutes: number;
};

type Props = {
    loading: boolean;
    logs: LogObjectWithAdditionalInfo[];
    onSearchChange: (term: string) => void;
    search: string;

    // Owned by the parent, which sends them with the query
    enabledLevels: Set<string>;
    onEnabledLevelsChange: React.Dispatch<React.SetStateAction<Set<string>>>;

    onReload: () => void;
    downloadUrl: string;

    liveTailEnabled: boolean;
    onToggleLiveTail: () => void;
    pollInterval: number;
    onPollIntervalChange: (interval: number) => void;
    pollIntervals: readonly number[];
    pollIntervalLabels: Record<number, MessageDescriptor>;

    timePresets: readonly TimePreset[];
    activeTimePreset: number | null;
    onTimePreset: (minutes: number) => void;
    onClearTimePreset: () => void;

    // Rendered alongside the other filters so both viewers share one filter row
    logFormatMenu?: React.ReactNode;
};

const PAGE_SIZES = [50, 100, 200, 500] as const;
const DEFAULT_PAGE_SIZE = 200;

// Filtering runs over every fetched log entry, so keep it off the keystroke path
const SEARCH_DEBOUNCE_MS = 200;

// Rows are focused programmatically by the keyboard navigation below
const ROW_FOCUS_SELECTOR = '.LogRow__main';

const LEVEL_ORDER = ['error', 'warn', 'info', 'debug'] as const;
const LEVEL_LABELS = defineMessages({
    error: {id: 'admin.logs.level.error', defaultMessage: 'Error'},
    warn: {id: 'admin.logs.level.warn', defaultMessage: 'Warn'},
    info: {id: 'admin.logs.level.info', defaultMessage: 'Info'},
    debug: {id: 'admin.logs.level.debug', defaultMessage: 'Debug'},
});

const messages = defineMessages({
    allTime: {id: 'admin.logs.time.allTime', defaultMessage: 'All time'},
    allLevels: {id: 'admin.logs.allLevels', defaultMessage: 'All levels'},
    liveTail: {id: 'admin.logs.liveTail', defaultMessage: 'Live tail'},
    liveTailOff: {id: 'admin.logs.liveTail.off', defaultMessage: 'Off'},
});

const PREFS_KEY = 'mm_admin_logs_prefs';

type StoredPrefs = {
    pageSize: number;
    wrapText: boolean;
    enabledLevels: string[];
    sortAsc: boolean;
};

const DEFAULT_PREFS: StoredPrefs = {
    pageSize: DEFAULT_PAGE_SIZE,
    wrapText: true,
    enabledLevels: [...LEVEL_ORDER],
    sortAsc: false,
};

// Stored prefs may predate the current shape, so every field is validated
export function loadPrefs(): StoredPrefs {
    let stored: Partial<StoredPrefs> = {};
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                stored = parsed;
            }
        }
    } catch {
        // ignore
    }

    const levels = Array.isArray(stored.enabledLevels) ? stored.enabledLevels.filter(
        (level): level is string => LEVEL_ORDER.includes(level as typeof LEVEL_ORDER[number]),
    ) : [];

    return {
        pageSize: PAGE_SIZES.includes(stored.pageSize as typeof PAGE_SIZES[number]) ? stored.pageSize! : DEFAULT_PREFS.pageSize,
        wrapText: typeof stored.wrapText === 'boolean' ? stored.wrapText : DEFAULT_PREFS.wrapText,
        enabledLevels: levels.length > 0 ? levels : DEFAULT_PREFS.enabledLevels,
        sortAsc: typeof stored.sortAsc === 'boolean' ? stored.sortAsc : DEFAULT_PREFS.sortAsc,
    };
}

// Every field counts: concurrent requests log the same message, caller and millisecond
function logKey(log: LogObjectWithAdditionalInfo): string {
    return Object.keys(log).sort().map((field) => `${field}=${formatLogValue(log[field])}`).join('|');
}

// Content keys keep rows mounted across reloads; identical entries get a suffix
function getRowKeys(rows: LogObjectWithAdditionalInfo[]): string[] {
    const seen = new Map<string, number>();
    return rows.map((log) => {
        const key = logKey(log);
        const occurrence = seen.get(key) ?? 0;
        seen.set(key, occurrence + 1);
        return occurrence === 0 ? key : `${key}#${occurrence}`;
    });
}

// "2026-10-20 11:39:58.721 +02:00" isn't ISO 8601, and Safari can't parse it
function parseTimestamp(timestamp: string): number {
    return Date.parse(timestamp.replace(' ', 'T').replace(' ', ''));
}

function savePrefs(prefs: StoredPrefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

export default function LogList({
    loading, logs, onSearchChange, search,
    enabledLevels, onEnabledLevelsChange: setEnabledLevels,
    onReload, downloadUrl,
    liveTailEnabled, onToggleLiveTail, pollInterval, onPollIntervalChange,
    pollIntervals, pollIntervalLabels,
    timePresets, activeTimePreset, onTimePreset, onClearTimePreset,
    logFormatMenu,
}: Props) {
    const intl = useIntl();
    const initialPrefs = useMemo(() => loadPrefs(), []);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
    const [sortAsc, setSortAsc] = useState(initialPrefs.sortAsc);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    // Tracked by content so a reload keeps the selection on the same entry
    const [focusedKey, setFocusedKey] = useState<string | null>(null);
    const [wrapText, setWrapText] = useState(initialPrefs.wrapText);

    // Kept local so typing repaints the input without waiting for the debounced filtering
    const [searchInput, setSearchInput] = useState(search);

    const listRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const debouncedSearchChange = useMemo(
        () => debounce(onSearchChange, SEARCH_DEBOUNCE_MS),
        [onSearchChange],
    );

    useEffect(() => debouncedSearchChange.cancel, [debouncedSearchChange]);

    const handleSearchChange = useCallback((term: string) => {
        setSearchInput(term);
        debouncedSearchChange(term);
    }, [debouncedSearchChange]);

    const clearSearch = useCallback(() => {
        setSearchInput('');

        // Clearing is a deliberate action, so apply it without waiting
        debouncedSearchChange.cancel();
        onSearchChange('');
    }, [debouncedSearchChange, onSearchChange]);

    useEffect(() => {
        savePrefs({
            pageSize,
            wrapText,
            enabledLevels: Array.from(enabledLevels),
            sortAsc,
        });
    }, [pageSize, wrapText, enabledLevels, sortAsc]);

    const levelCounts = useMemo(() => {
        const counts: Record<string, number> = {error: 0, warn: 0, info: 0, debug: 0};
        for (const log of logs) {
            if (log.level in counts) {
                counts[log.level]++;
            }
        }
        return counts;
    }, [logs]);

    const allLevelsEnabled = useMemo(() => LEVEL_ORDER.every((level) => enabledLevels.has(level)), [enabledLevels]);

    const processedLogs = useMemo(() => {
        let filtered = logs;

        if (!allLevelsEnabled) {
            filtered = filtered.filter((log) => enabledLevels.has(log.level));
        }

        if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter((log) => Object.entries(log).some(([key, value]) =>
                key !== 'level' && key !== 'timestamp' && formatLogValue(value).toLowerCase().includes(lowerSearch),
            ));
        }

        // Ties fall back to file order so same-millisecond entries reverse too
        const direction = sortAsc ? 1 : -1;
        return filtered.
            map((log, index) => ({log, index, time: parseTimestamp(log.timestamp)})).
            sort((a, b) => direction * ((a.time - b.time) || (a.index - b.index))).
            map(({log}) => log);
    }, [logs, allLevelsEnabled, enabledLevels, search, sortAsc]);

    const matchCount = search ? processedLogs.length : null;
    const totalCount = logs.length;

    const totalPages = Math.max(1, Math.ceil(processedLogs.length / pageSize));
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, processedLogs.length);

    // Reusing the previous object for an unchanged entry lets memo(LogRow) skip it after a poll
    const rowsByKeyRef = useRef(new Map<string, LogObjectWithAdditionalInfo>());
    const {visibleLogs, rowKeys} = useMemo(() => {
        const pageLogs = processedLogs.slice(startIndex, endIndex);
        const keys = getRowKeys(pageLogs);
        const rows = pageLogs.map((log, i) => rowsByKeyRef.current.get(keys[i]) ?? log);
        rowsByKeyRef.current = new Map(keys.map((key, i) => [key, rows[i]]));
        return {visibleLogs: rows, rowKeys: keys};
    }, [processedLogs, startIndex, endIndex]);

    // Read by the row callbacks, which stay stable so memo(LogRow) holds
    const visibleLogsRef = useRef(visibleLogs);
    visibleLogsRef.current = visibleLogs;
    const rowKeysRef = useRef(rowKeys);
    rowKeysRef.current = rowKeys;

    // -1 while a poll or page change has moved the selected entry off this page
    const focusedIndex = focusedKey === null ? -1 : rowKeys.indexOf(focusedKey);

    const focusRow = useCallback((index: number) => {
        const row = listRef.current?.querySelectorAll(ROW_FOCUS_SELECTOR)[index] as HTMLElement | undefined;
        row?.focus();
        row?.scrollIntoView({block: 'nearest'});
    }, []);

    // Reset to page 0 when filters or sort order change
    useEffect(() => {
        setPage(0);
        setExpandedKey(null);
        setFocusedKey(null);
    }, [search, enabledLevels, sortAsc]);

    // Clamp the page when a reload or poll shrinks the dataset
    useEffect(() => {
        const lastPage = Math.max(0, Math.ceil(processedLogs.length / pageSize) - 1);
        setPage((prev) => Math.max(0, Math.min(prev, lastPage)));
    }, [processedLogs.length, pageSize]);

    const toggleLevel = useCallback((level: string) => {
        setEnabledLevels((prev) => {
            const next = new Set(prev);
            if (next.has(level)) {
                if (next.size > 1) {
                    next.delete(level);
                }
            } else {
                next.add(level);
            }
            return next;
        });
    }, [setEnabledLevels]);

    const enableAllLevels = useCallback(() => {
        setEnabledLevels(new Set<string>(LEVEL_ORDER));
    }, [setEnabledLevels]);

    // Ctrl/Cmd-click a level pill to show only that level; ctrl/cmd-click it again to restore all.
    const soloLevel = useCallback((level: string) => {
        setEnabledLevels((prev) => {
            if (prev.size === 1 && prev.has(level)) {
                return new Set<string>(LEVEL_ORDER);
            }
            return new Set([level]);
        });
    }, [setEnabledLevels]);

    // Identical entries share a log key, so the row key decides which one expands
    const handleToggleExpand = useCallback((log: LogObjectWithAdditionalInfo) => {
        const idx = visibleLogsRef.current.indexOf(log);
        const key = idx === -1 ? logKey(log) : rowKeysRef.current[idx];
        setExpandedKey((prev) => (prev === key ? null : key));
    }, []);

    const handleFocus = useCallback((log: LogObjectWithAdditionalInfo) => {
        const idx = visibleLogsRef.current.indexOf(log);
        setFocusedKey(idx === -1 ? null : rowKeysRef.current[idx]);
    }, []);

    const goNextPage = useCallback(() => {
        setPage((p) => Math.min(p + 1, totalPages - 1));
        setExpandedKey(null);
        listRef.current?.scrollTo({top: 0});
    }, [totalPages]);

    const goPrevPage = useCallback(() => {
        setPage((p) => Math.max(p - 1, 0));
        setExpandedKey(null);
        listRef.current?.scrollTo({top: 0});
    }, []);

    const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setPageSize(newSize);
        setPage(0);
        setExpandedKey(null);
        setFocusedKey(null);
    }, []);

    const toggleSort = useCallback(() => {
        setSortAsc((prev) => !prev);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
            e.preventDefault();
            if (visibleLogs.length === 0) {
                break;
            }
            const direction = e.key === 'ArrowDown' ? 1 : -1;
            const next = focusedIndex === -1 ? 0 : Math.min(Math.max(focusedIndex + direction, 0), visibleLogs.length - 1);
            setFocusedKey(rowKeys[next]);
            focusRow(next);
            break;
        }
        case 'Escape':
            setExpandedKey(null);
            break;
        case '/':
            e.preventDefault();
            searchInputRef.current?.focus();
            break;
        }
    }, [visibleLogs, rowKeys, focusedIndex, focusRow]);

    const activePresetLabel = timePresets.find((preset) => preset.minutes === activeTimePreset)?.label;
    const enabledLevelCount = LEVEL_ORDER.filter((level) => enabledLevels.has(level)).length;

    // One selector for on/off and the interval, so picking an interval turns polling on
    const setLiveTail = (interval: number | null) => {
        if (interval === null) {
            if (liveTailEnabled) {
                onToggleLiveTail();
            }
            return;
        }
        onPollIntervalChange(interval);
        if (!liveTailEnabled) {
            onToggleLiveTail();
        }
    };

    const filters = (
        <div className='LogViewer__filters admin-console__filters-rows'>
            <Input
                ref={searchInputRef}
                type='text'
                name='serverLogsSearch'
                containerClassName='LogViewer__search'
                placeholder={intl.formatMessage({id: 'admin.logs.search.placeholder', defaultMessage: 'Search logs'})}
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                inputPrefix={
                    <i
                        className='icon icon-magnify'
                        aria-hidden='true'
                    />
                }
                inputSuffix={searchInput ? (
                    <button
                        className='LogViewer__search-clear btn btn-icon btn-xs'
                        onClick={clearSearch}
                        type='button'
                        aria-label={intl.formatMessage({id: 'admin.logs.search.clear', defaultMessage: 'Clear search'})}
                    >
                        <i
                            className='icon icon-close'
                            aria-hidden='true'
                        />
                    </button>
                ) : undefined}
            />

            <Menu.Container
                menuButton={{
                    id: 'serverLogsLevelsMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.levels.menuButtonAriaLabel', defaultMessage: 'Open menu to select which log levels to show'}),
                    as: 'div',
                    children: (
                        <Input
                            label={intl.formatMessage({id: 'admin.logs.levels', defaultMessage: 'Levels'})}
                            name='serverLogsLevels'
                            value={allLevelsEnabled ? intl.formatMessage(messages.allLevels) : intl.formatMessage({id: 'admin.logs.levels.selected', defaultMessage: '{count} selected'}, {count: enabledLevelCount})}
                            readOnly={true}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: 'serverLogsLevelsMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.levels.dropdownAriaLabel', defaultMessage: 'Log levels menu'}),
                    width: '260px',
                }}
            >
                {LEVEL_ORDER.map((level) => (
                    <Menu.Item
                        key={level}
                        id={`serverLogsLevel-${level}`}
                        role='menuitemcheckbox'
                        aria-checked={enabledLevels.has(level)}
                        leadingElement={
                            <i className={enabledLevels.has(level) ? 'icon icon-checkbox-marked' : 'icon icon-checkbox-blank-outline'}/>
                        }
                        labels={<FormattedMessage {...LEVEL_LABELS[level]}/>}

                        // Disabled levels aren't fetched, so there is nothing to count
                        trailingElements={enabledLevels.has(level) && <span className='LogViewer__level-count'>{levelCounts[level]}</span>}

                        // Ctrl/Cmd-click narrows to a single level; clicking it again restores all
                        onClick={(event) => {
                            if (event.ctrlKey || event.metaKey) {
                                soloLevel(level);
                            } else {
                                toggleLevel(level);
                            }
                        }}
                    />
                ))}
                <Menu.Separator/>
                <Menu.Item
                    id='serverLogsLevelsSelectAll'
                    disabled={allLevelsEnabled}
                    labels={
                        <FormattedMessage
                            id='admin.logs.levels.selectAll'
                            defaultMessage='Select all levels'
                        />
                    }
                    onClick={enableAllLevels}
                />
            </Menu.Container>

            <Menu.Container
                menuButton={{
                    id: 'serverLogsLiveTailMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.liveTail.menuButtonAriaLabel', defaultMessage: 'Open menu to turn live tail on or off'}),
                    as: 'div',
                    children: (
                        <Input
                            label={intl.formatMessage(messages.liveTail)}
                            name='serverLogsLiveTail'
                            value={liveTailEnabled ? intl.formatMessage(pollIntervalLabels[pollInterval]) : intl.formatMessage(messages.liveTailOff)}
                            readOnly={true}
                            inputPrefix={liveTailEnabled ? (
                                <span
                                    className='LogViewer__live-dot'
                                    aria-hidden='true'
                                />
                            ) : undefined}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: 'serverLogsLiveTailMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.liveTail.dropdownAriaLabel', defaultMessage: 'Live tail menu'}),
                    width: '220px',
                }}
            >
                <Menu.Item
                    id='serverLogsLiveTail-off'
                    role='menuitemradio'
                    aria-checked={!liveTailEnabled}
                    forceCloseOnSelect={true}
                    labels={<FormattedMessage {...messages.liveTailOff}/>}
                    trailingElements={!liveTailEnabled && <i className='icon icon-check'/>}
                    onClick={() => setLiveTail(null)}
                />
                {pollIntervals.map((interval) => (
                    <Menu.Item
                        key={interval}
                        id={`serverLogsLiveTail-${interval}`}
                        role='menuitemradio'
                        aria-checked={liveTailEnabled && interval === pollInterval}
                        forceCloseOnSelect={true}
                        labels={<FormattedMessage {...pollIntervalLabels[interval]}/>}
                        trailingElements={liveTailEnabled && interval === pollInterval && <i className='icon icon-check'/>}
                        onClick={() => setLiveTail(interval)}
                    />
                ))}
            </Menu.Container>

            <Menu.Container
                menuButton={{
                    id: 'serverLogsDurationMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.duration.menuButtonAriaLabel', defaultMessage: 'Open menu to select a time range'}),
                    as: 'div',
                    children: (
                        <Input
                            label={intl.formatMessage({id: 'admin.logs.duration', defaultMessage: 'Duration'})}
                            name='serverLogsDuration'
                            value={intl.formatMessage(activePresetLabel ?? messages.allTime)}
                            readOnly={true}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: 'serverLogsDurationMenu',
                    'aria-label': intl.formatMessage({id: 'admin.logs.duration.dropdownAriaLabel', defaultMessage: 'Time range menu'}),
                    width: '220px',
                }}
            >
                <Menu.Item
                    id='serverLogsDuration-all'
                    role='menuitemradio'
                    aria-checked={activeTimePreset === null}
                    forceCloseOnSelect={true}
                    labels={<FormattedMessage {...messages.allTime}/>}
                    trailingElements={activeTimePreset === null && <i className='icon icon-check'/>}
                    onClick={onClearTimePreset}
                />
                {timePresets.map((preset) => (
                    <Menu.Item
                        key={preset.minutes}
                        id={`serverLogsDuration-${preset.minutes}`}
                        role='menuitemradio'
                        aria-checked={activeTimePreset === preset.minutes}
                        forceCloseOnSelect={true}
                        labels={<FormattedMessage {...preset.label}/>}
                        trailingElements={activeTimePreset === preset.minutes && <i className='icon icon-check'/>}
                        onClick={() => onTimePreset(preset.minutes)}
                    />
                ))}
            </Menu.Container>

            {logFormatMenu}

            <div className='LogViewer__filters-spacer'/>

            <Button
                emphasis='tertiary'
                size='medium'
                onClick={onReload}
                leadingIcon={<Icon glyph={<RefreshIcon/>}/>}
            >
                <FormattedMessage
                    id='admin.logs.ReloadLogs'
                    defaultMessage='Reload'
                />
            </Button>
            <Button
                asChild={true}
                emphasis='primary'
                size='medium'
                leadingIcon={<Icon glyph={<DownloadOutlineIcon/>}/>}
            >
                <ExternalLink
                    location='download_logs'
                    href={downloadUrl}
                >
                    <FormattedMessage
                        id='admin.logs.DownloadLogs'
                        defaultMessage='Download'
                    />
                </ExternalLink>
            </Button>
        </div>
    );

    if (loading && logs.length === 0) {
        return (
            <div className='LogViewer'>
                {filters}
                <div className='LogViewer__placeholder'>
                    <LoadingSpinner
                        text={
                            <FormattedMessage
                                id='admin.logs.loading'
                                defaultMessage='Loading logs'
                            />
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className='LogViewer'
            onKeyDown={handleKeyDown}
        >
            {filters}

            <div className='LogViewer__header'>
                <span className='LogViewer__header-level'>
                    <FormattedMessage
                        id='admin.logs.header.level'
                        defaultMessage='Level'
                    />
                </span>
                <button
                    className='LogViewer__header-timestamp'
                    onClick={toggleSort}
                    type='button'
                    aria-sort={sortAsc ? 'ascending' : 'descending'}
                >
                    <FormattedMessage
                        id='admin.logs.header.time'
                        defaultMessage='Time'
                    />
                    <i
                        className={`icon ${sortAsc ? 'icon-arrow-up' : 'icon-arrow-down'}`}
                        aria-hidden='true'
                    />
                </button>
                <span className='LogViewer__header-message'>
                    <FormattedMessage
                        id='admin.logs.header.message'
                        defaultMessage='Message'
                    />
                </span>
                <span className='LogViewer__header-caller'>
                    <FormattedMessage
                        id='admin.logs.header.caller'
                        defaultMessage='Caller'
                    />
                </span>
            </div>

            {/* Empty state — kept outside the list so it only owns rows */}
            {visibleLogs.length === 0 && !loading && (
                <div className='LogViewer__placeholder'>
                    {search || !allLevelsEnabled ? (
                        <FormattedMessage
                            id='admin.logs.noMatchingLogs'
                            defaultMessage='No logs match your filters. {clearLink}'
                            values={{
                                clearLink: (
                                    <button
                                        className='btn btn-link'
                                        onClick={() => {
                                            clearSearch();
                                            enableAllLevels();
                                        }}
                                        type='button'
                                    >
                                        <FormattedMessage
                                            id='admin.logs.clearFilters'
                                            defaultMessage='Clear filters'
                                        />
                                    </button>
                                ),
                            }}
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.logs.noLogs'
                            defaultMessage='No logs found. Ensure log files are within the logging root directory.'
                        />
                    )}
                </div>
            )}

            <div
                className='LogViewer__list'
                ref={listRef}
                role='list'
                aria-label={intl.formatMessage({id: 'admin.logs.listLabel', defaultMessage: 'Server log entries'})}
            >
                {visibleLogs.map((log, idx) => (
                    <LogRow
                        key={rowKeys[idx]}
                        log={log}
                        isExpanded={expandedKey === rowKeys[idx]}
                        isFocused={focusedIndex === idx}
                        onToggleExpand={handleToggleExpand}
                        onFocus={handleFocus}
                        searchTerm={search}
                        wrapText={wrapText}
                    />
                ))}
            </div>

            <div className='LogViewer__footer'>
                <span className='LogViewer__footer-info'>
                    {loading && (
                        <FormattedMessage
                            id='admin.logs.refreshing'
                            defaultMessage='Refreshing…'
                        />
                    )}
                    {!loading && matchCount !== null && (
                        <FormattedMessage
                            id='admin.logs.showingMatching'
                            defaultMessage='Showing {start, number} - {end, number} of {matches, number} entries matching your filters ({total, number} total)'
                            values={{
                                start: processedLogs.length > 0 ? startIndex + 1 : 0,
                                end: endIndex,
                                matches: matchCount,
                                total: totalCount,
                            }}
                        />
                    )}
                    {!loading && matchCount === null && (
                        <FormattedMessage
                            id='admin.logs.showing'
                            defaultMessage='Showing {start, number} - {end, number} of {total, number}'
                            values={{
                                start: processedLogs.length > 0 ? startIndex + 1 : 0,
                                end: endIndex,
                                total: processedLogs.length,
                            }}
                        />
                    )}
                    <WithTooltip
                        title={<KeyboardHints/>}
                    >
                        <i
                            className='icon icon-information-outline LogViewer__footer-help'
                            tabIndex={0}
                            role='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.keyboardHintsLabel', defaultMessage: 'Keyboard shortcuts'})}
                        />
                    </WithTooltip>
                </span>

                <div className='LogViewer__footer-controls'>
                    <Button
                        emphasis={wrapText ? 'tertiary' : 'quaternary'}
                        size='small'
                        onClick={() => setWrapText(!wrapText)}
                        aria-pressed={wrapText}
                    >
                        <FormattedMessage
                            id='admin.logs.wrap'
                            defaultMessage='Wrap text'
                        />
                    </Button>

                    <div className='LogViewer__pagesize'>
                        <label htmlFor='logPageSize'>
                            <FormattedMessage
                                id='admin.logs.rowsPerPage'
                                defaultMessage='Show'
                            />
                        </label>
                        <select
                            id='logPageSize'
                            value={pageSize}
                            onChange={handlePageSizeChange}
                        >
                            {PAGE_SIZES.map((size) => (
                                <option
                                    key={size}
                                    value={size}
                                >
                                    {size}
                                </option>
                            ))}
                        </select>
                        <FormattedMessage
                            id='admin.logs.rowsPerPageSuffix'
                            defaultMessage='rows per page'
                        />
                    </div>

                    <div className='LogViewer__pagination'>
                        <span className='LogViewer__page-indicator'>
                            <FormattedMessage
                                id='admin.logs.pageOf'
                                defaultMessage='Page {page, number} of {total, number}'
                                values={{page: page + 1, total: totalPages}}
                            />
                        </span>
                        <button
                            className='btn btn-icon btn-sm'
                            onClick={goPrevPage}
                            disabled={page === 0}
                            type='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.prevPage', defaultMessage: 'Previous page'})}
                        >
                            <i
                                className='icon icon-chevron-left'
                                aria-hidden='true'
                            />
                        </button>
                        <button
                            className='btn btn-icon btn-sm'
                            onClick={goNextPage}
                            disabled={page >= totalPages - 1}
                            type='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.nextPage', defaultMessage: 'Next page'})}
                        >
                            <i
                                className='icon icon-chevron-right'
                                aria-hidden='true'
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
