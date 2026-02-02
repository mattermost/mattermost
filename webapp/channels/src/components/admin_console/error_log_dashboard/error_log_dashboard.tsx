// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import webSocketClient from 'client/web_websocket_client';

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

const ErrorLogDashboard: React.FC<Props> = ({config, patchConfig}) => {
    const intl = useIntl();
    const [errors, setErrors] = useState<ErrorLog[]>([]);
    const [stats, setStats] = useState<ErrorLogStats>({total: 0, api: 0, js: 0});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'api' | 'js'>('all');
    const [search, setSearch] = useState('');
    const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

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
            await patchConfig({
                FeatureFlags: {
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

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return intl.formatMessage({id: 'admin.error_log.time.seconds', defaultMessage: '{count} seconds ago'}, {count: seconds});
        }
        if (minutes < 60) {
            return intl.formatMessage({id: 'admin.error_log.time.minutes', defaultMessage: '{count} minutes ago'}, {count: minutes});
        }
        if (hours < 24) {
            return intl.formatMessage({id: 'admin.error_log.time.hours', defaultMessage: '{count} hours ago'}, {count: hours});
        }
        return intl.formatMessage({id: 'admin.error_log.time.days', defaultMessage: '{count} days ago'}, {count: days});
    };

    const filteredErrors = errors.filter((error) => {
        if (filter !== 'all' && error.type !== filter) {
            return false;
        }
        if (search) {
            const searchLower = search.toLowerCase();
            return (
                error.message.toLowerCase().includes(searchLower) ||
                error.username?.toLowerCase().includes(searchLower) ||
                error.url?.toLowerCase().includes(searchLower) ||
                error.stack?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

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
                            <i className='icon icon-magnify'/>
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
                                <i className='icon icon-check'/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature1'
                                    defaultMessage='Real-time error streaming via WebSocket'
                                />
                            </li>
                            <li>
                                <i className='icon icon-check'/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature2'
                                    defaultMessage='Filter by error type, user, or search term'
                                />
                            </li>
                            <li>
                                <i className='icon icon-check'/>
                                <FormattedMessage
                                    id='admin.error_log.promo.feature3'
                                    defaultMessage='Expandable stack traces'
                                />
                            </li>
                            <li>
                                <i className='icon icon-check'/>
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
                        <div className='ErrorLogDashboard__toggle'>
                            <FormattedMessage
                                id='admin.error_log.enabled'
                                defaultMessage='Enabled'
                            />
                            <button
                                className='btn btn-link'
                                onClick={handleToggleFeature}
                            >
                                <FormattedMessage
                                    id='admin.error_log.disable'
                                    defaultMessage='Disable'
                                />
                            </button>
                        </div>
                        <button
                            className='btn btn-danger'
                            onClick={handleClearAll}
                            disabled={errors.length === 0}
                        >
                            <i className='icon icon-delete-outline'/>
                            <FormattedMessage
                                id='admin.error_log.clear_all'
                                defaultMessage='Clear All'
                            />
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className='ErrorLogDashboard__stats'>
                    <div className='ErrorLogDashboard__stat-card'>
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--total'>
                            <i className='icon icon-chart-bar'/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>{stats.total}</div>
                        <div className='ErrorLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.error_log.stat.total'
                                defaultMessage='Total Errors'
                            />
                        </div>
                    </div>
                    <div className='ErrorLogDashboard__stat-card'>
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--api'>
                            <i className='icon icon-web'/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>{stats.api}</div>
                        <div className='ErrorLogDashboard__stat-card__label'>
                            <FormattedMessage
                                id='admin.error_log.stat.api'
                                defaultMessage='API Errors'
                            />
                        </div>
                    </div>
                    <div className='ErrorLogDashboard__stat-card'>
                        <div className='ErrorLogDashboard__stat-card__icon ErrorLogDashboard__stat-card__icon--js'>
                            <i className='icon icon-lightning-bolt'/>
                        </div>
                        <div className='ErrorLogDashboard__stat-card__value'>{stats.js}</div>
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
                    <div className='ErrorLogDashboard__filters__type-buttons'>
                        <button
                            className={`ErrorLogDashboard__filters__type-button ${filter === 'all' ? 'ErrorLogDashboard__filters__type-button--active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            <FormattedMessage
                                id='admin.error_log.filter.all'
                                defaultMessage='All'
                            />
                        </button>
                        <button
                            className={`ErrorLogDashboard__filters__type-button ${filter === 'api' ? 'ErrorLogDashboard__filters__type-button--active' : ''}`}
                            onClick={() => setFilter('api')}
                        >
                            <FormattedMessage
                                id='admin.error_log.filter.api'
                                defaultMessage='API'
                            />
                        </button>
                        <button
                            className={`ErrorLogDashboard__filters__type-button ${filter === 'js' ? 'ErrorLogDashboard__filters__type-button--active' : ''}`}
                            onClick={() => setFilter('js')}
                        >
                            <FormattedMessage
                                id='admin.error_log.filter.js'
                                defaultMessage='JS'
                            />
                        </button>
                    </div>
                    <div className='ErrorLogDashboard__filters__search'>
                        <i className='icon icon-magnify'/>
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'admin.error_log.search', defaultMessage: 'Search errors...'})}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

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
                            {'✨'}
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
                                defaultMessage='Errors will appear here in real-time as they occur. Your users are having a good day!'
                            />
                        </p>
                    </div>
                ) : (
                    <div className='ErrorLogDashboard__list'>
                        {filteredErrors.map((error) => (
                            <div
                                key={error.id}
                                className='ErrorLogDashboard__error-card'
                            >
                                <div className='ErrorLogDashboard__error-card__header'>
                                    <span className={`ErrorLogDashboard__error-card__badge ErrorLogDashboard__error-card__badge--${error.type}`}>
                                        <i className={`icon icon-${error.type === 'api' ? 'alert-circle-outline' : 'lightning-bolt'}`}/>
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
                                    <span className='ErrorLogDashboard__error-card__time'>
                                        {formatRelativeTime(error.create_at)}
                                    </span>
                                </div>

                                {error.type === 'api' && error.endpoint && (
                                    <div className='ErrorLogDashboard__error-card__message'>
                                        {error.method} {error.endpoint}
                                        {error.status_code && (
                                            <span style={{marginLeft: 8, opacity: 0.7}}>
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
                                        <span className='ErrorLogDashboard__error-card__meta__item'>
                                            <i className='icon icon-account-outline'/>
                                            {error.username}
                                        </span>
                                    )}
                                    {error.url && (
                                        <span className='ErrorLogDashboard__error-card__meta__item'>
                                            <i className='icon icon-map-marker-outline'/>
                                            {error.url}
                                        </span>
                                    )}
                                    {error.user_agent && (
                                        <span className='ErrorLogDashboard__error-card__meta__item'>
                                            <i className='icon icon-web'/>
                                            {extractBrowserInfo(error.user_agent)}
                                        </span>
                                    )}
                                </div>

                                {error.stack && (
                                    <>
                                        <button
                                            className='ErrorLogDashboard__error-card__stack-toggle'
                                            onClick={() => toggleStack(error.id)}
                                        >
                                            <i className={`icon icon-chevron-right ${expandedStacks.has(error.id) ? 'expanded' : ''}`}/>
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

export default ErrorLogDashboard;
