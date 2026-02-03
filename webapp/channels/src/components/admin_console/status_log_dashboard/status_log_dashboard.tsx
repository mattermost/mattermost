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
import AdminHeader from 'components/widgets/admin_console/admin_header';

import './status_log_dashboard.scss';

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
const IconChart = () => (
    <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <line
            x1='18'
            y1='20'
            x2='18'
            y2='10'
        />
        <line
            x1='12'
            y1='20'
            x2='12'
            y2='4'
        />
        <line
            x1='6'
            y1='20'
            x2='6'
            y2='14'
        />
    </svg>
);

const IconOnline = () => (
    <svg
        width='20'
        height='20'
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

const IconAway = () => (
    <svg
        width='20'
        height='20'
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
        <path d='M12 6v6'/>
    </svg>
);

const IconDnd = () => (
    <svg
        width='20'
        height='20'
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
            x1='8'
            y1='12'
            x2='16'
            y2='12'
        />
    </svg>
);

const IconOffline = () => (
    <svg
        width='20'
        height='20'
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
            x1='4.93'
            y1='4.93'
            x2='19.07'
            y2='19.07'
        />
    </svg>
);

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

// Filter type for status
type StatusFilter = 'all' | 'online' | 'away' | 'dnd' | 'offline';

// Filter type for log type
type LogTypeFilter = 'all' | 'status_change' | 'activity';

const StatusLogDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [logs, setLogs] = useState<StatusLog[]>([]);
    const [stats, setStats] = useState<StatusLogStats>({total: 0, online: 0, away: 0, dnd: 0, offline: 0});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('all');
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const isEnabled = config.MattermostExtendedSettings?.Statuses?.EnableStatusLogs === true;

    const loadLogs = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        try {
            const response = await Client4.getStatusLogs();
            setLogs(response.logs || []);
            setStats(response.stats || {total: 0, online: 0, away: 0, dnd: 0, offline: 0});
        } catch (e) {
            console.error('Failed to load status logs:', e);
        } finally {
            setLoading(false);
        }
    }, [isEnabled]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // WebSocket handler for real-time updates
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const handleWebSocketEvent = (msg: {event: string; data: {status_log: StatusLog}}) => {
            if (msg.event === 'status_log' && msg.data?.status_log) {
                const log = msg.data.status_log;
                setLogs((prev) => [log, ...prev].slice(0, 1000));

                // Only update stats for status change logs, not activity logs
                if (log.log_type !== 'activity') {
                    setStats((prev) => ({
                        total: prev.total + 1,
                        online: prev.online + (log.new_status === 'online' ? 1 : 0),
                        away: prev.away + (log.new_status === 'away' ? 1 : 0),
                        dnd: prev.dnd + (log.new_status === 'dnd' ? 1 : 0),
                        offline: prev.offline + (log.new_status === 'offline' ? 1 : 0),
                    }));
                }
            }
        };

        webSocketClient.addMessageListener(handleWebSocketEvent);

        return () => {
            webSocketClient.removeMessageListener(handleWebSocketEvent);
        };
    }, [isEnabled]);

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
        } catch (e) {
            console.error('Failed to clear status logs:', e);
        }
    };

    const handleExport = () => {
        const exportData = {
            exported_at: new Date().toISOString(),
            filter: filter,
            search: search || null,
            stats: {
                visible: filteredLogs.length,
                total: stats.total,
            },
            logs: filteredLogs.map((log) => ({
                id: log.id,
                timestamp: new Date(log.create_at).toISOString(),
                user_id: log.user_id,
                username: log.username,
                old_status: log.old_status,
                new_status: log.new_status,
                reason: log.reason,
                device: log.device || 'unknown',
                window_active: log.window_active,
                channel_id: log.channel_id || null,
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
        }

        lines.push(`Device: ${getDeviceLabel(log.device)}`);
        lines.push(`Window Active: ${log.window_active ? 'Yes' : 'No'}`);

        if (log.channel_id) {
            lines.push(`Channel ID: ${log.channel_id}`);
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

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
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
    }, [logs, filter, logTypeFilter, search]);

    // Calculate visible stats
    const visibleStats = useMemo(() => {
        const baseFiltered = logs.filter((log) => {
            if (search) {
                const searchLower = search.toLowerCase();
                return (
                    log.username.toLowerCase().includes(searchLower) ||
                    log.reason.toLowerCase().includes(searchLower)
                );
            }
            return true;
        });

        return {
            total: baseFiltered.length,
            online: baseFiltered.filter((l) => l.new_status === 'online').length,
            away: baseFiltered.filter((l) => l.new_status === 'away').length,
            dnd: baseFiltered.filter((l) => l.new_status === 'dnd').length,
            offline: baseFiltered.filter((l) => l.new_status === 'offline').length,
        };
    }, [logs, search]);

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
                                    defaultMessage='No database storage - lightweight in-memory buffer'
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
                    <div className='StatusLogDashboard__header__actions'>
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
                </div>

                {/* Stats Cards - clickable to filter */}
                <div className='StatusLogDashboard__stats'>
                    <div
                        className={`StatusLogDashboard__stat-card StatusLogDashboard__stat-card--clickable ${filter === 'all' ? 'StatusLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <div className='StatusLogDashboard__stat-card__icon StatusLogDashboard__stat-card__icon--total'>
                            <IconChart/>
                        </div>
                        <div className='StatusLogDashboard__stat-card__value'>
                            {visibleStats.total}
                            {visibleStats.total !== stats.total && (
                                <span className='StatusLogDashboard__stat-card__total'>
                                    {' / '}{stats.total}
                                </span>
                            )}
                        </div>
                        <div className='StatusLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.status_log.stat.total'
                                defaultMessage='All Changes'
                            />
                        </div>
                    </div>
                    <div
                        className={`StatusLogDashboard__stat-card StatusLogDashboard__stat-card--clickable ${filter === 'online' ? 'StatusLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('online')}
                    >
                        <div className='StatusLogDashboard__stat-card__icon StatusLogDashboard__stat-card__icon--online'>
                            <IconOnline/>
                        </div>
                        <div className='StatusLogDashboard__stat-card__value'>
                            {visibleStats.online}
                        </div>
                        <div className='StatusLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.status_log.stat.online'
                                defaultMessage='Online'
                            />
                        </div>
                    </div>
                    <div
                        className={`StatusLogDashboard__stat-card StatusLogDashboard__stat-card--clickable ${filter === 'away' ? 'StatusLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('away')}
                    >
                        <div className='StatusLogDashboard__stat-card__icon StatusLogDashboard__stat-card__icon--away'>
                            <IconAway/>
                        </div>
                        <div className='StatusLogDashboard__stat-card__value'>
                            {visibleStats.away}
                        </div>
                        <div className='StatusLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.status_log.stat.away'
                                defaultMessage='Away'
                            />
                        </div>
                    </div>
                    <div
                        className={`StatusLogDashboard__stat-card StatusLogDashboard__stat-card--clickable ${filter === 'dnd' ? 'StatusLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('dnd')}
                    >
                        <div className='StatusLogDashboard__stat-card__icon StatusLogDashboard__stat-card__icon--dnd'>
                            <IconDnd/>
                        </div>
                        <div className='StatusLogDashboard__stat-card__value'>
                            {visibleStats.dnd}
                        </div>
                        <div className='StatusLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.status_log.stat.dnd'
                                defaultMessage='DND'
                            />
                        </div>
                    </div>
                    <div
                        className={`StatusLogDashboard__stat-card StatusLogDashboard__stat-card--clickable ${filter === 'offline' ? 'StatusLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('offline')}
                    >
                        <div className='StatusLogDashboard__stat-card__icon StatusLogDashboard__stat-card__icon--offline'>
                            <IconOffline/>
                        </div>
                        <div className='StatusLogDashboard__stat-card__value'>
                            {visibleStats.offline}
                        </div>
                        <div className='StatusLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.status_log.stat.offline'
                                defaultMessage='Offline'
                            />
                        </div>
                    </div>
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
                    <div className='StatusLogDashboard__filters__log-type'>
                        <button
                            className={`StatusLogDashboard__filters__log-type-btn ${logTypeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setLogTypeFilter('all')}
                        >
                            <FormattedMessage
                                id='admin.status_log.filter.all_logs'
                                defaultMessage='All Logs'
                            />
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
                        </button>
                    </div>
                    <div className='StatusLogDashboard__filters__search'>
                        <IconSearch/>
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'admin.status_log.search', defaultMessage: 'Search by username, reason, or trigger...'})}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                                            <span className={`StatusLogDashboard__log-card__type-badge ${isActivity ? 'activity' : 'status'}`}>
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
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatusLogDashboard;
