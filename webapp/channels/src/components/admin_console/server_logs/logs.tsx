// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import type {
    LogFilter,
    LogLevels,
    LogObject,
    LogServerNames,
} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import LogList from './log_list';
import PlainLogList from './plain_log_list';
import useLogPolling from './use_log_polling';

type LogObjectWithAdditionalInfo = LogObject & {
    [key: string]: string;
};

type Props = {
    logs: LogObjectWithAdditionalInfo[];
    plainLogs: string[];
    isPlainLogs: boolean;
    actions: {
        getLogs: (logFilter: LogFilter) => Promise<unknown>;
        getPlainLogs: (
            page?: number | undefined,
            perPage?: number | undefined
        ) => Promise<unknown>;
    };
};

const messages = defineMessages({
    title: {id: 'admin.logs.title', defaultMessage: 'Server Logs'},
    bannerDesc: {id: 'admin.logs.bannerDesc', defaultMessage: 'To look up users by User ID or Token ID, go to User Management > Users and paste the ID into the search filter.'},
    logFormatTitle: {id: 'admin.logs.logFormatTitle', defaultMessage: 'Log Format:'},
    logFormatJson: {id: 'admin.logs.logFormatJson', defaultMessage: 'JSON'},
    logFormatPlain: {id: 'admin.logs.logFormatPlain', defaultMessage: 'Plain text'},
});

export const searchableStrings = [
    messages.title,
    messages.bannerDesc,
];

const POLL_INTERVALS = [2000, 5000, 10000, 30000] as const;
const POLL_INTERVAL_LABELS: Record<number, string> = {
    2000: '2s',
    5000: '5s',
    10000: '10s',
    30000: '30s',
};

const TIME_PRESETS = [
    {labelId: 'admin.logs.time.5m', defaultMessage: '5m', minutes: 5},
    {labelId: 'admin.logs.time.15m', defaultMessage: '15m', minutes: 15},
    {labelId: 'admin.logs.time.1h', defaultMessage: '1h', minutes: 60},
    {labelId: 'admin.logs.time.24h', defaultMessage: '24h', minutes: 1440},
] as const;

