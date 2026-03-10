// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {LogFilter, LogLevelEnum, LogObject} from '@mattermost/types/admin';

import LogRow from './log_row';

import './log_list.scss';

type LogObjectWithAdditionalInfo = LogObject & {
    [key: string]: string;
};

type Props = {
    loading: boolean;
    logs: LogObjectWithAdditionalInfo[];
    onFiltersChange: (filters: LogFilter) => void;
    onSearchChange: (term: string) => void;
    search: string;
};

const PAGE_SIZES = [50, 100, 200, 500] as const;
const DEFAULT_PAGE_SIZE = 200;

const LEVEL_ORDER = ['error', 'warn', 'info', 'debug'] as const;
const LEVEL_LABELS: Record<string, string> = {
    error: 'Error',
    warn: 'Warn',
    info: 'Info',
    debug: 'Debug',
};

const PREFS_KEY = 'mm_admin_logs_prefs';

type StoredPrefs = {
    pageSize: number;
    compact: boolean;
    wrapText: boolean;
    enabledLevels: string[];
    sortAsc: boolean;
};

function loadPrefs(): StoredPrefs {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch {
        // ignore
    }
    return {
        pageSize: DEFAULT_PAGE_SIZE,
        compact: true,
        wrapText: true,
        enabledLevels: ['error', 'warn', 'info', 'debug'],
        sortAsc: true,
    };
}

