// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {
    LogFilter,
    LogServerNames,
} from '@mattermost/types/admin';
import type {PluginRedux} from '@mattermost/types/plugins';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import LogFormatMenu from './log_format_menu';
import LogList, {loadPrefs} from './log_list';
import PlainLogList from './plain_log_list';
import type {CustomTimeRange, LogObjectWithAdditionalInfo, PluginOption, TimeRange} from './types';
import {parseUrlFilters, withUrlFilters} from './url_filters';
import useAccumulated from './use_accumulated';
import useLogPolling from './use_log_polling';
import {LEVEL_GROUPS, PLUGIN_ID_FIELD, groupLevels, presetStartMs} from './utils';

import './logs.scss';

type Props = {
    logs: LogObjectWithAdditionalInfo[];
    logNodes: string[];
    truncatedLogNodes: string[];
    plainLogs: string[];
    isPlainLogs: boolean;

    // Installed plugins, as loaded by the admin sidebar. None when plugins are off or the admin can't list them
    plugins: Record<string, PluginRedux>;
    actions: {
        getLogs: (logFilter: LogFilter) => Promise<ActionResult | undefined>;
        getNewLogs: (logFilter: LogFilter) => Promise<ActionResult | undefined>;
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

// A poll asks for everything logged since the previous fetch started, reaching back this much further
// for a browser clock ahead of the servers' and for entries flushed late. The repeats are dropped when merged
const POLL_OVERLAP_MS = 30000;

const ALL_SERVER_NAMES: LogServerNames = [];

const NO_PLUGINS: string[] = [];

const PLAIN_LOGS_PER_PAGE = 1000;

const PRESET_MINUTES = TIME_PRESETS.map((preset) => preset.minutes);

// A shared link's filters only apply to the structured viewer, so it opens there over a saved plain format
function getInitialFormat(configIsPlainLogs: boolean, hasUrlFilters: boolean): boolean {
    if (configIsPlainLogs) {
        return true;
    }
    if (hasUrlFilters) {
        return false;
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

export default function Logs({logs, logNodes, truncatedLogNodes, plainLogs, isPlainLogs: configIsPlainLogs, plugins, actions}: Props) {
    const history = useHistory();
    const [urlFilters] = useState(() => parseUrlFilters(history.location.search, PRESET_MINUTES));
    const [isPlainLogs, setIsPlainLogs] = useState(() => getInitialFormat(configIsPlainLogs, Object.keys(urlFilters).length > 0));
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(urlFilters.search ?? '');
    const [initialPrefs] = useState(loadPrefs);
    const [enabledLevels, setEnabledLevels] = useState(() => urlFilters.enabledLevels ?? new Set(initialPrefs.enabledLevels));
    const [selectedNode, setSelectedNode] = useState(urlFilters.node ?? initialPrefs.node);
    const [timeRange, setTimeRange] = useState<TimeRange>(urlFilters.timeRange ?? null);
    const [selectedPlugins, setSelectedPlugins] = useState(urlFilters.plugins ?? NO_PLUGINS);
    const [liveTailEnabled, setLiveTailEnabled] = useState(false);
    const [pollInterval, setPollInterval] = useState(30000);

    // The query this viewer last wrote, so a different one arriving is a navigation to a new view
    const writtenSearchRef = useRef(history.location.search);

    // Replaced rather than pushed, so changing filters doesn't fill the back button's history.
    // The search is mirrored once debounced, and the plain viewer has no filters to share
    useEffect(() => {
        const {location} = history;
        const query = withUrlFilters(location.search, isPlainLogs ? null : {search, enabledLevels, node: selectedNode, timeRange, plugins: selectedPlugins});
        writtenSearchRef.current = query;
        if (query !== location.search) {
            history.replace({...location, search: query});
        }
    }, [history, isPlainLogs, search, enabledLevels, selectedNode, timeRange, selectedPlugins]);

    // The search box keeps its own text, so it's remounted to show a search that arrived from the URL
    const [viewKey, setViewKey] = useState(0);

    // A link followed while this viewer is open replaces its filters, and what it leaves out falls back to the saved prefs
    useEffect(() => {
        const {pathname} = history.location;
        return history.listen((location) => {
            if (location.pathname !== pathname || location.search === writtenSearchRef.current) {
                return;
            }
            const filters = parseUrlFilters(location.search, PRESET_MINUTES);
            const prefs = loadPrefs();
            setSearch(filters.search ?? '');
            setEnabledLevels(filters.enabledLevels ?? new Set(prefs.enabledLevels));
            setSelectedNode(filters.node ?? prefs.node);
            setTimeRange(filters.timeRange ?? null);
            setSelectedPlugins(filters.plugins ?? NO_PLUGINS);

            // A range that ends in the past has nothing new to tail
            if (filters.timeRange && typeof filters.timeRange !== 'number') {
                setLiveTailEnabled(false);
            }
            if (!configIsPlainLogs && Object.keys(filters).length > 0) {
                setIsPlainLogs(false);
            }
            setViewKey((key) => key + 1);
        });
    }, [history, configIsPlainLogs]);

    const [plainPage, setPlainPage] = useState(0);

    // Moved on by every fetch, so entries age out of the range even when a poll brings nothing new
    const [timeRangeStart, setTimeRangeStart] = useState<number | null>(null);

    // Node-filtered responses only hold the selected node, so the list only ever grows
    const knownNodes = useAccumulated(logNodes);

    // Plugins seen in the logs are listed too: removed plugins can still have entries, and
    // admins who can't list the installed plugins can still filter by them.
    // Plugin-filtered responses only hold those plugins, so this list also only grows
    const pluginIdsInLogs = useMemo(() => Array.from(new Set(logs.map((log) => log[PLUGIN_ID_FIELD]).filter((id): id is string => typeof id === 'string' && id !== ''))), [logs]);
    const loggedPluginIds = useAccumulated(pluginIdsInLogs);

    const pluginOptions = useMemo(() => {
        const options = new Map<string, PluginOption>();
        for (const plugin of Object.values(plugins)) {
            options.set(plugin.id, {id: plugin.id, name: plugin.name || plugin.id});
        }

        // A selection from a link is still listed so it can be cleared
        for (const id of [...loggedPluginIds, ...selectedPlugins]) {
            if (!options.has(id)) {
                options.set(id, {id, name: id});
            }
        }
        return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    }, [plugins, loggedPluginIds, selectedPlugins]);

    // Picking "All logs" with no plugin picked keeps the same array, so it doesn't reload
    const changeSelectedPlugins = useCallback((ids: string[]) => {
        setSelectedPlugins((prev) => (ids.length === 0 && prev.length === 0 ? prev : ids));
    }, []);

    // A restored or departed node is still listed so it can be switched away from
    const nodes = useMemo(() => (
        selectedNode && !knownNodes.includes(selectedNode) ? [...knownNodes, selectedNode].sort() : knownNodes
    ), [knownNodes, selectedNode]);

    // When the last successful fetch started, so a poll only asks for what's been logged since.
    // Only a success moves it, so a failed poll's gap is covered by the next one
    const lastFetchStartRef = useRef<number | null>(null);

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

        // A preset has no end, so the server ends the range at its own clock rather than the browser's
        let rangeStart: number | null = null;
        let rangeEnd: number | null = null;
        if (typeof timeRange === 'number') {
            rangeStart = presetStartMs(timeRange);
        } else if (timeRange) {
            rangeStart = timeRange.from;
            rangeEnd = timeRange.to;
        }
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
            const allLevels = LEVEL_GROUPS.every((group) => enabledLevels.has(group));
            const logLevels = allLevels ? [] : LEVEL_GROUPS.filter((group) => enabledLevels.has(group)).flatMap(groupLevels);

            // A full reload covers the whole range, a poll only what's been logged since the last fetch
            if (!silent) {
                lastFetchStartRef.current = null;
            }
            const since = lastFetchStartRef.current === null ? rangeStart : Math.max(lastFetchStartRef.current - POLL_OVERLAP_MS, rangeStart ?? 0);
            const startedAt = Date.now();

            const query = {
                serverNames: selectedNode ? [selectedNode] : ALL_SERVER_NAMES,
                logLevels,
                dateFrom: since === null ? '' : formatFilterDate(new Date(since)),
                dateTo: rangeEnd === null ? '' : formatFilterDate(new Date(rangeEnd)),
                search,
                fields: selectedPlugins.length ? {[PLUGIN_ID_FIELD]: selectedPlugins} : undefined,
            };
            const result = await (silent ? actions.getNewLogs(query) : actions.getLogs(query));
            if (!result?.error) {
                lastFetchStartRef.current = startedAt;
            }
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
    }, [isPlainLogs, plainPage, timeRange, enabledLevels, selectedNode, search, selectedPlugins, actions]);

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

    const clearTimeRange = useCallback(() => setTimeRange(null), []);

    // A range that ends in the past has nothing new to tail
    const applyCustomRange = useCallback((range: CustomTimeRange) => {
        setTimeRange(range);
        setLiveTailEnabled(false);
    }, []);

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
            key={viewKey}
            loading={loading}
            logs={logs}
            truncatedNodes={truncatedLogNodes}
            onSearchChange={setSearch}
            search={search}
            enabledLevels={enabledLevels}
            onEnabledLevelsChange={setEnabledLevels}
            nodes={nodes}
            selectedNode={selectedNode}
            onSelectedNodeChange={setSelectedNode}
            plugins={pluginOptions}
            selectedPlugins={selectedPlugins}
            onSelectedPluginsChange={changeSelectedPlugins}
            onReload={handleReload}
            downloadUrl={Client4.getUrl() + '/api/v4/logs/download'}
            liveTailEnabled={liveTailEnabled}
            onToggleLiveTail={() => setLiveTailEnabled(!liveTailEnabled)}
            pollInterval={pollInterval}
            onPollIntervalChange={setPollInterval}
            pollIntervals={POLL_INTERVALS}
            pollIntervalLabels={POLL_INTERVAL_LABELS}
            timePresets={TIME_PRESETS}
            timeRange={timeRange}
            timeRangeStart={timeRangeStart}
            onTimePreset={setTimeRange}
            onCustomRange={applyCustomRange}
            onClearTimeRange={clearTimeRange}
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
                    <AdminPanel
                        id='server_logs'
                        className='ServerLogs__panel'
                    >
                        {list}
                    </AdminPanel>
                </div>
            </div>
        </div>
    );
}
