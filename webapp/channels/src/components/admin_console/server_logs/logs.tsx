// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import type {
    LogFilter,
    LogLevels,
    LogServerNames,
} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import LogFormatMenu from './log_format_menu';
import LogList from './log_list';
import PlainLogList from './plain_log_list';
import type {LogObjectWithAdditionalInfo} from './types';
import useLogPolling from './use_log_polling';

import './logs.scss';

type Props = {
    logs: LogObjectWithAdditionalInfo[];
    plainLogs: string[];
    isPlainLogs: boolean;
    actions: {
        getLogs: (logFilter: LogFilter) => Promise<unknown>;
        getPlainLogs: (
            page?: number | undefined,
            perPage?: number | undefined,
        ) => Promise<unknown>;
    };
};

const messages = defineMessages({
    title: {id: 'admin.logs.title', defaultMessage: 'Server Logs'},
});

export const searchableStrings = [
    messages.title,
];

const POLL_INTERVALS = [5000, 10000, 30000, 60000] as const;
const POLL_INTERVAL_LABELS = defineMessages<number>({
    5000: {id: 'admin.logs.pollInterval.5s', defaultMessage: 'Every 5 seconds'},
    10000: {id: 'admin.logs.pollInterval.10s', defaultMessage: 'Every 10 seconds'},
    30000: {id: 'admin.logs.pollInterval.30s', defaultMessage: 'Every 30 seconds'},
    60000: {id: 'admin.logs.pollInterval.60s', defaultMessage: 'Every 60 seconds'},
});

const timePresetMessages = defineMessages({
    fiveMinutes: {id: 'admin.logs.time.5m', defaultMessage: 'Last 5 minutes'},
    fifteenMinutes: {id: 'admin.logs.time.15m', defaultMessage: 'Last 15 minutes'},
    oneHour: {id: 'admin.logs.time.1h', defaultMessage: 'Last hour'},
    oneDay: {id: 'admin.logs.time.24h', defaultMessage: 'Last 24 hours'},
});

const TIME_PRESETS = [
    {label: timePresetMessages.fiveMinutes, minutes: 5},
    {label: timePresetMessages.fifteenMinutes, minutes: 15},
    {label: timePresetMessages.oneHour, minutes: 60},
    {label: timePresetMessages.oneDay, minutes: 1440},
] as const;

const LOG_FORMAT_PREF_KEY = 'mm_admin_logs_format';