function savePrefs(prefs: StoredPrefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

export default function LogList({loading, logs, onFiltersChange, onSearchChange, search}: Props) {
    const intl = useIntl();
    const initialPrefs = useMemo(loadPrefs, []);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
    const [sortAsc, setSortAsc] = useState(initialPrefs.sortAsc);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [enabledLevels, setEnabledLevels] = useState<Set<string>>(new Set(initialPrefs.enabledLevels));
    const [compact, setCompact] = useState(initialPrefs.compact);
    const [wrapText, setWrapText] = useState(initialPrefs.wrapText);

    const listRef = useRef<HTMLDivElement>(null);

    // Persist prefs
    useEffect(() => {
        savePrefs({
            pageSize,
            compact,
            wrapText,
            enabledLevels: Array.from(enabledLevels),
            sortAsc,
        });
    }, [pageSize, compact, wrapText, enabledLevels, sortAsc]);

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

    // Filter and sort logs
    const processedLogs = useMemo(() => {
        let filtered = logs;

        // Level filter
        if (enabledLevels.size < 4) {
            filtered = filtered.filter((log) => enabledLevels.has(log.level));
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            const timeA = new Date(a.timestamp).valueOf();
            const timeB = new Date(b.timestamp).valueOf();
            return sortAsc ? timeA - timeB : timeB - timeA;
        });

        return sorted;
    }, [logs, enabledLevels, sortAsc]);

    // Search match count
    const matchCount = search ? processedLogs.length : null;
    const totalCount = logs.length;

    // Paginate
    const totalPages = Math.max(1, Math.ceil(processedLogs.length / pageSize));
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, processedLogs.length);
    const visibleLogs = processedLogs.slice(startIndex, endIndex);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
        setExpandedIndex(null);
        setFocusedIndex(null);
    }, [search, enabledLevels, sortAsc]);

    // Level toggle
    const toggleLevel = useCallback((level: string) => {
        setEnabledLevels((prev) => {
            const next = new Set(prev);
            if (next.has(level)) {
                // Don't allow disabling all levels
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
        setEnabledLevels(new Set(['error', 'warn', 'info', 'debug']));
    }, []);

    // Expand/collapse
    const handleToggleExpand = useCallback((log: LogObjectWithAdditionalInfo) => {
        const idx = visibleLogs.indexOf(log);
        setExpandedIndex((prev) => (prev === idx ? null : idx));
    }, [visibleLogs]);

    const handleFocus = useCallback((log: LogObjectWithAdditionalInfo) => {
        const idx = visibleLogs.indexOf(log);
        setFocusedIndex(idx);
    }, [visibleLogs]);

    // Pagination
    const goNextPage = useCallback(() => {
        setPage((p) => Math.min(p + 1, totalPages - 1));
        setExpandedIndex(null);
        listRef.current?.scrollTo({top: 0});
    }, [totalPages]);

    const goPrevPage = useCallback(() => {
        setPage((p) => Math.max(p - 1, 0));
        setExpandedIndex(null);
        listRef.current?.scrollTo({top: 0});
    }, []);

    const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setPageSize(newSize);
        setPage(0);
        setExpandedIndex(null);
    }, []);

    // Sort toggle
    const toggleSort = useCallback(() => {
        setSortAsc((prev) => !prev);
    }, []);

    // Keyboard navigation at the list level
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const target = e.target as HTMLElement;

        // Don't capture if typing in search
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
        case 'j':
        case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex((prev) => {
                const next = prev === null ? 0 : Math.min(prev + 1, visibleLogs.length - 1);
                // Focus the row element
                const rows = listRef.current?.querySelectorAll('.LogRow');
                (rows?.[next] as HTMLElement)?.focus();
                return next;
            });
            break;
        case 'k':
        case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex((prev) => {
                const next = prev === null ? 0 : Math.max(prev - 1, 0);
                const rows = listRef.current?.querySelectorAll('.LogRow');
                (rows?.[next] as HTMLElement)?.focus();
                return next;
            });
            break;
        case 'Escape':
            setExpandedIndex(null);
            break;
        case '/':
            e.preventDefault();
            listRef.current?.closest('.LogViewer')?.querySelector<HTMLInputElement>('.LogViewer__search-input')?.focus();
            break;
        case 'e':
        case 'E': {
            // Jump to next/prev error
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            const start = focusedIndex === null ? 0 : focusedIndex + direction;
            for (let i = start; i >= 0 && i < visibleLogs.length; i += direction) {
                if (visibleLogs[i].level === 'error') {
                    setFocusedIndex(i);
                    const rows = listRef.current?.querySelectorAll('.LogRow');
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

    const allLevelsEnabled = enabledLevels.size === 4;

    return (
        <div
            className='LogViewer'
            onKeyDown={handleKeyDown}
        >
            {/* Toolbar */}
            <div className='LogViewer__toolbar'>
                <div className='LogViewer__toolbar-left'>
                    {/* Search */}
                    <div className='LogViewer__search'>
                        <i className='icon icon-magnify LogViewer__search-icon'/>
                        <input
                            className='LogViewer__search-input'
                            type='text'
                            placeholder={intl.formatMessage({id: 'admin.logs.search.placeholder', defaultMessage: 'Search logs...'})}
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        {search && (
                            <button
                                className='LogViewer__search-clear'
                                onClick={() => onSearchChange('')}
                                type='button'
                                aria-label={intl.formatMessage({id: 'admin.logs.search.clear', defaultMessage: 'Clear search'})}
                            >
                                <i className='icon icon-close'/>
                            </button>
                        )}
                    </div>

                    {/* Search match count */}
                    {matchCount !== null && (
                        <span className='LogViewer__match-count'>
                            <FormattedMessage
                                id='admin.logs.matchCount'
                                defaultMessage='{count} of {total}'
                                values={{count: matchCount, total: totalCount}}
                            />
                        </span>
                    )}
                </div>

                <div className='LogViewer__toolbar-right'>
                    {/* Density toggle */}
                    <button
                        className={`LogViewer__toolbar-btn ${compact ? 'LogViewer__toolbar-btn--active' : ''}`}
                        onClick={() => setCompact(!compact)}
                        type='button'
                        title={intl.formatMessage({id: 'admin.logs.density', defaultMessage: 'Toggle compact mode'})}
                    >
                        <i className={compact ? 'icon icon-format-line-spacing' : 'icon icon-format-line-spacing'}/>
                    </button>

                    {/* Wrap toggle */}
                    <button
                        className={`LogViewer__toolbar-btn ${wrapText ? 'LogViewer__toolbar-btn--active' : ''}`}
                        onClick={() => setWrapText(!wrapText)}
                        type='button'
                        title={intl.formatMessage({id: 'admin.logs.wrap', defaultMessage: 'Toggle text wrapping'})}
                    >
                        <i className='icon icon-wrap'/>
                    </button>
                </div>
            </div>

            {/* Level filter toggles */}
            <div className='LogViewer__level-filters'>
                <button
                    className={`LogViewer__level-btn LogViewer__level-btn--all ${allLevelsEnabled ? 'LogViewer__level-btn--active' : ''}`}
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
                        className={`LogViewer__level-btn LogViewer__level-btn--${level} ${enabledLevels.has(level) ? 'LogViewer__level-btn--active' : ''}`}
                        onClick={() => toggleLevel(level)}
                        type='button'
                    >
                        {LEVEL_LABELS[level]}
                        <span className='LogViewer__level-count'>{levelCounts[level]}</span>
                    </button>
                ))}
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

            {/* Log rows */}
            <div
                className='LogViewer__list'
                ref={listRef}
                role='grid'
                aria-label={intl.formatMessage({id: 'admin.logs.listLabel', defaultMessage: 'Server log entries'})}
            >
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
                                                onSearchChange('');
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
                {visibleLogs.map((log, idx) => (
                    <LogRow
                        key={`${log.timestamp}-${log.caller}-${idx}`}
                        log={log}
                        isExpanded={expandedIndex === idx}
                        isFocused={focusedIndex === idx}
                        onToggleExpand={handleToggleExpand}
                        onFocus={handleFocus}
                        searchTerm={search}
                        wrapText={wrapText}
                        compact={compact}
                    />
                ))}
                {loading && logs.length > 0 && (
                    <div className='LogViewer__loading-overlay'>
                        <FormattedMessage
                            id='admin.logs.refreshing'
                            defaultMessage='Refreshing...'
                        />
                    </div>
                )}
            </div>

            {/* Footer / Pagination */}
            <div className='LogViewer__footer'>
                <div className='LogViewer__footer-info'>
                    <FormattedMessage
                        id='admin.logs.showing'
                        defaultMessage='{start}-{end} of {total}'
                        values={{
                            start: processedLogs.length > 0 ? startIndex + 1 : 0,
                            end: endIndex,
                            total: processedLogs.length,
                        }}
                    />
                </div>
                <div className='LogViewer__footer-pagination'>
                    <button
                        className='btn btn-sm btn-tertiary'
                        onClick={goPrevPage}
                        disabled={page === 0}
                        type='button'
                    >
                        <i className='icon icon-chevron-left'/>
                    </button>
                    <span className='LogViewer__page-indicator'>
                        <FormattedMessage
                            id='admin.logs.pageOf'
                            defaultMessage='Page {page} of {total}'
                            values={{page: page + 1, total: totalPages}}
                        />
                    </span>
                    <button
                        className='btn btn-sm btn-tertiary'
                        onClick={goNextPage}
                        disabled={page >= totalPages - 1}
                        type='button'
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
                <div className='LogViewer__keyboard-hint'>
                    <FormattedMessage
                        id='admin.logs.keyboardHint'
                        defaultMessage='j/k navigate \u00B7 Enter expand \u00B7 e jump to error \u00B7 / search'
                    />
                </div>
            </div>
        </div>
    );
}
