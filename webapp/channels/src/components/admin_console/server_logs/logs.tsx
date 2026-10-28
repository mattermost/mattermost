// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {LogLevelEnum} from '@mattermost/types/admin';
import type {
    LogFilter,
    LogLevels,
    LogServerNames,
} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {useLatest} from 'hooks/useLatest';

import LogFormatMenu from './log_format_menu';
import LogList, {loadPrefs} from './log_list';
import PlainLogList from './plain_log_list';
import type {LogObjectWithAdditionalInfo} from './types';
import useLogPolling from './use_log_polling';
import {newestLogTimes, presetStartMs} from './utils';

import './logs.scss';

type Props = {
    logs: LogObjectWithAdditionalInfo[];
    logNodes: string[];
    plainLogs: string[];
    isPlainLogs: boolean;
    actions: {
        getLogs: (logFilter: LogFilter) => Promise<unknown>;
        getNewLogs: (logFilters: LogFilter[]) => Promise<unknown>;
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
    const pad = (n: number, width = 2) => String(n).padStart(width, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)} +00:00`;
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

export default function Logs({logs, logNodes, plainLogs, isPlainLogs: configIsPlainLogs, actions}: Props) {
    const [isPlainLogs, setIsPlainLogs] = useState(() => getInitialFormat(configIsPlainLogs));
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [initialPrefs] = useState(loadPrefs);
    const [enabledLevels, setEnabledLevels] = useState(() => new Set(initialPrefs.enabledLevels));
    const [selectedNode, setSelectedNode] = useState(initialPrefs.node);
    const [activeTimePreset, setActiveTimePreset] = useState<number | null>(null);
    const [plainPage, setPlainPage] = useState(0);
    const [liveTailEnabled, setLiveTailEnabled] = useState(false);
    const [pollInterval, setPollInterval] = useState(30000);

    // Moved on by every fetch, so entries age out of the range even when a poll brings nothing new
    const [timeRangeStart, setTimeRangeStart] = useState<number | null>(null);

    // Node-filtered responses only hold the selected node, so the list only ever grows
    const [knownNodes, setKnownNodes] = useState<string[]>([]);
    useEffect(() => {
        setKnownNodes((prev) => {
            const next = new Set([...prev, ...logNodes]);
            return next.size === prev.length ? prev : Array.from(next).sort();
        });
    }, [logNodes]);

    // A restored or departed node is still listed so it can be switched away from
    const nodes = useMemo(() => (
        selectedNode && !knownNodes.includes(selectedNode) ? [...knownNodes, selectedNode].sort() : knownNodes
    ), [knownNodes, selectedNode]);

    // Read by polls, which must not change reload and so trigger a full reload
    const logsRef = useLatest(logs);
    const logNodesRef = useLatest(logNodes);

    // One fetch at a time, so a slow response can't overwrite a newer one
    const fetchQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const latestFetchRef = useRef(0);
    const pendingFetchesRef = useRef(0);

    // `silent` polls leave the loading state alone so the viewer never flashes a spinner
    const reload = useCallback((options?: {silent?: boolean}) => {
        const silent = options?.silent === true;
        if (silent && pendingFetchesRef.current > 0) {
            return Promise.resolve();
        }

        const id = silent ? latestFetchRef.current : ++latestFetchRef.current;
        if (!silent) {
            setLoading(true);
        }

        const rangeStart = activeTimePreset === null ? null : presetStartMs(activeTimePreset);
        setTimeRangeStart(rangeStart);

        const fetchLogs = async () => {
            // A newer fetch is queued behind this one and would overwrite its result
            if (id !== latestFetchRef.current) {
                return;
            }
            if (isPlainLogs) {
                await actions.getPlainLogs(plainPage, PLAIN_LOGS_PER_PAGE);
                return;
            }
            const allLevels = LOG_LEVELS.every((level) => enabledLevels.has(level));
            const logLevels = allLevels ? [] : LOG_LEVELS.filter((level) => enabledLevels.has(level));

            // No end date, so the server ends the range at its own clock rather than the browser's
            const fullQuery = {
                serverNames: selectedNode ? [selectedNode] : ALL_SERVER_NAMES,
                logLevels,
                dateFrom: rangeStart === null ? '' : formatFilterDate(new Date(rangeStart)),
                dateTo: '',
            };
            if (!silent) {
                await actions.getLogs(fullQuery);
                return;
            }

            // A poll asks each node only for entries from its newest loaded one onwards. New nodes
            // aren't known until a full reload
            const nodes = selectedNode ? [selectedNode] : logNodesRef.current;
            const newest = newestLogTimes(logsRef.current);
            await actions.getNewLogs(nodes.length === 0 ? [fullQuery] : nodes.map((node) => ({
                ...fullQuery,
                serverNames: [node],
                dateFrom: node in newest ? formatFilterDate(new Date(newest[node])) : fullQuery.dateFrom,
            })));
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
    }, [isPlainLogs, plainPage, activeTimePreset, enabledLevels, selectedNode, actions, logsRef, logNodesRef]);

    // reload's deps are the query's inputs, so this also covers every filter and page change
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
            nodes={nodes}
            selectedNode={selectedNode}
            onSelectedNodeChange={setSelectedNode}
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
            timeRangeStart={timeRangeStart}
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