// The logs API expects filter dates as UTC in "YYYY-MM-DD HH:mm:ss.SSS +00:00"
function formatFilterDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.000 +00:00`;
}

// The range covered by a time preset, ending at the current time
function presetRange(minutes: number): {dateFrom: string; dateTo: string} {
    const now = new Date();
    return {
        dateFrom: formatFilterDate(new Date(now.getTime() - (minutes * 60 * 1000))),
        dateTo: formatFilterDate(now),
    };
}

// The level and server-name filters are applied client side, so the query never
// narrows them
const ALL_SERVER_NAMES: LogServerNames = [];
const ALL_LOG_LEVELS: LogLevels = [];

const PLAIN_LOGS_PER_PAGE = 1000;

function getInitialFormat(configIsPlainLogs: boolean): boolean {
    if (configIsPlainLogs) {
        return true;
    }
    try {
        const saved = localStorage.getItem(LOG_FORMAT_PREF_KEY);
        if (saved === 'plain') {
            return true;
        }
        if (saved === 'structured') {
            return false;
        }
    } catch {
        // ignore
    }
    return false;
}

export default function Logs({logs, plainLogs, isPlainLogs: configIsPlainLogs, actions}: Props) {
    const intl = useIntl();

    const [isPlainLogs, setIsPlainLogs] = useState(() => getInitialFormat(configIsPlainLogs));
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Filter state
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Refs for latest date values (used by reload during live tail)
    const dateFromRef = useRef(dateFrom);
    const dateToRef = useRef(dateTo);
    dateFromRef.current = dateFrom;
    dateToRef.current = dateTo;

    // Plain log pagination
    const [plainPage, setPlainPage] = useState(0);

    // Live tail state
    const [liveTailEnabled, setLiveTailEnabled] = useState(false);
    const [pollInterval, setPollInterval] = useState(5000);

    // Active time preset
    const [activeTimePreset, setActiveTimePreset] = useState<number | null>(null);

    // Ref for active time preset so reload can recompute dates dynamically
    const activeTimePresetRef = useRef<number | null>(null);

    // `silent` keeps the loading state untouched, so a background poll never
    // replaces the viewer with a spinner
    const reload = useCallback(async (options?: {silent?: boolean}) => {
        const silent = options?.silent === true;
        if (!silent) {
            setLoading(true);
        }
        if (isPlainLogs) {
            await actions.getPlainLogs(plainPage, PLAIN_LOGS_PER_PAGE);
        } else {
            // If a time preset is active, recompute the date range for fresh data
            let effectiveDateFrom = dateFromRef.current;
            let effectiveDateTo = dateToRef.current;
            if (activeTimePresetRef.current !== null) {
                ({dateFrom: effectiveDateFrom, dateTo: effectiveDateTo} = presetRange(activeTimePresetRef.current));
            }
            await actions.getLogs({
                serverNames: ALL_SERVER_NAMES,
                logLevels: ALL_LOG_LEVELS,
                dateFrom: effectiveDateFrom,
                dateTo: effectiveDateTo,
            });
        }
        if (!silent) {
            setLoading(false);
        }
    }, [isPlainLogs, plainPage, actions]);

    const pollLogs = useCallback(() => reload({silent: true}), [reload]);

    // Click handlers must not forward their event as reload options
    const handleReload = useCallback(() => reload(), [reload]);

    // Initial load + reload when plain page changes
    const hasMountedRef = useRef(false);
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            reload();
            return;
        }
        if (isPlainLogs) {
            reload();
        }
    }, [plainPage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Live tail polling
    const {lastUpdated} = useLogPolling({
        fetchLogs: pollLogs,
        enabled: liveTailEnabled && !isPlainLogs,
        intervalMs: pollInterval,
    });

    const onSearchChange = useCallback((term: string) => {
        setSearch(term);
    }, []);

    // Filter logs based on search term
    const searchFilteredLogs = useMemo(() => {
        if (!search) {
            return logs;
        }
        const excludedKeys = new Set(['level', 'timestamp']);
        const lowerSearch = search.toLowerCase();
        return logs.filter((log) =>
            Object.entries(log).some(([key, value]) => {
                if (excludedKeys.has(key)) {
                    return false;
                }
                return String(value).toLowerCase().includes(lowerSearch);
            }),
        );
    }, [logs, search]);

    const onLogFormatChange = useCallback((plain: boolean) => {
        setIsPlainLogs(plain);
        try {
            localStorage.setItem(LOG_FORMAT_PREF_KEY, plain ? 'plain' : 'structured');
        } catch {
            // ignore
        }
        if (plain) {
            setLiveTailEnabled(false);
            setLoading(true);
            actions.getPlainLogs(plainPage, PLAIN_LOGS_PER_PAGE).then(() => setLoading(false));
        } else {
            setLoading(true);
            actions.getLogs({
                serverNames: ALL_SERVER_NAMES,
                logLevels: ALL_LOG_LEVELS,
                dateFrom,
                dateTo,
            }).then(() => setLoading(false));
        }
    }, [actions, plainPage, dateFrom, dateTo]);

    // Time presets
    const handleTimePreset = useCallback((minutes: number) => {
        const {dateFrom: newDateFrom, dateTo: newDateTo} = presetRange(minutes);

        setActiveTimePreset(minutes);
        activeTimePresetRef.current = minutes;
        setDateFrom(newDateFrom);
        setDateTo(newDateTo);

        setLoading(true);
        actions.getLogs({
            serverNames: ALL_SERVER_NAMES,
            logLevels: ALL_LOG_LEVELS,
            dateFrom: newDateFrom,
            dateTo: newDateTo,
        }).then(() => setLoading(false));
    }, [actions]);

    const clearTimePreset = useCallback(() => {
        setActiveTimePreset(null);
        activeTimePresetRef.current = null;
        setDateFrom('');
        setDateTo('');
        setLoading(true);
        actions.getLogs({
            serverNames: ALL_SERVER_NAMES,
            logLevels: ALL_LOG_LEVELS,
            dateFrom: '',
            dateTo: '',
        }).then(() => setLoading(false));
    }, [actions]);

    // `lastUpdated` only moves once per poll, so the elapsed label needs its own
    // clock to advance in between
    const [now, setNow] = useState(() => Date.now());
    const showLastUpdated = liveTailEnabled && lastUpdated !== null;
    useEffect(() => {
        if (!showLastUpdated) {
            return undefined;
        }
        setNow(Date.now());
        const intervalId = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(intervalId);
    }, [showLastUpdated, lastUpdated]);

    // Format "last updated" for live tail
    const lastUpdatedText = useMemo(() => {
        if (!lastUpdated) {
            return null;
        }
        const seconds = Math.max(0, Math.round((now - lastUpdated) / 1000));
        if (seconds < 5) {
            return intl.formatMessage({id: 'admin.logs.justNow', defaultMessage: 'just now'});
        }
        return intl.formatMessage({id: 'admin.logs.secondsAgo', defaultMessage: '{n}s ago'}, {n: seconds});
    }, [lastUpdated, now, intl]);

    const displayLogs = searchFilteredLogs;

    const logFormatMenu = configIsPlainLogs ? null : (
        <LogFormatMenu
            isPlainLogs={isPlainLogs}
            onChange={onLogFormatChange}
        />
    );

    const list = isPlainLogs ? (
        <PlainLogList
            loading={loading}
            logs={plainLogs}
            nextPage={() => setPlainPage((p) => p + 1)}
            previousPage={() => setPlainPage((p) => Math.max(0, p - 1))}
            goToPage={(p: number) => setPlainPage(Math.max(0, p))}
            page={plainPage}
            perPage={PLAIN_LOGS_PER_PAGE}
            onReload={handleReload}
            downloadUrl={Client4.getUrl() + '/api/v4/logs/download'}
            logFormatMenu={logFormatMenu}
        />
    ) : (
        <LogList
            loading={loading}
            logs={displayLogs as LogObjectWithAdditionalInfo[]}
            onSearchChange={onSearchChange}
            search={search}
            onReload={handleReload}
            downloadUrl={Client4.getUrl() + '/api/v4/logs/download'}
            liveTailEnabled={liveTailEnabled}
            onToggleLiveTail={() => setLiveTailEnabled(!liveTailEnabled)}
            pollInterval={pollInterval}
            onPollIntervalChange={setPollInterval}
            pollIntervals={POLL_INTERVALS}
            pollIntervalLabels={POLL_INTERVAL_LABELS}
            lastUpdatedText={lastUpdatedText}
            timePresets={TIME_PRESETS}
            activeTimePreset={activeTimePreset}
            onTimePreset={handleTimePreset}
            onClearTimePreset={clearTimePreset}
            logFormatMenu={logFormatMenu}
        />
    );

    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__container ServerLogs'>
                    {list}
                </div>
            </div>
        </div>
    );
}
