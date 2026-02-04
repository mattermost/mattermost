// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import webSocketClient from 'client/web_websocket_client';

import ProfilePicture from 'components/profile_picture';
import Timestamp from 'components/timestamp';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import StatusNotificationRules from './status_notification_rules';

import './status_log_dashboard.scss';
import './status_notification_rules.scss';

type StatusLog = {
    id: string;
    create_at: number;
    user_id: string;
    username: string;
    old_status: string;
    new_status: string;
    reason: string;
    window_active: boolean;
    channel_id?: string;
    device?: string;
    log_type?: string; // "status_change" or "activity"
    trigger?: string; // Human-readable trigger for activity logs
    manual?: boolean; // Whether this status change was triggered by manual user action (vs automatic)
    source?: string; // Code location that triggered this log (e.g., "SetStatusOnline")
    last_activity_at?: number; // The LastActivityAt timestamp that was set (for debugging time jumps)
};

type StatusLogStats = {
    total: number;
    online: number;
    away: number;
    dnd: number;
    offline: number;
};

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
};

// SVG Icons
const IconTrash = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='3 6 5 6 21 6'/>
        <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>
    </svg>
);

const IconDownload = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/>
        <polyline points='7 10 12 15 17 10'/>
        <line
            x1='12'
            y1='15'
            x2='12'
            y2='3'
        />
    </svg>
);

const IconCopy = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='9'
            y='9'
            width='13'
            height='13'
            rx='2'
            ry='2'
        />
        <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/>
    </svg>
);

const IconCheck = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='20 6 9 17 4 12'/>
    </svg>
);

const IconUser = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/>
        <circle
            cx='12'
            cy='7'
            r='4'
        />
    </svg>
);

const IconSearch = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='11'
            cy='11'
            r='8'
        />
        <line
            x1='21'
            y1='21'
            x2='16.65'
            y2='16.65'
        />
    </svg>
);

const IconCheckCircle = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/>
        <polyline points='22 4 12 14.01 9 11.01'/>
    </svg>
);

const IconArrowRight = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <line
            x1='5'
            y1='12'
            x2='19'
            y2='12'
        />
        <polyline points='12 5 19 12 12 19'/>
    </svg>
);

const IconActivity = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='22 12 18 12 15 21 9 3 6 12 2 12'/>
    </svg>
);

const IconFilter = () => (
    <svg
        width='16'
        height='16'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'/>
    </svg>
);

const IconX = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <line
            x1='18'
            y1='6'
            x2='6'
            y2='18'
        />
        <line
            x1='6'
            y1='6'
            x2='18'
            y2='18'
        />
    </svg>
);

const IconClock = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='12'
            cy='12'
            r='10'
        />
        <polyline points='12 6 12 12 16 14'/>
    </svg>
);

const IconStatusChange = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M21 12a9 9 0 11-6.219-8.56'/>
        <polyline points='21 3 21 9 15 9'/>
    </svg>
);

const IconWindow = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='3'
            y='3'
            width='18'
            height='18'
            rx='2'
            ry='2'
        />
        <line
            x1='3'
            y1='9'
            x2='21'
            y2='9'
        />
    </svg>
);

const IconDesktop = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='2'
            y='3'
            width='20'
            height='14'
            rx='2'
            ry='2'
        />
        <line
            x1='8'
            y1='21'
            x2='16'
            y2='21'
        />
        <line
            x1='12'
            y1='17'
            x2='12'
            y2='21'
        />
    </svg>
);

const IconMobile = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <rect
            x='5'
            y='2'
            width='14'
            height='20'
            rx='2'
            ry='2'
        />
        <line
            x1='12'
            y1='18'
            x2='12.01'
            y2='18'
        />
    </svg>
);

const IconGlobe = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='12'
            cy='12'
            r='10'
        />
        <line
            x1='2'
            y1='12'
            x2='22'
            y2='12'
        />
        <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/>
    </svg>
);

const IconApi = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <polyline points='16 18 22 12 16 6'/>
        <polyline points='8 6 2 12 8 18'/>
    </svg>
);

const IconQuestion = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='12'
            cy='12'
            r='10'
        />
        <path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/>
        <line
            x1='12'
            y1='17'
            x2='12.01'
            y2='17'
        />
    </svg>
);

const IconManual = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M12 2a10 10 0 1 0 10 10H12V2z'/>
        <circle
            cx='12'
            cy='12'
            r='4'
        />
    </svg>
);

const IconAuto = () => (
    <svg
        width='14'
        height='14'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <circle
            cx='12'
            cy='12'
            r='10'
        />
        <path d='M12 6v6l4 2'/>
    </svg>
);

// Filter type for status
type StatusFilter = 'all' | 'online' | 'away' | 'dnd' | 'offline';

// Filter type for log type
type LogTypeFilter = 'all' | 'status_change' | 'activity';