export default function Logs({logs, plainLogs, isPlainLogs: configIsPlainLogs, actions}: Props) {
    const intl = useIntl();

    const [isPlainLogs, setIsPlainLogs] = useState(configIsPlainLogs);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Filter state
    const [serverNames, setServerNames] = useState<LogServerNames>([]);
    const [logLevels, setLogLevels] = useState<LogLevels>([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Plain log pagination
    const [plainPage, setPlainPage] = useState(0);
    const [perPage] = useState(1000);

    // Live tail state
    const [liveTailEnabled, setLiveTailEnabled] = useState(false);
    const [pollInterval, setPollInterval] = useState(5000);
    const [showPollDropdown, setShowPollDropdown] = useState(false);

    // Active time preset
    const [activeTimePreset, setActiveTimePreset] = useState<number | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        if (isPlainLogs) {
            await actions.getPlainLogs(plainPage, perPage);
        } else {
            await actions.getLogs({
                serverNames,
                logLevels,
                dateFrom,
                dateTo,
            });
        }
        setLoading(false);
    }, [isPlainLogs, plainPage, perPage, serverNames, logLevels, dateFrom, dateTo, actions]);

    // Initial load
    useEffect(() => {
        reload();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Reload when plain page changes
    useEffect(() => {
        if (isPlainLogs) {
            reload();
        }
    }, [plainPage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Live tail polling
    const {lastUpdated} = useLogPolling({
        fetchLogs: reload,
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

    const onFiltersChange = useCallback((filters: LogFilter) => {
        if (filters.serverNames !== undefined) {
            setServerNames(filters.serverNames);
        }
        if (filters.logLevels !== undefined) {
            setLogLevels(filters.logLevels);
        }
        if (filters.dateFrom !== undefined) {
            setDateFrom(filters.dateFrom);
        }
        if (filters.dateTo !== undefined) {
            setDateTo(filters.dateTo);
        }

        // Trigger reload with new filters
        setLoading(true);
        actions.getLogs({
            serverNames: filters.serverNames ?? serverNames,
            logLevels: filters.logLevels ?? logLevels,
            dateFrom: filters.dateFrom ?? dateFrom,
            dateTo: filters.dateTo ?? dateTo,
        }).then(() => setLoading(false));
    }, [actions, serverNames, logLevels, dateFrom, dateTo]);

    const onLogFormatToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const plain = event.target.value === 'plain';
        setIsPlainLogs(plain);
        if (plain) {
            setLiveTailEnabled(false);
        }
    }, []);

    // Time presets
    const handleTimePreset = useCallback((minutes: number) => {
        const now = new Date();
        const from = new Date(now.getTime() - (minutes * 60 * 1000));

        const pad = (n: number) => String(n).padStart(2, '0');
        const formatDate = (d: Date) => {
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000 +00:00`;
        };

        const newDateFrom = formatDate(from);
        const newDateTo = formatDate(now);

        setActiveTimePreset(minutes);
        setDateFrom(newDateFrom);
        setDateTo(newDateTo);

        setLoading(true);
        actions.getLogs({
            serverNames,
            logLevels,
            dateFrom: newDateFrom,
            dateTo: newDateTo,
        }).then(() => setLoading(false));
    }, [actions, serverNames, logLevels]);

    const clearTimePreset = useCallback(() => {
        setActiveTimePreset(null);
        setDateFrom('');
        setDateTo('');
        setLoading(true);
        actions.getLogs({
            serverNames,
            logLevels,
            dateFrom: '',
            dateTo: '',
        }).then(() => setLoading(false));
    }, [actions, serverNames, logLevels]);

    // Format "last updated" for live tail
    const lastUpdatedText = useMemo(() => {
        if (!lastUpdated) {
            return null;
        }
        const seconds = Math.round((Date.now() - lastUpdated) / 1000);
        if (seconds < 5) {
            return intl.formatMessage({id: 'admin.logs.justNow', defaultMessage: 'just now'});
        }
        return intl.formatMessage({id: 'admin.logs.secondsAgo', defaultMessage: '{n}s ago'}, {n: seconds});
    }, [lastUpdated, intl]);

    const displayLogs = searchFilteredLogs;

    const list = isPlainLogs ? (
        <PlainLogList
            loading={loading}
            logs={plainLogs}
            nextPage={() => setPlainPage((p) => p + 1)}
            previousPage={() => setPlainPage((p) => Math.max(0, p - 1))}
            page={plainPage}
            perPage={perPage}
        />
    ) : (
        <LogList
            loading={loading}
            logs={displayLogs as Array<LogObject & {[key: string]: string}>}
            onSearchChange={onSearchChange}
            search={search}
            onFiltersChange={onFiltersChange}
            onReload={reload}
            downloadUrl={Client4.getUrl() + '/api/v4/logs/download'}
            liveTailEnabled={liveTailEnabled}
            onToggleLiveTail={() => setLiveTailEnabled(!liveTailEnabled)}
            pollInterval={pollInterval}
            onPollIntervalChange={setPollInterval}
            pollIntervals={POLL_INTERVALS}
            pollIntervalLabels={POLL_INTERVAL_LABELS}
            showPollDropdown={showPollDropdown}
            onTogglePollDropdown={() => setShowPollDropdown(!showPollDropdown)}
            lastUpdatedText={lastUpdatedText}
            timePresets={TIME_PRESETS}
            activeTimePreset={activeTimePreset}
            onTimePreset={handleTimePreset}
            onClearTimePreset={clearTimePreset}
        />
    );

    const toggleLogFormat = !configIsPlainLogs ? (
        <div
            className='logs-banner__format'
            id='admin.logs.LogFormat'
            role='radiogroup'
            aria-labelledby='admin.logs.LogFormat.legend'
        >
            <span id='admin.logs.LogFormat.legend'>
                <FormattedMessage {...messages.logFormatTitle}/>
            </span>
            <label>
                <input
                    type='radio'
                    id='admin.logs.LogFormat.json'
                    name='log-format'
                    value='json'
                    checked={!isPlainLogs}
                    onChange={onLogFormatToggle}
                />
                <FormattedMessage {...messages.logFormatJson}/>
            </label>
            <label>
                <input
                    type='radio'
                    id='admin.logs.LogFormat.plain'
                    name='log-format'
                    value='plain'
                    checked={isPlainLogs}
                    onChange={onLogFormatToggle}
                />
                <FormattedMessage {...messages.logFormatPlain}/>
            </label>
        </div>
    ) : null;

    return (
        <div className='wrapper--admin'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-logs-content admin-console__content'>
                    <div className='logs-banner'>
                        <div className='logs-banner__top'>
                            <div className='banner'>
                                <div className='banner__content'>
                                    <FormattedMessage {...messages.bannerDesc}/>
                                </div>
                            </div>
                            {toggleLogFormat}
                        </div>
                    </div>
                    {list}
                </div>
            </div>
        </div>
    );
}
