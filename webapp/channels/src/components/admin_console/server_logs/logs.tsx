// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {LogLevelEnum} from '@mattermost/types/admin';
import type {
    LogFilter,
    LogLevels,
    LogServerNames,
} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import LogFormatMenu from './log_format_menu';
import LogList, {loadPrefs} from './log_list';
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

const POLL_INTERVALS = [10000, 30000, 60000] as const;
const POLL_INTERVAL_LABELS = defineMessages<number>({
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

const ALL_SERVER_NAMES: LogServerNames = [];
const LOG_LEVELS: LogLevels = [LogLevelEnum.ERROR, LogLevelEnum.WARN, LogLevelEnum.INFO, LogLevelEnum.DEBUG];

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
    const [isPlainLogs, setIsPlainLogs] = useState(() => getInitialFormat(configIsPlainLogs));
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [enabledLevels, setEnabledLevels] = useState(() => new Set(loadPrefs().enabledLevels));
    const [activeTimePreset, setActiveTimePreset] = useState<number | null>(null);
    const [plainPage, setPlainPage] = useState(0);
    const [liveTailEnabled, setLiveTailEnabled] = useState(false);
    const [pollInterval, setPollInterval] = useState(30000);

    // Fetches run one at a time so a slow response can't land after, and
    // overwrite, a newer one
    const fetchQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const latestFetchRef = useRef(0);
    const pendingFetchesRef = useRef(0);

    // `silent` keeps the loading state untouched, so a background poll never
    // replaces the viewer with a spinner
    const reload = useCallback((options?: {silent?: boolean}) => {
        const silent = options?.silent === true;
        if (silent && pendingFetchesRef.current > 0) {
            return Promise.resolve();
        }

        const id = silent ? latestFetchRef.current : ++latestFetchRef.current;
        if (!silent) {
            setLoading(true);
        }

        const fetchLogs = async () => {
            // A newer fetch is queued behind this one and would overwrite its result
            if (id !== latestFetchRef.current) {
                return;
            }
            if (isPlainLogs) {
                await actions.getPlainLogs(plainPage, PLAIN_LOGS_PER_PAGE);
                return;
            }
            const {dateFrom, dateTo} = activeTimePreset === null ? {dateFrom: '', dateTo: ''} : presetRange(activeTimePreset);
            const allLevels = LOG_LEVELS.every((level) => enabledLevels.has(level));
            await actions.getLogs({
                serverNames: ALL_SERVER_NAMES,
                logLevels: allLevels ? [] : LOG_LEVELS.filter((level) => enabledLevels.has(level)),
                dateFrom,
                dateTo,
            });
        };

        pendingFetchesRef.current++;
        const fetched = fetchQueueRef.current.then(fetchLogs).finally(() => {
            pendingFetchesRef.current--;
            if (!silent && id === latestFetchRef.current) {
                setLoading(false);
            }
        });
        fetchQueueRef.current = fetched.catch(() => undefined);
        return fetched;
    }, [isPlainLogs, plainPage, activeTimePreset, enabledLevels, actions]);

    // Everything the query depends on is in reload's deps, so this covers the
    // first load and every filter, format and page change
    useEffect(() => {
        reload();
    }, [reload]);

    const pollLogs = useCallback(() => reload({silent: true}), [reload]);

    // Click handlers must not forward their event as reload options
    const handleReload = useCallback(() => reload(), [reload]);

    useLogPolling({
        fetchLogs: pollLogs,
        enabled: liveTailEnabled && !isPlainLogs,
        intervalMs: pollInterval,
    });

    const onLogFormatChange = useCallback((plain: boolean) => {
        setIsPlainLogs(plain);
        try {
            localStorage.setItem(LOG_FORMAT_PREF_KEY, plain ? 'plain' : 'structured');
        } catch {
            // ignore
        }
        if (plain) {
            setLiveTailEnabled(false);
        }
    }, []);

    const clearTimePreset = useCallback(() => setActiveTimePreset(null), []);

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
            logs={logs}
            onSearchChange={setSearch}
            search={search}
            enabledLevels={enabledLevels}
            onEnabledLevelsChange={setEnabledLevels}
            onReload={handleReload}
            downloadUrl={Client4.getUrl() + '/api/v4/logs/download'}
            liveTailEnabled={liveTailEnabled}
            onToggleLiveTail={() => setLiveTailEnabled(!liveTailEnabled)}
            pollInterval={pollInterval}
            onPollIntervalChange={setPollInterval}
            pollIntervals={POLL_INTERVALS}
            pollIntervalLabels={POLL_INTERVAL_LABELS}
            timePresets={TIME_PRESETS}
            activeTimePreset={activeTimePreset}
            onTimePreset={setActiveTimePreset}
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