// Filter type for time period
type TimePeriodFilter = 'all' | '5m' | '15m' | '1h' | '6h' | '24h';

// Tab type
type TabType = 'logs' | 'rules';

const StatusLogDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [activeTab, setActiveTab] = useState<TabType>('logs');
    const [logs, setLogs] = useState<StatusLog[]>([]);
    const [stats, setStats] = useState<StatusLogStats>({total: 0, online: 0, away: 0, dnd: 0, offline: 0});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [timePeriodFilter, setTimePeriodFilter] = useState<TimePeriodFilter>('all');
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [allUsers, setAllUsers] = useState<{id: string; username: string}[]>([]);
    const perPage = 100;

    const isEnabled = config.MattermostExtendedSettings?.Statuses?.EnableStatusLogs === true;

    // Fetch all users on mount for the user filter dropdown
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                // Fetch users with a high per_page to get all users in one request
                // For larger instances, you might need pagination
                const users = await Client4.getProfiles(0, 200);
                setAllUsers(users.map((u) => ({id: u.id, username: u.username})).sort((a, b) => a.username.localeCompare(b.username)));
            } catch (e) {
                console.error('Failed to fetch users for filter dropdown:', e);
            }
        };
        fetchAllUsers();
    }, []);

    // Get time period cutoff in milliseconds (moved up for use in loadLogs/loadMore)
    const getTimePeriodCutoff = useCallback((period: TimePeriodFilter): number => {
        if (period === 'all') {
            return 0;
        }
        const now = Date.now();
        switch (period) {
        case '5m':
            return now - (5 * 60 * 1000);
        case '15m':
            return now - (15 * 60 * 1000);
        case '1h':
            return now - (60 * 60 * 1000);
        case '6h':
            return now - (6 * 60 * 60 * 1000);
        case '24h':
            return now - (24 * 60 * 60 * 1000);
        default:
            return 0;
        }
    }, []);

    const loadLogs = useCallback(async (page = 0, append = false, options?: {
        logType?: string;
        since?: number;
        username?: string;
        status?: string;
        search?: string;
    }) => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            // Build API options with server-side filters
            const apiOptions: {
                page: number;
                perPage: number;
                logType?: string;
                since?: number;
                username?: string;
                status?: string;
                search?: string;
            } = {page, perPage};

            // Apply log type filter server-side
            if (options?.logType && options.logType !== 'all') {
                apiOptions.logType = options.logType;
            }

            // Apply time period filter server-side
            if (options?.since && options.since > 0) {
                apiOptions.since = options.since;
            }

            // Apply username filter server-side
            if (options?.username && options.username !== 'all') {
                apiOptions.username = options.username;
            }

            // Apply status filter server-side
            if (options?.status && options.status !== 'all') {
                apiOptions.status = options.status;
            }

            // Apply search filter server-side
            if (options?.search) {
                apiOptions.search = options.search;
            }

            const response = await Client4.getStatusLogs(apiOptions);
            const newLogs = response.logs || [];

            if (append) {
                setLogs((prev) => [...prev, ...newLogs]);
            } else {
                setLogs(newLogs);
            }
            setStats(response.stats || {total: 0, online: 0, away: 0, dnd: 0, offline: 0});
            setHasMore(response.has_more || false);
            setTotalCount(response.total_count || 0);
            setCurrentPage(page);
        } catch (e) {
            console.error('Failed to load status logs:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [isEnabled, perPage]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            // Pass current filters to maintain consistency when loading more
            const since = getTimePeriodCutoff(timePeriodFilter);
            loadLogs(currentPage + 1, true, {
                logType: logTypeFilter,
                since: since > 0 ? since : undefined,
                username: userFilter,
                status: filter,
                search: search || undefined,
            });
        }
    }, [loadLogs, currentPage, loadingMore, hasMore, logTypeFilter, timePeriodFilter, userFilter, filter, search, getTimePeriodCutoff]);

    // Reload when any server-side filter changes
    // This resets to page 0 and fetches fresh data with the new filters
    useEffect(() => {
        const since = getTimePeriodCutoff(timePeriodFilter);
        loadLogs(0, false, {
            logType: logTypeFilter,
            since: since > 0 ? since : undefined,
            username: userFilter,
            status: filter,
            search: search || undefined,
        });
    }, [loadLogs, logTypeFilter, timePeriodFilter, userFilter, filter, search, getTimePeriodCutoff]);

    // WebSocket handler for real-time updates
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const handleWebSocketEvent = (msg: {event: string; data: {status_log: StatusLog}}) => {
            if (msg.event === 'status_log' && msg.data?.status_log) {
                const log = msg.data.status_log;
                const logType = log.log_type || 'status_change';

                // Check if log matches all current filters
                // This keeps the displayed list consistent with server-side filtering
                const matchesLogType = logTypeFilter === 'all' || logType === logTypeFilter;
                const matchesUser = userFilter === 'all' || log.username === userFilter;
                const matchesStatus = filter === 'all' || log.new_status === filter;
                const matchesSearch = !search || (
                    log.username.toLowerCase().includes(search.toLowerCase()) ||
                    log.reason.toLowerCase().includes(search.toLowerCase()) ||
                    (log.trigger && log.trigger.toLowerCase().includes(search.toLowerCase()))
                );

                if (matchesLogType && matchesUser && matchesStatus && matchesSearch) {
                    // Add to beginning, don't slice to allow all loaded logs to remain
                    setLogs((prev) => [log, ...prev]);
                    setTotalCount((prev) => prev + 1);

                    // Only update stats for status change logs, not activity logs
                    if (logType !== 'activity') {
                        setStats((prev) => ({
                            total: prev.total + 1,
                            online: prev.online + (log.new_status === 'online' ? 1 : 0),
                            away: prev.away + (log.new_status === 'away' ? 1 : 0),
                            dnd: prev.dnd + (log.new_status === 'dnd' ? 1 : 0),
                            offline: prev.offline + (log.new_status === 'offline' ? 1 : 0),
                        }));
                    }
                }
            }
        };

        webSocketClient.addMessageListener(handleWebSocketEvent);

        return () => {
            webSocketClient.removeMessageListener(handleWebSocketEvent);
        };
    }, [isEnabled, logTypeFilter, userFilter, filter, search]);

    const handleToggleFeature = async () => {
        try {
            // IMPORTANT: Spread existing settings to avoid overwriting other values
            await patchConfig({
                MattermostExtendedSettings: {
                    ...config.MattermostExtendedSettings,
                    Statuses: {
                        ...config.MattermostExtendedSettings?.Statuses,
                        EnableStatusLogs: !isEnabled,
                    },
                },
            });
        } catch (e) {
            console.error('Failed to toggle feature:', e);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm(intl.formatMessage({
            id: 'admin.status_log.clear_confirm',
            defaultMessage: 'Are you sure you want to clear all status logs?',
        }))) {
            return;
        }

        try {
            await Client4.clearStatusLogs();
            setLogs([]);
            setStats({total: 0, online: 0, away: 0, dnd: 0, offline: 0});
            setTotalCount(0);
            setHasMore(false);
            setCurrentPage(0);
        } catch (e) {
            console.error('Failed to clear status logs:', e);
        }
    };

    const handleExport = async () => {
        try {
            // Build export options based on current filters
            const exportOptions: {logType?: string; since?: number} = {};
            if (logTypeFilter !== 'all') {
                exportOptions.logType = logTypeFilter;
            }
            if (timePeriodFilter !== 'all') {
                const cutoff = getTimePeriodCutoff(timePeriodFilter);
                if (cutoff > 0) {
                    exportOptions.since = cutoff;
                }
            }

            const response = await Client4.exportStatusLogs(exportOptions);
            const exportData = {
                exported_at: new Date(response.exported_at).toISOString(),
                filters: {
                    status: filter,
                    log_type: logTypeFilter,
                    user: userFilter,
                    time_period: timePeriodFilter,
                    search: search || null,
                },
                stats: response.stats,
                total_count: response.total_count,
                logs: response.logs.map((log: StatusLog) => ({
                    id: log.id,
                    timestamp: new Date(log.create_at).toISOString(),
                    log_type: log.log_type || 'status_change',
                    user_id: log.user_id,
                    username: log.username,
                    old_status: log.old_status,
                    new_status: log.new_status,
                    reason: log.reason,
                    trigger: log.trigger || null,
                    device: log.device || 'unknown',
                    window_active: log.window_active,
                    channel_id: log.channel_id || null,
                    manual: log.manual || false,
                    source: log.source || null,
                    last_activity_at: log.last_activity_at ? new Date(log.last_activity_at).toISOString() : null,
                })),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mattermost-status-logs-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export status logs:', e);
        }
    };

    const copyLog = async (log: StatusLog) => {
        const text = formatLogForCopy(log);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(log.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    const formatLogForCopy = (log: StatusLog): string => {
        const isActivity = log.log_type === 'activity';
        const lines = [
            `Time: ${new Date(log.create_at).toISOString()}`,
            `Type: ${isActivity ? 'Activity' : 'Status Change'}`,
            `User: ${log.username}`,
        ];

        if (isActivity) {
            lines.push(`Status: ${log.new_status}`);
            if (log.trigger) {
                lines.push(`Trigger: ${log.trigger}`);
            }
        } else {
            lines.push(`Status Change: ${log.old_status} -> ${log.new_status}`);
            lines.push(`Reason: ${log.reason}`);
            lines.push(`Manual: ${log.manual ? 'Yes' : 'No'}`);
        }

        lines.push(`Device: ${getDeviceLabel(log.device)}`);
        lines.push(`Window Active: ${log.window_active ? 'Yes' : 'No'}`);

        if (log.channel_id) {
            lines.push(`Channel ID: ${log.channel_id}`);
        }

        if (log.source) {
            lines.push(`Source: ${log.source}`);
        }

        if (log.last_activity_at && log.last_activity_at > 0) {
            lines.push(`LastActivityAt: ${new Date(log.last_activity_at).toISOString()}`);
        }

        return lines.join('\n');
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return intl.formatMessage({id: 'admin.status_log.time.seconds', defaultMessage: '{count}s ago'}, {count: seconds});
        }
        if (minutes < 60) {
            return intl.formatMessage({id: 'admin.status_log.time.minutes', defaultMessage: '{count}m ago'}, {count: minutes});
        }
        if (hours < 24) {
            return intl.formatMessage({id: 'admin.status_log.time.hours', defaultMessage: '{count}h ago'}, {count: hours});
        }
        return intl.formatMessage({id: 'admin.status_log.time.days', defaultMessage: '{count}d ago'}, {count: days});
    };

    // Format timestamp in user's timezone (for LastActivityAt display in copy and tooltip)
    const formatTimestamp = (timestamp: number): string => {
        if (!timestamp || timestamp <= 0) {
            return 'N/A';
        }
        try {
            const date = new Date(timestamp);
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch {
            return 'Invalid';
        }
    };

    // Units for LastActivityAt timestamp display (same as Last Online in profile popover)
    const lastActivityTimestampUnits = ['now', 'minute', 'hour', 'day'];

    const getReasonLabel = (reason: string): string => {
        const reasonLabels: Record<string, string> = {
            window_focus: 'Window Focus',
            heartbeat: 'Heartbeat',
            inactivity: 'Inactivity',
            manual: 'Manual',
            offline_prevented: 'Offline Prevented',
            disconnect: 'Disconnect',
            connect: 'Connect',
        };
        return reasonLabels[reason] || reason;
    };

    const getDeviceIcon = (device?: string) => {
        switch (device) {
        case 'web':
            return <IconGlobe/>;
        case 'desktop':
            return <IconDesktop/>;
        case 'mobile':
            return <IconMobile/>;
        case 'api':
            return <IconApi/>;
        default:
            return <IconQuestion/>;
        }
    };

    const getDeviceLabel = (device?: string): string => {
        const deviceLabels: Record<string, string> = {
            web: 'Web',
            desktop: 'Desktop',
            mobile: 'Mobile',
            api: 'API',
            unknown: 'Unknown',
        };
        return deviceLabels[device || 'unknown'] || device || 'Unknown';
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
        case 'online':
            return 'online';
        case 'away':
            return 'away';
        case 'dnd':
            return 'dnd';
        case 'offline':
            return 'offline';
        default:
            return 'unknown';
        }
    };

    // Get usernames for user filter dropdown from all system users
    const uniqueUsers = useMemo(() => {
        return allUsers.map((u) => u.username);
    }, [allUsers]);

    // Filter logs
    const filteredLogs = useMemo(() => {
        const timeCutoff = getTimePeriodCutoff(timePeriodFilter);

        return logs.filter((log) => {
            // Filter by time period
            if (timeCutoff > 0 && log.create_at < timeCutoff) {
                return false;
            }

            // Filter by user
            if (userFilter !== 'all' && log.username !== userFilter) {
                return false;
            }

            // Filter by log type
            if (logTypeFilter !== 'all') {
                const logType = log.log_type || 'status_change'; // Default to status_change for older logs
                if (logType !== logTypeFilter) {
                    return false;
                }
            }

            // Filter by status type (only applies to status_change logs or when viewing all)
            if (filter !== 'all' && log.new_status !== filter) {
                return false;
            }

            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                return (
                    log.username.toLowerCase().includes(searchLower) ||
                    log.reason.toLowerCase().includes(searchLower) ||
                    log.old_status.toLowerCase().includes(searchLower) ||
                    log.new_status.toLowerCase().includes(searchLower) ||
                    (log.trigger && log.trigger.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });
    }, [logs, filter, logTypeFilter, userFilter, timePeriodFilter, search, getTimePeriodCutoff]);

    // Calculate log type counts (considering active filters except log type filter itself)
    const logTypeCounts = useMemo(() => {
        const timeCutoff = getTimePeriodCutoff(timePeriodFilter);

        const baseFiltered = logs.filter((log) => {
            // Apply time filter
            if (timeCutoff > 0 && log.create_at < timeCutoff) {
                return false;
            }
            // Apply user filter
            if (userFilter !== 'all' && log.username !== userFilter) {
                return false;
            }
            // Apply status filter
            if (filter !== 'all' && log.new_status !== filter) {
                return false;
            }
            // Apply search filter
            if (search) {
                const searchLower = search.toLowerCase();
                return (
                    log.username.toLowerCase().includes(searchLower) ||
                    log.reason.toLowerCase().includes(searchLower) ||
                    log.old_status.toLowerCase().includes(searchLower) ||
                    log.new_status.toLowerCase().includes(searchLower) ||
                    (log.trigger && log.trigger.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });

        const statusChanges = baseFiltered.filter((l) => l.log_type !== 'activity').length;
        const activity = baseFiltered.filter((l) => l.log_type === 'activity').length;
        return {
            total: baseFiltered.length,
            statusChanges,
            activity,
        };
    }, [logs, userFilter, timePeriodFilter, filter, search, getTimePeriodCutoff]);

    // Count active filters (excluding 'all' values)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filter !== 'all') {
            count++;
        }
        if (logTypeFilter !== 'all') {
            count++;
        }
        if (userFilter !== 'all') {
            count++;
        }
        if (timePeriodFilter !== 'all') {
            count++;
        }
        if (search) {
            count++;
        }
        return count;
    }, [filter, logTypeFilter, userFilter, timePeriodFilter, search]);

    // Clear all filters
    const clearAllFilters = () => {
        setFilter('all');
        setLogTypeFilter('all');
        setUserFilter('all');
        setTimePeriodFilter('all');
        setSearch('');
    };

    // Get time period label
    const getTimePeriodLabel = (period: TimePeriodFilter): string => {
        switch (period) {
        case '5m':
            return intl.formatMessage({id: 'admin.status_log.filter.time.5m', defaultMessage: 'Last 5 minutes'});
        case '15m':
            return intl.formatMessage({id: 'admin.status_log.filter.time.15m', defaultMessage: 'Last 15 minutes'});
        case '1h':
            return intl.formatMessage({id: 'admin.status_log.filter.time.1h', defaultMessage: 'Last hour'});
        case '6h':
            return intl.formatMessage({id: 'admin.status_log.filter.time.6h', defaultMessage: 'Last 6 hours'});
        case '24h':
            return intl.formatMessage({id: 'admin.status_log.filter.time.24h', defaultMessage: 'Last 24 hours'});
        default:
            return intl.formatMessage({id: 'admin.status_log.filter.time.all', defaultMessage: 'All time'});
        }
    };

    // Promotional card when feature is disabled
    if (!isEnabled) {
        return (
            <div className='wrapper--fixed StatusLogDashboard'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.status_log.title'
                        defaultMessage='Status Logs'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='StatusLogDashboard__promotional'>
                        <div className='StatusLogDashboard__promotional__icon'>
                            <IconSearch/>
                        </div>
                        <h3>
                            <FormattedMessage
                                id='admin.status_log.promo.title'
                                defaultMessage='Status Log Dashboard'
                            />
                        </h3>
                        <p>
                            <FormattedMessage
                                id='admin.status_log.promo.description'
                                defaultMessage='Monitor user status changes in real-time. Debug status tracking issues and understand user activity patterns.'
                            />
                        </p>
                        <ul className='StatusLogDashboard__promotional__features'>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.status_log.promo.feature1'
                                    defaultMessage='Real-time status change streaming via WebSocket'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.status_log.promo.feature2'
                                    defaultMessage='Track Online, Away, DND, and Offline transitions'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.status_log.promo.feature3'
                                    defaultMessage='See change reasons (heartbeat, inactivity, manual)'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.status_log.promo.feature4'
                                    defaultMessage='Persistent database storage with configurable retention'
                                />
                            </li>
                        </ul>
                        <button
                            className='btn btn-primary'
                            onClick={handleToggleFeature}
                        >
                            <FormattedMessage
                                id='admin.status_log.enable'
                                defaultMessage='Enable Status Logging'
                            />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='wrapper--fixed StatusLogDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.status_log.title'
                    defaultMessage='Status Logs'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='StatusLogDashboard__header'>
                    <h2>
                        <FormattedMessage
                            id='admin.status_log.dashboard_title'
                            defaultMessage='Status Log Dashboard'
                        />
                    </h2>
                </div>

                {/* Tabs */}
                <div className='StatusLogDashboard__tabs'>
                    <button
                        className={`StatusLogDashboard__tab ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        <IconStatusChange/>
                        <FormattedMessage
                            id='admin.status_log.tab.logs'
                            defaultMessage='Status Logs'
                        />
                    </button>
                    <button
                        className={`StatusLogDashboard__tab ${activeTab === 'rules' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rules')}
                    >
                        <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/>
                            <path d='M13.73 21a2 2 0 0 1-3.46 0'/>
                        </svg>
                        <FormattedMessage
                            id='admin.status_log.tab.rules'
                            defaultMessage='Push Notification Rules'
                        />
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'logs' ? (
                    <div className='StatusLogDashboard__tab-content'>
                        {/* Header Actions for Logs */}
                        <div className='StatusLogDashboard__header-actions'>
                            <button
                                className='btn btn-tertiary'
                                onClick={handleExport}
                                disabled={filteredLogs.length === 0}
                            >
                                <IconDownload/>
                                <FormattedMessage
                                    id='admin.status_log.export'
                                    defaultMessage='Export JSON'
                                />
                            </button>
                            <button
                                className='btn btn-danger'
                                onClick={handleClearAll}
                                disabled={logs.length === 0}
                            >
                                <IconTrash/>
                                <FormattedMessage
                                    id='admin.status_log.clear_all'
                                    defaultMessage='Clear All'
                                />
                            </button>
                        </div>

                        {/* Connection Status */}
                        <div className='StatusLogDashboard__connection'>
                    <div className='StatusLogDashboard__connection__dot'/>
                    <span className='StatusLogDashboard__connection__text'>
                        <FormattedMessage
                            id='admin.status_log.connected'
                            defaultMessage='Connected'
                        />
                    </span>
                    <span className='StatusLogDashboard__connection__subtitle'>
                        <FormattedMessage
                            id='admin.status_log.live_feed'
                            defaultMessage='Live Feed - Status changes stream in real-time'
                        />
                    </span>
                </div>

                {/* Filters */}
                <div className='StatusLogDashboard__filters'>
                    <div className='StatusLogDashboard__filters__row'>
                        <div className='StatusLogDashboard__filters__log-type'>
                            <button
                                className={`StatusLogDashboard__filters__log-type-btn ${logTypeFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setLogTypeFilter('all')}
                            >
                                <FormattedMessage
                                    id='admin.status_log.filter.all_logs'
                                    defaultMessage='All Logs'
                                />
                                <span className='StatusLogDashboard__filters__count'>{logTypeCounts.total}</span>
                            </button>
                            <button
                                className={`StatusLogDashboard__filters__log-type-btn ${logTypeFilter === 'status_change' ? 'active' : ''}`}
                                onClick={() => setLogTypeFilter('status_change')}
                            >
                                <IconStatusChange/>
                                <FormattedMessage
                                    id='admin.status_log.filter.status_changes'
                                    defaultMessage='Status Changes'
                                />
                                <span className='StatusLogDashboard__filters__count'>{logTypeCounts.statusChanges}</span>
                            </button>
                            <button
                                className={`StatusLogDashboard__filters__log-type-btn ${logTypeFilter === 'activity' ? 'active' : ''}`}
                                onClick={() => setLogTypeFilter('activity')}
                            >
                                <IconActivity/>
                                <FormattedMessage
                                    id='admin.status_log.filter.activity'
                                    defaultMessage='Activity'
                                />
                                <span className='StatusLogDashboard__filters__count'>{logTypeCounts.activity}</span>
                            </button>
                        </div>
                        <div className='StatusLogDashboard__filters__actions'>
                            <button
                                className={`StatusLogDashboard__filters__toggle-btn ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <IconFilter/>
                                <FormattedMessage
                                    id='admin.status_log.filter.filters'
                                    defaultMessage='Filters'
                                />
                                {activeFilterCount > 0 && (
                                    <span className='StatusLogDashboard__filters__badge'>{activeFilterCount}</span>
                                )}
                            </button>
                            {activeFilterCount > 0 && (
                                <button
                                    className='StatusLogDashboard__filters__clear-btn'
                                    onClick={clearAllFilters}
                                >
                                    <IconX/>
                                    <FormattedMessage
                                        id='admin.status_log.filter.clear'
                                        defaultMessage='Clear'
                                    />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Expanded filter panel */}
                    {showFilters && (
                        <div className='StatusLogDashboard__filters__panel'>
                            <div className='StatusLogDashboard__filters__group'>
                                <label>
                                    <IconUser/>
                                    <FormattedMessage
                                        id='admin.status_log.filter.user'
                                        defaultMessage='User'
                                    />
                                </label>
                                <select
                                    value={userFilter}
                                    onChange={(e) => setUserFilter(e.target.value)}
                                >
                                    <option value='all'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.all_users', defaultMessage: 'All users'})}
                                    </option>
                                    {uniqueUsers.map((username) => (
                                        <option
                                            key={username}
                                            value={username}
                                        >
                                            {username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='StatusLogDashboard__filters__group'>
                                <label>
                                    <IconClock/>
                                    <FormattedMessage
                                        id='admin.status_log.filter.time_period'
                                        defaultMessage='Time Period'
                                    />
                                </label>
                                <select
                                    value={timePeriodFilter}
                                    onChange={(e) => setTimePeriodFilter(e.target.value as TimePeriodFilter)}
                                >
                                    <option value='all'>{getTimePeriodLabel('all')}</option>
                                    <option value='5m'>{getTimePeriodLabel('5m')}</option>
                                    <option value='15m'>{getTimePeriodLabel('15m')}</option>
                                    <option value='1h'>{getTimePeriodLabel('1h')}</option>
                                    <option value='6h'>{getTimePeriodLabel('6h')}</option>
                                    <option value='24h'>{getTimePeriodLabel('24h')}</option>
                                </select>
                            </div>
                            <div className='StatusLogDashboard__filters__group'>
                                <label>
                                    <FormattedMessage
                                        id='admin.status_log.filter.status'
                                        defaultMessage='Status'
                                    />
                                </label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value as StatusFilter)}
                                >
                                    <option value='all'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.all_statuses', defaultMessage: 'All statuses'})}
                                    </option>
                                    <option value='online'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.online', defaultMessage: 'Online'})}
                                    </option>
                                    <option value='away'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.away', defaultMessage: 'Away'})}
                                    </option>
                                    <option value='dnd'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.dnd', defaultMessage: 'Do Not Disturb'})}
                                    </option>
                                    <option value='offline'>
                                        {intl.formatMessage({id: 'admin.status_log.filter.offline', defaultMessage: 'Offline'})}
                                    </option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className='StatusLogDashboard__filters__search'>
                        <IconSearch/>
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'admin.status_log.search', defaultMessage: 'Search by username, reason, or trigger...'})}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                className='StatusLogDashboard__filters__search-clear'
                                onClick={() => setSearch('')}
                            >
                                <IconX/>
                            </button>
                        )}
                    </div>

                    {/* Active filters display */}
                    {activeFilterCount > 0 && (
                        <div className='StatusLogDashboard__filters__active'>
                            <span className='StatusLogDashboard__filters__active-label'>
                                <FormattedMessage
                                    id='admin.status_log.filter.active_filters'
                                    defaultMessage='Active filters:'
                                />
                            </span>
                            {userFilter !== 'all' && (
                                <span className='StatusLogDashboard__filters__chip'>
                                    <IconUser/>
                                    {userFilter}
                                    <button onClick={() => setUserFilter('all')}><IconX/></button>
                                </span>
                            )}
                            {timePeriodFilter !== 'all' && (
                                <span className='StatusLogDashboard__filters__chip'>
                                    <IconClock/>
                                    {getTimePeriodLabel(timePeriodFilter)}
                                    <button onClick={() => setTimePeriodFilter('all')}><IconX/></button>
                                </span>
                            )}
                            {filter !== 'all' && (
                                <span className='StatusLogDashboard__filters__chip'>
                                    {filter}
                                    <button onClick={() => setFilter('all')}><IconX/></button>
                                </span>
                            )}
                            {logTypeFilter !== 'all' && (
                                <span className='StatusLogDashboard__filters__chip'>
                                    {logTypeFilter === 'activity' ? 'Activity' : 'Status Changes'}
                                    <button onClick={() => setLogTypeFilter('all')}><IconX/></button>
                                </span>
                            )}
                            {search && (
                                <span className='StatusLogDashboard__filters__chip'>
                                    <IconSearch/>
                                    "{search}"
                                    <button onClick={() => setSearch('')}><IconX/></button>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Results count */}
                    <div className='StatusLogDashboard__filters__results'>
                        <FormattedMessage
                            id='admin.status_log.filter.results'
                            defaultMessage='Showing {count} of {total} logs (loaded {loaded})'
                            values={{
                                count: filteredLogs.length,
                                total: totalCount,
                                loaded: logs.length,
                            }}
                        />
                    </div>
                </div>

                {/* Log List */}
                {loading ? (
                    <div className='StatusLogDashboard__empty'>
                        <FormattedMessage
                            id='admin.status_log.loading'
                            defaultMessage='Loading status logs...'
                        />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className='StatusLogDashboard__empty'>
                        <div className='StatusLogDashboard__empty__icon'>
                            <IconCheckCircle/>
                        </div>
                        <h4>
                            <FormattedMessage
                                id='admin.status_log.empty.title'
                                defaultMessage='No status changes recorded'
                            />
                        </h4>
                        <p>
                            <FormattedMessage
                                id='admin.status_log.empty.description'
                                defaultMessage='Status changes will appear here in real-time as they occur.'
                            />
                        </p>
                    </div>
                ) : (
                    <div className='StatusLogDashboard__list'>
                        {filteredLogs.map((log) => {
                            const isActivity = log.log_type === 'activity';
                            return (
                                <div
                                    key={log.id}
                                    className={`StatusLogDashboard__log-card ${isActivity ? 'StatusLogDashboard__log-card--activity' : ''}`}
                                >
                                    <div className='StatusLogDashboard__log-card__header'>
                                        <div className='StatusLogDashboard__log-card__header-left'>
                                            <span className='StatusLogDashboard__log-card__user'>
                                                {log.user_id ? (
                                                    <ProfilePicture
                                                        src={Client4.getProfilePictureUrl(log.user_id, 0)}
                                                        size='sm'
                                                        username={log.username}
                                                    />
                                                ) : (
                                                    <IconUser/>
                                                )}
                                                <span className='StatusLogDashboard__log-card__username'>
                                                    {log.username}
                                                </span>
                                            </span>
                                            {isActivity ? (
                                                <span className='StatusLogDashboard__log-card__activity-info'>
                                                    <span className={`StatusLogDashboard__log-card__status StatusLogDashboard__log-card__status--${getStatusColor(log.new_status)}`}>
                                                        {log.new_status}
                                                    </span>
                                                    {log.trigger && (
                                                        <span className='StatusLogDashboard__log-card__trigger'>
                                                            <IconActivity/>
                                                            {log.trigger}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className='StatusLogDashboard__log-card__status-change'>
                                                    <span className={`StatusLogDashboard__log-card__status StatusLogDashboard__log-card__status--${getStatusColor(log.old_status)}`}>
                                                        {log.old_status}
                                                    </span>
                                                    <IconArrowRight/>
                                                    <span className={`StatusLogDashboard__log-card__status StatusLogDashboard__log-card__status--${getStatusColor(log.new_status)}`}>
                                                        {log.new_status}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        <div className='StatusLogDashboard__log-card__header-right'>
                                            <span className={`StatusLogDashboard__log-card__type-badge ${isActivity ? 'activity' : 'status-change'}`}>
                                                {isActivity ? (
                                                    <>
                                                        <IconActivity/>
                                                        <FormattedMessage
                                                            id='admin.status_log.type.activity'
                                                            defaultMessage='Activity'
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconStatusChange/>
                                                        <FormattedMessage
                                                            id='admin.status_log.type.status_change'
                                                            defaultMessage='Status'
                                                        />
                                                    </>
                                                )}
                                            </span>
                                            <button
                                                className='StatusLogDashboard__log-card__action-btn'
                                                onClick={() => copyLog(log)}
                                                title={intl.formatMessage({id: 'admin.status_log.copy', defaultMessage: 'Copy log details'})}
                                            >
                                                {copiedId === log.id ? <IconCheck/> : <IconCopy/>}
                                            </button>
                                            <span className='StatusLogDashboard__log-card__time'>
                                                {formatRelativeTime(log.create_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className='StatusLogDashboard__log-card__meta'>
                                        {!isActivity && (
                                            <span className='StatusLogDashboard__log-card__reason'>
                                                {getReasonLabel(log.reason)}
                                            </span>
                                        )}
                                        {!isActivity && (
                                            <span className={`StatusLogDashboard__log-card__manual-badge ${log.manual ? 'manual' : 'auto'}`}>
                                                {log.manual ? <IconManual/> : <IconAuto/>}
                                                {log.manual ? (
                                                    <FormattedMessage
                                                        id='admin.status_log.manual'
                                                        defaultMessage='Manual'
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        id='admin.status_log.auto'
                                                        defaultMessage='Auto'
                                                    />
                                                )}
                                            </span>
                                        )}
                                        <span className='StatusLogDashboard__log-card__device'>
                                            {getDeviceIcon(log.device)}
                                            {getDeviceLabel(log.device)}
                                        </span>
                                        <span className={`StatusLogDashboard__log-card__window ${log.window_active ? 'active' : 'inactive'}`}>
                                            <IconWindow/>
                                            {log.window_active ? (
                                                <FormattedMessage
                                                    id='admin.status_log.window_active'
                                                    defaultMessage='Window Active'
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    id='admin.status_log.window_inactive'
                                                    defaultMessage='Window Inactive'
                                                />
                                            )}
                                        </span>
                                        {log.source && (
                                            <span className='StatusLogDashboard__log-card__source'>
                                                {log.source}
                                            </span>
                                        )}
                                        {typeof log.last_activity_at === 'number' && log.last_activity_at > 0 && (
                                            <span
                                                className='StatusLogDashboard__log-card__last-activity'
                                                title={formatTimestamp(log.last_activity_at)}
                                            >
                                                <IconClock/>
                                                <FormattedMessage
                                                    id='admin.status_log.last_activity_label'
                                                    defaultMessage='Last active: {time}'
                                                    values={{
                                                        time: (
                                                            <Timestamp
                                                                value={log.last_activity_at}
                                                                units={lastActivityTimestampUnits}
                                                                useTime={false}
                                                                style='short'
                                                            />
                                                        ),
                                                    }}
                                                />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {hasMore && (
                            <div className='StatusLogDashboard__load-more'>
                                <button
                                    className='btn btn-tertiary'
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <FormattedMessage
                                            id='admin.status_log.loading_more'
                                            defaultMessage='Loading...'
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='admin.status_log.load_more'
                                            defaultMessage='Load More ({loaded} of {total})'
                                            values={{
                                                loaded: logs.length,
                                                total: totalCount,
                                            }}
                                        />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                    </div>
                ) : (
                    <div className='StatusLogDashboard__tab-content'>
                        <StatusNotificationRules isEnabled={isEnabled}/>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatusLogDashboard;
