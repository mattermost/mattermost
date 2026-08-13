// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';

import LogRow from './log_row';
import type {LogObjectWithAdditionalInfo} from './types';

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

    // Actions
    onReload: () => void;
    downloadUrl: string;

    // Live tail
    liveTailEnabled: boolean;
    onToggleLiveTail: () => void;
    pollInterval: number;
    onPollIntervalChange: (interval: number) => void;
    pollIntervals: readonly number[];
    pollIntervalLabels: Record<number, string>;
    showPollDropdown: boolean;
    onTogglePollDropdown: () => void;
    lastUpdatedText: string | null;

    // Time presets
    timePresets: readonly TimePreset[];
    activeTimePreset: number | null;
    onTimePreset: (minutes: number) => void;
    onClearTimePreset: () => void;
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
    sortAsc: true,
};

// Stored prefs may predate the current shape, so every field is validated
// before it is trusted
function loadPrefs(): StoredPrefs {
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

// Identifies a row by its content instead of its position, so a reload or a
// live-tail poll does not move the expanded row somewhere else
function logKey(log: LogObjectWithAdditionalInfo): string {
    return `${log.timestamp}|${log.caller}|${log.msg}`;
}

// Content based keys keep the rows mounted across a reload or a sort toggle.
// Identical entries get a suffix, since React needs the keys to be unique.
function getRowKeys(rows: LogObjectWithAdditionalInfo[]): string[] {
    const seen = new Map<string, number>();
    return rows.map((log) => {
        const key = logKey(log);
        const occurrence = seen.get(key) ?? 0;
        seen.set(key, occurrence + 1);
        return occurrence === 0 ? key : `${key}#${occurrence}`;
    });
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
    onReload, downloadUrl,
    liveTailEnabled, onToggleLiveTail, pollInterval, onPollIntervalChange,
    pollIntervals, pollIntervalLabels, showPollDropdown, onTogglePollDropdown, lastUpdatedText,
    timePresets, activeTimePreset, onTimePreset, onClearTimePreset,
}: Props) {
    const intl = useIntl();
    const initialPrefs = useMemo(() => loadPrefs(), []);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
    const [sortAsc, setSortAsc] = useState(initialPrefs.sortAsc);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [enabledLevels, setEnabledLevels] = useState<Set<string>>(new Set(initialPrefs.enabledLevels));
    const [wrapText, setWrapText] = useState(initialPrefs.wrapText);

    // Kept local so typing repaints the input without waiting for the filtering
    // that `search` drives in the parent
    const [searchInput, setSearchInput] = useState(search);

    const listRef = useRef<HTMLDivElement>(null);

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

    // Persist prefs
    useEffect(() => {
        savePrefs({
            pageSize,
            wrapText,
            enabledLevels: Array.from(enabledLevels),
            sortAsc,
        });
    }, [pageSize, wrapText, enabledLevels, sortAsc]);

    // Count logs by level
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

    // Filter and sort logs
    const processedLogs = useMemo(() => {
        let filtered = logs;

        if (!allLevelsEnabled) {
            filtered = filtered.filter((log) => enabledLevels.has(log.level));
        }

        const sorted = [...filtered].sort((a, b) => {
            const timeA = new Date(a.timestamp).valueOf();
            const timeB = new Date(b.timestamp).valueOf();
            return sortAsc ? timeA - timeB : timeB - timeA;
        });

        return sorted;
    }, [logs, allLevelsEnabled, enabledLevels, sortAsc]);

    const matchCount = search ? processedLogs.length : null;
    const totalCount = logs.length;

    // Paginate
    const totalPages = Math.max(1, Math.ceil(processedLogs.length / pageSize));
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, processedLogs.length);
    const visibleLogs = processedLogs.slice(startIndex, endIndex);

    const rowKeys = getRowKeys(visibleLogs);

    // Reset to page 0 when filters or sort order change
    useEffect(() => {
        setPage(0);
        setExpandedKey(null);
        setFocusedIndex(null);
    }, [search, enabledLevels, sortAsc]);

    // Clamp the page when the logs dataset shrinks (reload, live-tail). The
    // expanded row is tracked by content, so it survives a refresh.
    useEffect(() => {
        const lastPage = Math.max(0, Math.ceil(processedLogs.length / pageSize) - 1);
        setPage((prev) => Math.max(0, Math.min(prev, lastPage)));
        setFocusedIndex((prev) => (prev !== null && prev >= visibleLogs.length ? null : prev));
    }, [logs, processedLogs.length, pageSize, visibleLogs.length]);

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
    }, []);

    const enableAllLevels = useCallback(() => {
        setEnabledLevels(new Set<string>(LEVEL_ORDER));
    }, []);

    // Ctrl/Cmd-click a level pill to show only that level; ctrl/cmd-click it again to restore all.
    const soloLevel = useCallback((level: string) => {
        setEnabledLevels((prev) => {
            if (prev.size === 1 && prev.has(level)) {
                return new Set<string>(LEVEL_ORDER);
            }
            return new Set([level]);
        });
    }, []);

    const handleToggleExpand = useCallback((log: LogObjectWithAdditionalInfo) => {
        const key = logKey(log);
        setExpandedKey((prev) => (prev === key ? null : key));
    }, []);

    const handleFocus = useCallback((log: LogObjectWithAdditionalInfo) => {
        const idx = visibleLogs.indexOf(log);
        setFocusedIndex(idx);
    }, [visibleLogs]);

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
        setFocusedIndex(null);
    }, []);

    const toggleSort = useCallback(() => {
        setSortAsc((prev) => !prev);
    }, []);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
        case 'j':
        case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex((prev) => {
                const next = prev === null ? 0 : Math.min(prev + 1, visibleLogs.length - 1);
                const rows = listRef.current?.querySelectorAll(ROW_FOCUS_SELECTOR);
                (rows?.[next] as HTMLElement)?.focus();
                return next;
            });
            break;
        case 'k':
        case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex((prev) => {
                const next = prev === null ? 0 : Math.max(prev - 1, 0);
                const rows = listRef.current?.querySelectorAll(ROW_FOCUS_SELECTOR);
                (rows?.[next] as HTMLElement)?.focus();
                return next;
            });
            break;
        case 'Escape':
            setExpandedKey(null);
            break;
        case '/':
            e.preventDefault();
            listRef.current?.closest('.LogViewer')?.querySelector<HTMLInputElement>('.LogViewer__search-input')?.focus();
            break;
        case 'e':
        case 'E': {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;

            // With nothing focused yet, start from whichever end the search walks away from
            let start = focusedIndex === null ? 0 : focusedIndex + direction;
            if (focusedIndex === null && direction === -1) {
                start = visibleLogs.length - 1;
            }
            for (let i = start; i >= 0 && i < visibleLogs.length; i += direction) {
                if (visibleLogs[i].level === 'error') {
                    setFocusedIndex(i);
                    const rows = listRef.current?.querySelectorAll(ROW_FOCUS_SELECTOR);
                    (rows?.[i] as HTMLElement)?.focus();
                    (rows?.[i] as HTMLElement)?.scrollIntoView({block: 'nearest'});
                    break;
                }
            }
            break;
        }
        }
    }, [visibleLogs, focusedIndex]);

    if (loading && logs.length === 0) {
        return (
            <div className='LogViewer'>
                <div className='LogViewer__loading'>
                    <div className='LogViewer__loading-spinner'/>
                    <FormattedMessage
                        id='admin.logs.loading'
                        defaultMessage='Loading logs...'
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
            {/* Toolbar row 1: Actions */}
            <div className='LogViewer__toolbar'>
                <div className='LogViewer__toolbar-group'>
                    {/* Time range presets */}
                    {timePresets.map((preset) => (
                        <button
                            key={preset.minutes}
                            type='button'
                            className={`LogViewer__action-btn ${activeTimePreset === preset.minutes ? 'LogViewer__action-btn--active' : ''}`}
                            onClick={() => onTimePreset(preset.minutes)}
                        >
                            <FormattedMessage {...preset.label}/>
                        </button>
                    ))}
                    {activeTimePreset !== null && (
                        <button
                            type='button'
                            className='LogViewer__action-btn LogViewer__action-btn--icon'
                            onClick={onClearTimePreset}
                            aria-label={intl.formatMessage({id: 'admin.logs.clearTimePreset', defaultMessage: 'Clear time preset'})}
                        >
                            <i className='icon icon-close'/>
                        </button>
                    )}
                </div>

                <div className='LogViewer__toolbar-group'>
                    {/* Live tail */}
                    <button
                        type='button'
                        className={`LogViewer__action-btn ${liveTailEnabled ? 'LogViewer__action-btn--live' : ''}`}
                        onClick={onToggleLiveTail}
                    >
                        {liveTailEnabled && <span className='LogViewer__live-dot'/>}
                        <FormattedMessage
                            id='admin.logs.liveTail'
                            defaultMessage='Live'
                        />
                    </button>
                    <div className='LogViewer__poll-interval-wrapper'>
                        <button
                            type='button'
                            className='LogViewer__action-btn'
                            onClick={onTogglePollDropdown}
                        >
                            {pollIntervalLabels[pollInterval]}
                            <i className='icon icon-chevron-down'/>
                        </button>
                        {showPollDropdown && (
                            <div className='LogViewer__poll-dropdown'>
                                {pollIntervals.map((interval) => (
                                    <button
                                        key={interval}
                                        type='button'
                                        className={`LogViewer__poll-option ${interval === pollInterval ? 'LogViewer__poll-option--active' : ''}`}
                                        onClick={() => {
                                            onPollIntervalChange(interval);
                                            onTogglePollDropdown();
                                        }}
                                    >
                                        {pollIntervalLabels[interval]}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {liveTailEnabled && lastUpdatedText && (
                        <span className='LogViewer__last-updated'>
                            {lastUpdatedText}
                        </span>
                    )}
                </div>

                <div className='LogViewer__toolbar-spacer'/>

                <div className='LogViewer__toolbar-group'>
                    <button
                        type='button'
                        className='LogViewer__action-btn'
                        onClick={onReload}
                    >
                        <i className='icon icon-refresh'/>
                        <FormattedMessage
                            id='admin.logs.ReloadLogs'
                            defaultMessage='Reload'
                        />
                    </button>
                    <ExternalLink
                        location='download_logs'
                        className='LogViewer__action-btn'
                        href={downloadUrl}
                    >
                        <i className='icon icon-download-outline'/>
                        <FormattedMessage
                            id='admin.logs.DownloadLogs'
                            defaultMessage='Download'
                        />
                    </ExternalLink>
                </div>
            </div>

            {/* Toolbar row 2: Search + levels + wrap */}
            <div className='LogViewer__filterbar'>
                <div className='LogViewer__search'>
                    <i className='icon icon-magnify LogViewer__search-icon'/>
                    <input
                        className='LogViewer__search-input'
                        type='text'
                        placeholder={intl.formatMessage({id: 'admin.logs.search.placeholder', defaultMessage: 'Search logs...'})}
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {searchInput && (
                        <button
                            className='LogViewer__search-clear'
                            onClick={clearSearch}
                            type='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.search.clear', defaultMessage: 'Clear search'})}
                        >
                            <i className='icon icon-close'/>
                        </button>
                    )}
                    {matchCount !== null && (
                        <span className='LogViewer__match-count'>
                            <FormattedMessage
                                id='admin.logs.matchCount'
                                defaultMessage='{count, number} of {total, number}'
                                values={{count: matchCount, total: totalCount}}
                            />
                        </span>
                    )}
                </div>

                {/* Level toggles */}
                <div className='LogViewer__level-filters'>
                    <button
                        className={`LogViewer__level-btn ${allLevelsEnabled ? 'LogViewer__level-btn--active' : ''}`}
                        onClick={enableAllLevels}
                        type='button'
                    >
                        <FormattedMessage
                            id='admin.logs.allLevels'
                            defaultMessage='All'
                        />
                        <span className='LogViewer__level-count'>{totalCount}</span>
                    </button>
                    {LEVEL_ORDER.map((level) => (
                        <button
                            key={level}
                            className={`LogViewer__level-btn LogViewer__level-btn--${level} ${enabledLevels.has(level) ? 'LogViewer__level-btn--on' : ''}`}
                            onClick={(event) => {
                                if (event.ctrlKey || event.metaKey) {
                                    soloLevel(level);
                                } else {
                                    toggleLevel(level);
                                }
                            }}
                            title={intl.formatMessage({id: 'admin.logs.levelPill.title', defaultMessage: 'Click to toggle · Ctrl/Cmd-click to show only this level'})}
                            type='button'
                        >
                            <FormattedMessage {...LEVEL_LABELS[level]}/>
                            <span className='LogViewer__level-count'>{levelCounts[level]}</span>
                        </button>
                    ))}
                </div>

                <button
                    className={`LogViewer__action-btn ${wrapText ? 'LogViewer__action-btn--active' : ''}`}
                    onClick={() => setWrapText(!wrapText)}
                    type='button'
                >
                    {wrapText ? (
                        <FormattedMessage
                            id='admin.logs.wrap'
                            defaultMessage='Wrap'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.logs.nowrap'
                            defaultMessage='No wrap'
                        />
                    )}
                </button>
            </div>

            {/* Column header */}
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
                >
                    <FormattedMessage
                        id='admin.logs.header.time'
                        defaultMessage='Time'
                    />
                    <i className={`icon ${sortAsc ? 'icon-arrow-up' : 'icon-arrow-down'}`}/>
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
                <div className='LogViewer__empty'>
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

            {/* Log rows */}
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
                        isExpanded={expandedKey === logKey(log)}
                        isFocused={focusedIndex === idx}
                        onToggleExpand={handleToggleExpand}
                        onFocus={handleFocus}
                        searchTerm={search}
                        wrapText={wrapText}
                    />
                ))}
            </div>

            {loading && logs.length > 0 && (
                <div className='LogViewer__loading-overlay'>
                    <FormattedMessage
                        id='admin.logs.refreshing'
                        defaultMessage='Refreshing...'
                    />
                </div>
            )}

            {/* Footer */}
            <div className='LogViewer__footer'>
                <div className='LogViewer__footer-left'>
                    <span className='LogViewer__footer-info'>
                        <FormattedMessage
                            id='admin.logs.showing'
                            defaultMessage='{start, number}-{end, number} of {total, number}'
                            values={{
                                start: processedLogs.length > 0 ? startIndex + 1 : 0,
                                end: endIndex,
                                total: processedLogs.length,
                            }}
                        />
                    </span>
                    <div className='LogViewer__footer-pagination'>
                        <button
                            className='LogViewer__page-btn'
                            onClick={goPrevPage}
                            disabled={page === 0}
                            type='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.prevPage', defaultMessage: 'Previous page'})}
                        >
                            <i className='icon icon-chevron-left'/>
                        </button>
                        <span className='LogViewer__page-indicator'>
                            <FormattedMessage
                                id='admin.logs.pageOf'
                                defaultMessage='Page {page, number} of {total, number}'
                                values={{page: page + 1, total: totalPages}}
                            />
                        </span>
                        <button
                            className='LogViewer__page-btn'
                            onClick={goNextPage}
                            disabled={page >= totalPages - 1}
                            type='button'
                            aria-label={intl.formatMessage({id: 'admin.logs.nextPage', defaultMessage: 'Next page'})}
                        >
                            <i className='icon icon-chevron-right'/>
                        </button>
                    </div>
                    <div className='LogViewer__footer-pagesize'>
                        <label htmlFor='logPageSize'>
                            <FormattedMessage
                                id='admin.logs.rowsPerPage'
                                defaultMessage='Rows:'
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
                    </div>
                </div>
                <div className='LogViewer__keyboard-hints'>
                    <span className='LogViewer__kbd-group'>
                        <kbd>{'j'}</kbd><kbd>{'k'}</kbd>{' '}
                        <FormattedMessage
                            id='admin.logs.kbd.navigate'
                            defaultMessage='navigate'
                        />
                    </span>
                    <span className='LogViewer__kbd-group'>
                        <kbd>{'Enter'}</kbd>{' '}
                        <FormattedMessage
                            id='admin.logs.kbd.expand'
                            defaultMessage='expand'
                        />
                    </span>
                    <span className='LogViewer__kbd-group'>
                        <kbd>{'e'}</kbd>{' '}
                        <FormattedMessage
                            id='admin.logs.kbd.jumpError'
                            defaultMessage='next error'
                        />
                    </span>
                    <span className='LogViewer__kbd-group'>
                        <kbd>{'/'}</kbd>{' '}
                        <FormattedMessage
                            id='admin.logs.kbd.search'
                            defaultMessage='search'
                        />
                    </span>
                </div>
            </div>
        </div>
    );
}
