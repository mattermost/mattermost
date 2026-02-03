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

import './error_log_dashboard.scss';

type ErrorLog = {
    id: string;
    create_at: number;
    type: 'api' | 'js';
    user_id: string;
    username: string;
    message: string;
    stack: string;
    url: string;
    user_agent: string;
    status_code?: number;
    endpoint?: string;
    method?: string;
    component_stack?: string;
    extra?: string;
    request_payload?: string;
    response_body?: string;
};

type ErrorLogStats = {
    total: number;
    api: number;
    js: number;
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

const IconAPI = () => (
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
            x1='2'
            y1='12'
            x2='22'
            y2='12'
        />
        <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/>
    </svg>
);

const IconJS = () => (
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
        <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/>
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

const IconChevronRight = () => (
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
        <polyline points='9 18 15 12 9 6'/>
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

const IconLink = () => (
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
        <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/>
        <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/>
    </svg>
);

const IconBrowser = () => (
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

const IconAlertCircle = () => (
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
            x1='12'
            y1='8'
            x2='12'
            y2='12'
        />
        <line
            x1='12'
            y1='16'
            x2='12.01'
            y2='16'
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

const IconVolumeX = () => (
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
        <polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'/>
        <line
            x1='23'
            y1='9'
            x2='17'
            y2='15'
        />
        <line
            x1='17'
            y1='9'
            x2='23'
            y2='15'
        />
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

const IconPlus = () => (
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
        <line
            x1='12'
            y1='5'
            x2='12'
            y2='19'
        />
        <line
            x1='5'
            y1='12'
            x2='19'
            y2='12'
        />
    </svg>
);

const IconList = () => (
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
        <line
            x1='8'
            y1='6'
            x2='21'
            y2='6'
        />
        <line
            x1='8'
            y1='12'
            x2='21'
            y2='12'
        />
        <line
            x1='8'
            y1='18'
            x2='21'
            y2='18'
        />
        <line
            x1='3'
            y1='6'
            x2='3.01'
            y2='6'
        />
        <line
            x1='3'
            y1='12'
            x2='3.01'
            y2='12'
        />
        <line
            x1='3'
            y1='18'
            x2='3.01'
            y2='18'
        />
    </svg>
);

const IconLayers = () => (
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
        <polygon points='12 2 2 7 12 12 22 7 12 2'/>
        <polyline points='2 17 12 22 22 17'/>
        <polyline points='2 12 12 17 22 12'/>
    </svg>
);

const IconEye = () => (
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
        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/>
        <circle
            cx='12'
            cy='12'
            r='3'
        />
    </svg>
);

const IconEyeOff = () => (
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
        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/>
        <line
            x1='1'
            y1='1'
            x2='23'
            y2='23'
        />
    </svg>
);

const IconChevronDown = () => (
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
        <polyline points='6 9 12 15 18 9'/>
    </svg>
);

// LocalStorage key for muted patterns
const MUTED_PATTERNS_KEY = 'errorLogDashboard_mutedPatterns';

const loadMutedPatterns = (): string[] => {
    try {
        const stored = localStorage.getItem(MUTED_PATTERNS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveMutedPatterns = (patterns: string[]) => {
    localStorage.setItem(MUTED_PATTERNS_KEY, JSON.stringify(patterns));
};

// View mode for error list
type ViewMode = 'list' | 'grouped';

// Grouped error type
type GroupedError = {
    message: string;
    type: 'api' | 'js';
    count: number;
    errors: ErrorLog[];
    latestError: ErrorLog;
    users: Set<string>;
};

const ErrorLogDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [errors, setErrors] = useState<ErrorLog[]>([]);
    const [stats, setStats] = useState<ErrorLogStats>({total: 0, api: 0, js: 0});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'api' | 'js'>('all');
    const [search, setSearch] = useState('');
    const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [mutedPatterns, setMutedPatterns] = useState<string[]>(loadMutedPatterns);
    const [showMutedManager, setShowMutedManager] = useState(false);
    const [newMutePattern, setNewMutePattern] = useState('');
    const [showMutedErrors, setShowMutedErrors] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const isEnabled = config.FeatureFlags?.ErrorLogDashboard === true;

    const loadErrors = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        try {
            const response = await Client4.getErrorLogs();
            setErrors(response.errors || []);
            setStats(response.stats || {total: 0, api: 0, js: 0});
        } catch (e) {
            console.error('Failed to load error logs:', e);
        } finally {
            setLoading(false);
        }
    }, [isEnabled]);

    useEffect(() => {
        loadErrors();
    }, [loadErrors]);

    // WebSocket handler for real-time updates
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const handleWebSocketEvent = (msg: {event: string; data: {error: ErrorLog}}) => {
            if (msg.event === 'error_logged' && msg.data?.error) {
                setErrors((prev) => [msg.data.error, ...prev].slice(0, 1000));
                setStats((prev) => ({
                    total: prev.total + 1,
                    api: prev.api + (msg.data.error.type === 'api' ? 1 : 0),
                    js: prev.js + (msg.data.error.type === 'js' ? 1 : 0),
                }));
            }
        };

        webSocketClient.addMessageListener(handleWebSocketEvent);

        return () => {
            webSocketClient.removeMessageListener(handleWebSocketEvent);
        };
    }, [isEnabled]);

    const handleToggleFeature = async () => {
        try {
            // IMPORTANT: Spread existing FeatureFlags to avoid overwriting other flags
            await patchConfig({
                FeatureFlags: {
                    ...config.FeatureFlags,
                    ErrorLogDashboard: !isEnabled,
                },
            });
        } catch (e) {
            console.error('Failed to toggle feature:', e);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm(intl.formatMessage({
            id: 'admin.error_log.clear_confirm',
            defaultMessage: 'Are you sure you want to clear all error logs?',
        }))) {
            return;
        }

        try {
            await Client4.clearErrorLogs();
            setErrors([]);
            setStats({total: 0, api: 0, js: 0});
        } catch (e) {
            console.error('Failed to clear error logs:', e);
        }
    };

    const handleExport = () => {
        const formatError = (error: ErrorLog) => ({
            id: error.id,
            type: error.type,
            timestamp: new Date(error.create_at).toISOString(),
            message: error.message,
            user: error.username || null,
            url: error.url || null,
            user_agent: error.user_agent || null,
            ...(error.type === 'api' ? {
                endpoint: error.endpoint || null,
                method: error.method || null,
                status_code: error.status_code || null,
                request_payload: error.request_payload ? tryParseJSON(error.request_payload) : null,
                response_body: error.response_body ? tryParseJSON(error.response_body) : null,
            } : {}),
            stack: error.stack || null,
            component_stack: error.component_stack || null,
        });

        const baseExport = {
            exported_at: new Date().toISOString(),
            view_mode: viewMode,
            filter: filter,
            search: search || null,
            showing_muted: showMutedErrors,
            stats: {
                visible: filteredErrors.length,
                total: stats.total,
            },
        };

        const exportData = viewMode === 'grouped' ? {
            ...baseExport,
            groups: groupedErrors.map((group) => {
                const groupKey = group.message.trim().toLowerCase();
                const isExpanded = expandedGroups.has(groupKey);

                return {
                    message: group.message,
                    type: group.type,
                    count: group.count,
                    users: Array.from(group.users),
                    latest_timestamp: new Date(group.latestError.create_at).toISOString(),
                    // Only include all errors if the group is expanded, otherwise just the latest
                    errors: isExpanded ? group.errors.map(formatError) : [formatError(group.latestError)],
                    expanded: isExpanded,
                };
            }),
        } : {
            ...baseExport,
            errors: filteredErrors.map(formatError),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mattermost-errors-${viewMode}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const toggleStack = (id: string) => {
        setExpandedStacks((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const copyError = async (error: ErrorLog) => {
        const text = formatErrorForCopy(error);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(error.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    const exportSingleError = (error: ErrorLog) => {
        const exportData = {
            exported_at: new Date().toISOString(),
            error: {
                id: error.id,
                type: error.type,
                timestamp: new Date(error.create_at).toISOString(),
                message: error.message,
                user: error.username || null,
                user_id: error.user_id || null,
                url: error.url || null,
                user_agent: error.user_agent || null,
                ...(error.type === 'api' ? {
                    endpoint: error.endpoint || null,
                    method: error.method || null,
                    status_code: error.status_code || null,
                    request_payload: error.request_payload ? tryParseJSON(error.request_payload) : null,
                    response_body: error.response_body ? tryParseJSON(error.response_body) : null,
                } : {}),
                stack: error.stack || null,
                component_stack: error.component_stack || null,
            },
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-${error.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const addMutedPattern = (pattern: string) => {
        if (pattern.trim() && !mutedPatterns.includes(pattern.trim())) {
            const newPatterns = [...mutedPatterns, pattern.trim()];
            setMutedPatterns(newPatterns);
            saveMutedPatterns(newPatterns);
        }
        setNewMutePattern('');
    };

    const removeMutedPattern = (pattern: string) => {
        const newPatterns = mutedPatterns.filter((p) => p !== pattern);
        setMutedPatterns(newPatterns);
        saveMutedPatterns(newPatterns);
    };

    const muteError = (error: ErrorLog) => {
        // Create a pattern from the error message (first 50 chars or full message if shorter)
        const pattern = error.message.length > 50 ? error.message.slice(0, 50) : error.message;
        addMutedPattern(pattern);
    };

    const isErrorMuted = (error: ErrorLog): boolean => {
        return mutedPatterns.some((pattern) =>
            error.message.toLowerCase().includes(pattern.toLowerCase()) ||
            (error.endpoint && error.endpoint.toLowerCase().includes(pattern.toLowerCase())),
        );
    };

    const formatErrorForCopy = (error: ErrorLog): string => {
        const lines = [
            `Type: ${error.type === 'api' ? 'API Error' : 'JavaScript Error'}`,
            `Time: ${new Date(error.create_at).toISOString()}`,
            `Message: ${error.message}`,
        ];

        if (error.username) {
            lines.push(`User: ${error.username}`);
        }
        if (error.url) {
            lines.push(`URL: ${error.url}`);
        }
        if (error.type === 'api') {
            if (error.method && error.endpoint) {
                lines.push(`Endpoint: ${error.method} ${error.endpoint}`);
            }
            if (error.status_code) {
                lines.push(`Status Code: ${error.status_code}`);
            }
            if (error.request_payload) {
                lines.push(`\nRequest Payload:\n${error.request_payload}`);
            }
            if (error.response_body) {
                lines.push(`\nResponse Body:\n${error.response_body}`);
            }
        }
        if (error.stack) {
            lines.push(`\nStack Trace:\n${error.stack}`);
        }
        if (error.component_stack) {
            lines.push(`\nComponent Stack:\n${error.component_stack}`);
        }
        if (error.user_agent) {
            lines.push(`\nUser Agent: ${error.user_agent}`);
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
            return intl.formatMessage({id: 'admin.error_log.time.seconds', defaultMessage: '{count}s ago'}, {count: seconds});
        }
        if (minutes < 60) {
            return intl.formatMessage({id: 'admin.error_log.time.minutes', defaultMessage: '{count}m ago'}, {count: minutes});
        }
        if (hours < 24) {
            return intl.formatMessage({id: 'admin.error_log.time.hours', defaultMessage: '{count}h ago'}, {count: hours});
        }
        return intl.formatMessage({id: 'admin.error_log.time.days', defaultMessage: '{count}d ago'}, {count: days});
    };

    // First filter by muted/search (for stats - doesn't include type filter)
    const baseFilteredErrors = errors.filter((error) => {
        // Filter by muted patterns (unless showMutedErrors is enabled)
        if (!showMutedErrors && isErrorMuted(error)) {
            return false;
        }
        if (search) {
            const searchLower = search.toLowerCase();
            return (
                error.message.toLowerCase().includes(searchLower) ||
                error.username?.toLowerCase().includes(searchLower) ||
                error.url?.toLowerCase().includes(searchLower) ||
                error.stack?.toLowerCase().includes(searchLower) ||
                error.request_payload?.toLowerCase().includes(searchLower) ||
                error.response_body?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    // Then filter by type for display
    const filteredErrors = baseFilteredErrors.filter((error) => {
        if (filter !== 'all' && error.type !== filter) {
            return false;
        }
        return true;
    });

    // Calculate muted count based on current filter tab
    const mutedCount = errors.filter((error) => {
        if (filter !== 'all' && error.type !== filter) {
            return false;
        }
        return isErrorMuted(error);
    }).length;

    // Calculate visible stats from base filtered (excludes type filter so counts stay constant)
    const visibleStats = {
        total: baseFilteredErrors.length,
        api: baseFilteredErrors.filter((e) => e.type === 'api').length,
        js: baseFilteredErrors.filter((e) => e.type === 'js').length,
    };

    // Group errors by message for grouped view
    const groupedErrors = React.useMemo(() => {
        const groups = new Map<string, GroupedError>();

        filteredErrors.forEach((error) => {
            // Create a key from the message (normalized)
            const key = error.message.trim().toLowerCase();

            if (groups.has(key)) {
                const group = groups.get(key)!;
                group.count++;
                group.errors.push(error);
                if (error.username) {
                    group.users.add(error.username);
                }
                // Keep track of the latest error
                if (error.create_at > group.latestError.create_at) {
                    group.latestError = error;
                }
            } else {
                const users = new Set<string>();
                if (error.username) {
                    users.add(error.username);
                }
                groups.set(key, {
                    message: error.message,
                    type: error.type,
                    count: 1,
                    errors: [error],
                    latestError: error,
                    users,
                });
            }
        });

        // Convert to array and sort by latest occurrence
        return Array.from(groups.values()).sort((a, b) => b.latestError.create_at - a.latestError.create_at);
    }, [filteredErrors]);

    const toggleGroup = (message: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            const key = message.trim().toLowerCase();
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Promotional card when feature is disabled
    if (!isEnabled) {
        return (
            <div className='wrapper--fixed ErrorLogDashboard'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.error_log.title'
                        defaultMessage='Error Logs'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='ErrorLogDashboard__promotional'>
                        <div className='ErrorLogDashboard__promotional__icon'>
                            <IconSearch/>
                        </div>
                        <h3>
                            <FormattedMessage
                                id='admin.error_log.promo.title'
                                defaultMessage='Error Log Dashboard'
                            />
                        </h3>
                        <p>
                            <FormattedMessage
                                id='admin.error_log.promo.description'
                                defaultMessage='Monitor API and JavaScript errors from all users in real-time. Quickly identify and debug issues affecting your users.'
                            />
                        </p>
                        <ul className='ErrorLogDashboard__promotional__features'>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature1'
                                    defaultMessage='Real-time error streaming via WebSocket'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature2'
                                    defaultMessage='Filter by error type, user, or search term'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature3'
                                    defaultMessage='View request payloads and response bodies'
                                />
                            </li>
                            <li>
                                <IconCheckCircle/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature4'
                                    defaultMessage='No database storage - lightweight in-memory buffer'
                                />
                            </li>
                        </ul>
                        <button
                            className='btn btn-primary'
                            onClick={handleToggleFeature}
                        >
                            <FormattedMessage
                                id='admin.error_log.enable'
                                defaultMessage='Enable Error Logging'
                            />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='wrapper--fixed ErrorLogDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.error_log.title'
                    defaultMessage='Error Logs'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='ErrorLogDashboard__header'>
                    <h2>
                        <FormattedMessage
                            id='admin.error_log.dashboard_title'
                            defaultMessage='Error Log Dashboard'
                        />
                    </h2>
                    <div className='ErrorLogDashboard__header__actions'>
                        <button
                            className='btn btn-tertiary'
                            onClick={handleExport}
                            disabled={filteredErrors.length === 0}
                        >
                            <IconDownload/>
                            <FormattedMessage
                                id='admin.error_log.export'
                                defaultMessage='Export JSON'
                            />
                        </button>
                        <button
                            className='btn btn-danger'
                            onClick={handleClearAll}
                            disabled={errors.length === 0}
                        >
                            <IconTrash/>
                            <FormattedMessage
                                id='admin.error_log.clear_all'
                                defaultMessage='Clear All'
                            />
                        </button>
                    </div>
                </div>

                {/* Stats Cards - clickable to filter */}
                <div className='ErrorLogDashboard__stats'>
                    <div
                        className={`ErrorLogDashboard__stat-card ErrorLogDashboard__stat-card--clickable ${filter === 'all' ? 'ErrorLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--total'>
                            <IconChart/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>
                            {visibleStats.total}
                            {visibleStats.total !== stats.total && (
                                <span className='ErrorLogDashboard__stat-card__total'>
                                    {' / '}{stats.total}
                                </span>
                            )}
                        </div>
                        <div className='ErrorLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.error_log.stat.total'
                                defaultMessage='All Errors'
                            />
                            {visibleStats.total !== stats.total && (
                                <span className='ErrorLogDashboard__stat-card__sublabel'>
                                    <FormattedMessage
                                        id='admin.error_log.stat.visible'
                                        defaultMessage=' (visible / total)'
                                    />
                                </span>
                            )}
                        </div>
                    </div>
                    <div
                        className={`ErrorLogDashboard__stat-card ErrorLogDashboard__stat-card--clickable ${filter === 'api' ? 'ErrorLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('api')}
                    >
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--api'>
                            <IconAPI/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>
                            {visibleStats.api}
                            {visibleStats.api !== stats.api && (
                                <span className='ErrorLogDashboard__stat-card__total'>
                                    {' / '}{stats.api}
                                </span>
                            )}
                        </div>
                        <div className='ErrorLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.error_log.stat.api'
                                defaultMessage='API Errors'
                            />
                        </div>
                    </div>
                    <div
                        className={`ErrorLogDashboard__stat-card ErrorLogDashboard__stat-card--clickable ${filter === 'js' ? 'ErrorLogDashboard__stat-card--selected' : ''}`}
                        onClick={() => setFilter('js')}
                    >
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--js'>
                            <IconJS/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>
                            {visibleStats.js}
                            {visibleStats.js !== stats.js && (
                                <span className='ErrorLogDashboard__stat-card__total'>
                                    {' / '}{stats.js}
                                </span>
                            )}
                        </div>
                        <div className='ErrorLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.error_log.stat.js'
                                defaultMessage='JS Errors'
                            />
                        </div>
                    </div>
                </div>

                {/* Connection Status */}
                <div className='ErrorLogDashboard__connection'>
                    <div className='ErrorLogDashboard__connection__dot'/>
                    <span className='ErrorLogDashboard__connection__text'>
                        <FormattedMessage
                            id='admin.error_log.connected'
                            defaultMessage='Connected'
                        />
                    </span>
                    <span className='ErrorLogDashboard__connection__subtitle'>
                        <FormattedMessage
                            id='admin.error_log.live_feed'
                            defaultMessage='Live Feed - Errors stream in real-time as they occur'
                        />
                    </span>
                </div>

                {/* Filters */}
                <div className='ErrorLogDashboard__filters'>
                    <div className='ErrorLogDashboard__filters__right'>
                        {/* View Mode Toggle */}
                        <div className='ErrorLogDashboard__filters__view-toggle'>
                            <button
                                className={`ErrorLogDashboard__filters__view-btn ${viewMode === 'grouped' ? 'ErrorLogDashboard__filters__view-btn--active' : ''}`}
                                onClick={() => setViewMode('grouped')}
                                title={intl.formatMessage({id: 'admin.error_log.view.grouped', defaultMessage: 'Grouped View'})}
                            >
                                <IconLayers/>
                            </button>
                            <button
                                className={`ErrorLogDashboard__filters__view-btn ${viewMode === 'list' ? 'ErrorLogDashboard__filters__view-btn--active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title={intl.formatMessage({id: 'admin.error_log.view.list', defaultMessage: 'List View'})}
                            >
                                <IconList/>
                            </button>
                        </div>

                        {/* Show Hidden Toggle */}
                        {mutedCount > 0 && (
                            <button
                                className={`ErrorLogDashboard__filters__show-hidden-btn ${showMutedErrors ? 'ErrorLogDashboard__filters__show-hidden-btn--active' : ''}`}
                                onClick={() => setShowMutedErrors(!showMutedErrors)}
                                title={intl.formatMessage({
                                    id: showMutedErrors ? 'admin.error_log.hide_muted' : 'admin.error_log.show_muted',
                                    defaultMessage: showMutedErrors ? 'Hide muted errors' : 'Show muted errors',
                                })}
                            >
                                {showMutedErrors ? <IconEyeOff/> : <IconEye/>}
                                <span>
                                    {showMutedErrors ? (
                                        <FormattedMessage
                                            id='admin.error_log.showing_hidden'
                                            defaultMessage='Showing {count} hidden'
                                            values={{count: mutedCount}}
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='admin.error_log.hidden_count'
                                            defaultMessage='{count} hidden'
                                            values={{count: mutedCount}}
                                        />
                                    )}
                                </span>
                            </button>
                        )}

                        {/* Muted Patterns Manager */}
                        <button
                            className={`ErrorLogDashboard__filters__mute-btn ${showMutedManager ? 'ErrorLogDashboard__filters__mute-btn--active' : ''}`}
                            onClick={() => setShowMutedManager(!showMutedManager)}
                            title={intl.formatMessage({id: 'admin.error_log.muted_patterns', defaultMessage: 'Muted Patterns'})}
                        >
                            <IconVolumeX/>
                            {mutedPatterns.length > 0 && (
                                <span className='ErrorLogDashboard__filters__mute-count'>
                                    {mutedPatterns.length}
                                </span>
                            )}
                        </button>
                        <div className='ErrorLogDashboard__filters__search'>
                            <IconSearch/>
                            <input
                                type='text'
                                placeholder={intl.formatMessage({id: 'admin.error_log.search', defaultMessage: 'Search errors...'})}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Muted Patterns Manager */}
                {showMutedManager && (
                    <div className='ErrorLogDashboard__muted-manager'>
                        <div className='ErrorLogDashboard__muted-manager__header'>
                            <h4>
                                <FormattedMessage
                                    id='admin.error_log.muted_patterns_title'
                                    defaultMessage='Muted Patterns'
                                />
                            </h4>
                            <span className='ErrorLogDashboard__muted-manager__desc'>
                                <FormattedMessage
                                    id='admin.error_log.muted_patterns_desc'
                                    defaultMessage='Errors matching these patterns will be hidden'
                                />
                            </span>
                        </div>
                        <div className='ErrorLogDashboard__muted-manager__add'>
                            <input
                                type='text'
                                placeholder={intl.formatMessage({id: 'admin.error_log.add_pattern', defaultMessage: 'Add pattern to mute...'})}
                                value={newMutePattern}
                                onChange={(e) => setNewMutePattern(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        addMutedPattern(newMutePattern);
                                    }
                                }}
                            />
                            <button
                                className='btn btn-primary btn-sm'
                                onClick={() => addMutedPattern(newMutePattern)}
                                disabled={!newMutePattern.trim()}
                            >
                                <IconPlus/>
                                <FormattedMessage
                                    id='admin.error_log.add'
                                    defaultMessage='Add'
                                />
                            </button>
                        </div>
                        {mutedPatterns.length === 0 ? (
                            <div className='ErrorLogDashboard__muted-manager__empty'>
                                <FormattedMessage
                                    id='admin.error_log.no_muted_patterns'
                                    defaultMessage='No muted patterns. Click "Mute similar" on any error to add one.'
                                />
                            </div>
                        ) : (
                            <div className='ErrorLogDashboard__muted-manager__list'>
                                {mutedPatterns.map((pattern) => (
                                    <div
                                        key={pattern}
                                        className='ErrorLogDashboard__muted-manager__item'
                                    >
                                        <span className='ErrorLogDashboard__muted-manager__pattern'>
                                            {pattern}
                                        </span>
                                        <button
                                            className='ErrorLogDashboard__muted-manager__remove'
                                            onClick={() => removeMutedPattern(pattern)}
                                            title={intl.formatMessage({id: 'admin.error_log.remove_pattern', defaultMessage: 'Remove pattern'})}
                                        >
                                            <IconX/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Error List */}
                {loading ? (
                    <div className='ErrorLogDashboard__empty'>
                        <FormattedMessage
                            id='admin.error_log.loading'
                            defaultMessage='Loading errors...'
                        />
                    </div>
                ) : filteredErrors.length === 0 ? (
                    <div className='ErrorLogDashboard__empty'>
                        <div className='ErrorLogDashboard__empty__icon'>
                            <IconCheckCircle/>
                        </div>
                        <h4>
                            <FormattedMessage
                                id='admin.error_log.empty.title'
                                defaultMessage='No errors recorded'
                            />
                        </h4>
                        <p>
                            <FormattedMessage
                                id='admin.error_log.empty.description'
                                defaultMessage='Errors will appear here in real-time as they occur.'
                            />
                        </p>
                    </div>
                ) : viewMode === 'grouped' ? (
                    <div className='ErrorLogDashboard__list'>
                        {groupedErrors.map((group) => {
                            const isExpanded = expandedGroups.has(group.message.trim().toLowerCase());
                            const isMuted = isErrorMuted(group.latestError);
                            return (
                                <div
                                    key={group.message}
                                    className={`ErrorLogDashboard__group-card ErrorLogDashboard__group-card--${group.type} ${isMuted ? 'ErrorLogDashboard__group-card--muted' : ''}`}
                                >
                                    <div
                                        className='ErrorLogDashboard__group-card__header'
                                        onClick={() => toggleGroup(group.message)}
                                    >
                                        <div className='ErrorLogDashboard__group-card__header-left'>
                                            <span className={`ErrorLogDashboard__group-card__expand ${isExpanded ? 'expanded' : ''}`}>
                                                <IconChevronDown/>
                                            </span>
                                            <span className={`ErrorLogDashboard__error-card__badge ErrorLogDashboard__error-card__badge--${group.type}`}>
                                                {group.type === 'api' ? <IconAlertCircle/> : <IconJS/>}
                                                {group.type === 'api' ? 'API' : 'JS'}
                                            </span>
                                            <span className='ErrorLogDashboard__group-card__count'>
                                                <FormattedMessage
                                                    id='admin.error_log.group.count'
                                                    defaultMessage='{count} {count, plural, one {occurrence} other {occurrences}}'
                                                    values={{count: group.count}}
                                                />
                                            </span>
                                            {group.users.size > 0 && (
                                                <span className='ErrorLogDashboard__group-card__users'>
                                                    <IconUser/>
                                                    <FormattedMessage
                                                        id='admin.error_log.group.users'
                                                        defaultMessage='{count} {count, plural, one {user} other {users}}'
                                                        values={{count: group.users.size}}
                                                    />
                                                </span>
                                            )}
                                            {isMuted && (
                                                <span className='ErrorLogDashboard__group-card__muted-badge'>
                                                    <IconVolumeX/>
                                                    <FormattedMessage
                                                        id='admin.error_log.muted'
                                                        defaultMessage='Muted'
                                                    />
                                                </span>
                                            )}
                                        </div>
                                        <div className='ErrorLogDashboard__group-card__header-right'>
                                            <button
                                                className='ErrorLogDashboard__error-card__action-btn'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    muteError(group.latestError);
                                                }}
                                                title={intl.formatMessage({id: 'admin.error_log.mute_similar', defaultMessage: 'Mute similar errors'})}
                                            >
                                                <IconVolumeX/>
                                            </button>
                                            <button
                                                className='ErrorLogDashboard__error-card__action-btn'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    exportSingleError(group.latestError);
                                                }}
                                                title={intl.formatMessage({id: 'admin.error_log.export_single', defaultMessage: 'Export as JSON'})}
                                            >
                                                <IconDownload/>
                                            </button>
                                            <button
                                                className='ErrorLogDashboard__error-card__action-btn'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyError(group.latestError);
                                                }}
                                                title={intl.formatMessage({id: 'admin.error_log.copy', defaultMessage: 'Copy error details'})}
                                            >
                                                {copiedId === group.latestError.id ? <IconCheck/> : <IconCopy/>}
                                            </button>
                                            <span className='ErrorLogDashboard__error-card__time'>
                                                {formatRelativeTime(group.latestError.create_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className='ErrorLogDashboard__error-card__message'>
                                        {group.message}
                                    </div>
                                    {isExpanded && (
                                        <div className='ErrorLogDashboard__group-card__errors'>
                                            {group.errors.map((error) => (
                                                <div
                                                    key={error.id}
                                                    className={`ErrorLogDashboard__error-card ErrorLogDashboard__error-card--${error.type} ErrorLogDashboard__error-card--nested`}
                                                >
                                                    <div className='ErrorLogDashboard__error-card__header'>
                                                        <div className='ErrorLogDashboard__error-card__header-left'>
                                                            <span className={`ErrorLogDashboard__error-card__badge ErrorLogDashboard__error-card__badge--${error.type}`}>
                                                                {error.type === 'api' ? <IconAlertCircle/> : <IconJS/>}
                                                                {error.type === 'api' ? (
                                                                    <FormattedMessage
                                                                        id='admin.error_log.type.api'
                                                                        defaultMessage='API Error'
                                                                    />
                                                                ) : (
                                                                    <FormattedMessage
                                                                        id='admin.error_log.type.js'
                                                                        defaultMessage='JavaScript Error'
                                                                    />
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className='ErrorLogDashboard__error-card__header-right'>
                                                            <button
                                                                className='ErrorLogDashboard__error-card__action-btn'
                                                                onClick={() => exportSingleError(error)}
                                                                title={intl.formatMessage({id: 'admin.error_log.export_single', defaultMessage: 'Export as JSON'})}
                                                            >
                                                                <IconDownload/>
                                                            </button>
                                                            <button
                                                                className='ErrorLogDashboard__error-card__action-btn'
                                                                onClick={() => copyError(error)}
                                                                title={intl.formatMessage({id: 'admin.error_log.copy', defaultMessage: 'Copy error details'})}
                                                            >
                                                                {copiedId === error.id ? <IconCheck/> : <IconCopy/>}
                                                            </button>
                                                            <span className='ErrorLogDashboard__error-card__time'>
                                                                {formatRelativeTime(error.create_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {error.type === 'api' && error.endpoint && (
                                                        <div className='ErrorLogDashboard__error-card__endpoint'>
                                                            <span className='ErrorLogDashboard__error-card__method'>{error.method}</span>
                                                            {error.endpoint}
                                                            {error.status_code && (
                                                                <span className='ErrorLogDashboard__error-card__status'>
                                                                    {error.status_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className='ErrorLogDashboard__error-card__message'>
                                                        {error.message}
                                                    </div>

                                                    <div className='ErrorLogDashboard__error-card__meta'>
                                                        {error.username && (
                                                            <span className='ErrorLogDashboard__error-card__meta__item ErrorLogDashboard__error-card__meta__item--user'>
                                                                {error.user_id ? (
                                                                    <ProfilePicture
                                                                        src={Client4.getProfilePictureUrl(error.user_id, 0)}
                                                                        size='xs'
                                                                        username={error.username}
                                                                    />
                                                                ) : (
                                                                    <IconUser/>
                                                                )}
                                                                {error.username}
                                                            </span>
                                                        )}
                                                        {error.url && (
                                                            <span className='ErrorLogDashboard__error-card__meta__item'>
                                                                <IconLink/>
                                                                {error.url}
                                                            </span>
                                                        )}
                                                        {error.user_agent && (
                                                            <span className='ErrorLogDashboard__error-card__meta__item'>
                                                                <IconBrowser/>
                                                                {extractBrowserInfo(error.user_agent)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* API Error Details: Request Payload and Response */}
                                                    {error.type === 'api' && (error.request_payload || error.response_body) && (
                                                        <div className='ErrorLogDashboard__error-card__api-details'>
                                                            {error.request_payload && (
                                                                <div className='ErrorLogDashboard__error-card__api-section'>
                                                                    <div className='ErrorLogDashboard__error-card__api-section__title'>
                                                                        Request Payload
                                                                    </div>
                                                                    <pre className='ErrorLogDashboard__error-card__api-section__content'>
                                                                        {error.request_payload}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {error.response_body && (
                                                                <div className='ErrorLogDashboard__error-card__api-section'>
                                                                    <div className='ErrorLogDashboard__error-card__api-section__title'>
                                                                        Response Body
                                                                    </div>
                                                                    <pre className='ErrorLogDashboard__error-card__api-section__content'>
                                                                        {error.response_body}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {error.stack && (
                                                        <>
                                                            <button
                                                                className='ErrorLogDashboard__error-card__stack-toggle'
                                                                onClick={() => toggleStack(error.id)}
                                                            >
                                                                <span className={`ErrorLogDashboard__error-card__stack-toggle__icon ${expandedStacks.has(error.id) ? 'expanded' : ''}`}>
                                                                    <IconChevronRight/>
                                                                </span>
                                                                <FormattedMessage
                                                                    id='admin.error_log.stack_trace'
                                                                    defaultMessage='Stack Trace'
                                                                />
                                                            </button>
                                                            {expandedStacks.has(error.id) && (
                                                                <div className='ErrorLogDashboard__error-card__stack'>
                                                                    {error.stack}
                                                                    {error.component_stack && (
                                                                        <>
                                                                            {'\n\nComponent Stack:\n'}
                                                                            {error.component_stack}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className='ErrorLogDashboard__list'>
                        {filteredErrors.map((error) => {
                            const isMuted = isErrorMuted(error);
                            return (
                                <div
                                    key={error.id}
                                    className={`ErrorLogDashboard__error-card ErrorLogDashboard__error-card--${error.type} ${isMuted ? 'ErrorLogDashboard__error-card--muted' : ''}`}
                                >
                                    <div className='ErrorLogDashboard__error-card__header'>
                                        <div className='ErrorLogDashboard__error-card__header-left'>
                                            <span className={`ErrorLogDashboard__error-card__badge ErrorLogDashboard__error-card__badge--${error.type}`}>
                                                {error.type === 'api' ? <IconAlertCircle/> : <IconJS/>}
                                                {error.type === 'api' ? (
                                                    <FormattedMessage
                                                        id='admin.error_log.type.api'
                                                        defaultMessage='API Error'
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        id='admin.error_log.type.js'
                                                        defaultMessage='JavaScript Error'
                                                    />
                                                )}
                                            </span>
                                            {isMuted && (
                                                <span className='ErrorLogDashboard__error-card__muted-badge'>
                                                    <IconVolumeX/>
                                                    <FormattedMessage
                                                        id='admin.error_log.muted'
                                                        defaultMessage='Muted'
                                                    />
                                                </span>
                                            )}
                                        </div>
                                        <div className='ErrorLogDashboard__error-card__header-right'>
                                            <button
                                                className='ErrorLogDashboard__error-card__action-btn'
                                                onClick={() => muteError(error)}
                                                title={intl.formatMessage({id: 'admin.error_log.mute_similar', defaultMessage: 'Mute similar errors'})}
                                            >
                                                <IconVolumeX/>
                                            </button>
                                        <button
                                            className='ErrorLogDashboard__error-card__action-btn'
                                            onClick={() => exportSingleError(error)}
                                            title={intl.formatMessage({id: 'admin.error_log.export_single', defaultMessage: 'Export as JSON'})}
                                        >
                                            <IconDownload/>
                                        </button>
                                        <button
                                            className='ErrorLogDashboard__error-card__action-btn'
                                            onClick={() => copyError(error)}
                                            title={intl.formatMessage({id: 'admin.error_log.copy', defaultMessage: 'Copy error details'})}
                                        >
                                            {copiedId === error.id ? <IconCheck/> : <IconCopy/>}
                                        </button>
                                        <span className='ErrorLogDashboard__error-card__time'>
                                            {formatRelativeTime(error.create_at)}
                                        </span>
                                    </div>
                                </div>

                                {error.type === 'api' && error.endpoint && (
                                    <div className='ErrorLogDashboard__error-card__endpoint'>
                                        <span className='ErrorLogDashboard__error-card__method'>{error.method}</span>
                                        {error.endpoint}
                                        {error.status_code && (
                                            <span className='ErrorLogDashboard__error-card__status'>
                                                {error.status_code}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className='ErrorLogDashboard__error-card__message'>
                                    {error.message}
                                </div>

                                <div className='ErrorLogDashboard__error-card__meta'>
                                    {error.username && (
                                        <span className='ErrorLogDashboard__error-card__meta__item ErrorLogDashboard__error-card__meta__item--user'>
                                            {error.user_id ? (
                                                <ProfilePicture
                                                    src={Client4.getProfilePictureUrl(error.user_id, 0)}
                                                    size='xs'
                                                    username={error.username}
                                                />
                                            ) : (
                                                <IconUser/>
                                            )}
                                            {error.username}
                                        </span>
                                    )}
                                    {error.url && (
                                        <span className='ErrorLogDashboard__error-card__meta__item'>
                                            <IconLink/>
                                            {error.url}
                                        </span>
                                    )}
                                    {error.user_agent && (
                                        <span className='ErrorLogDashboard__error-card__meta__item'>
                                            <IconBrowser/>
                                            {extractBrowserInfo(error.user_agent)}
                                        </span>
                                    )}
                                </div>

                                {/* API Error Details: Request Payload and Response */}
                                {error.type === 'api' && (error.request_payload || error.response_body) && (
                                    <div className='ErrorLogDashboard__error-card__api-details'>
                                        {error.request_payload && (
                                            <div className='ErrorLogDashboard__error-card__api-section'>
                                                <div className='ErrorLogDashboard__error-card__api-section__title'>
                                                    Request Payload
                                                </div>
                                                <pre className='ErrorLogDashboard__error-card__api-section__content'>
                                                    {error.request_payload}
                                                </pre>
                                            </div>
                                        )}
                                        {error.response_body && (
                                            <div className='ErrorLogDashboard__error-card__api-section'>
                                                <div className='ErrorLogDashboard__error-card__api-section__title'>
                                                    Response Body
                                                </div>
                                                <pre className='ErrorLogDashboard__error-card__api-section__content'>
                                                    {error.response_body}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {error.stack && (
                                    <>
                                        <button
                                            className='ErrorLogDashboard__error-card__stack-toggle'
                                            onClick={() => toggleStack(error.id)}
                                        >
                                            <span className={`ErrorLogDashboard__error-card__stack-toggle__icon ${expandedStacks.has(error.id) ? 'expanded' : ''}`}>
                                                <IconChevronRight/>
                                            </span>
                                            <FormattedMessage
                                                id='admin.error_log.stack_trace'
                                                defaultMessage='Stack Trace'
                                            />
                                        </button>
                                        {expandedStacks.has(error.id) && (
                                            <div className='ErrorLogDashboard__error-card__stack'>
                                                {error.stack}
                                                {error.component_stack && (
                                                    <>
                                                        {'\n\nComponent Stack:\n'}
                                                        {error.component_stack}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper to extract browser info from user agent
function extractBrowserInfo(userAgent: string): string {
    if (userAgent.includes('Chrome')) {
        const match = userAgent.match(/Chrome\/(\d+)/);
        return `Chrome ${match?.[1] || ''}`;
    }
    if (userAgent.includes('Firefox')) {
        const match = userAgent.match(/Firefox\/(\d+)/);
        return `Firefox ${match?.[1] || ''}`;
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        const match = userAgent.match(/Version\/(\d+)/);
        return `Safari ${match?.[1] || ''}`;
    }
    if (userAgent.includes('Edge')) {
        const match = userAgent.match(/Edge\/(\d+)/);
        return `Edge ${match?.[1] || ''}`;
    }
    return userAgent.slice(0, 30) + '...';
}

// Helper to parse JSON strings for export (returns parsed object or original string)
function tryParseJSON(str: string): unknown {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

export default ErrorLogDashboard;
