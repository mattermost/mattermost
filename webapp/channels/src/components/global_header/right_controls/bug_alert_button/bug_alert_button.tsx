// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {Client4} from 'mattermost-redux/client';

import webSocketClient from 'client/web_websocket_client';

import IconButton from 'components/global_header/header_icon_button';
import ProfilePicture from 'components/profile_picture';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

import './bug_alert_button.scss';

type ErrorLog = {
    id: string;
    create_at: number;
    type: 'api' | 'js';
    user_id: string;
    username: string;
    message: string;
    stack?: string;
    url?: string;
    status_code?: number;
    endpoint?: string;
    method?: string;
};

type ErrorLogStats = {
    total: number;
    api: number;
    js: number;
};

// Key for dismissed errors in localStorage
const DISMISSED_ERRORS_KEY = 'bugAlertButton_dismissedErrors';

const loadDismissedErrors = (): Set<string> => {
    try {
        const stored = localStorage.getItem(DISMISSED_ERRORS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
};

const saveDismissedErrors = (dismissed: Set<string>) => {
    localStorage.setItem(DISMISSED_ERRORS_KEY, JSON.stringify([...dismissed]));
};

const BadgeContainer = styled.div`
    position: relative;
    display: inline-flex;
`;

const Badge = styled.span<{$hasErrors: boolean}>`
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background-color: ${(props) => props.$hasErrors ? 'var(--error-text)' : 'transparent'};
    color: white;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    display: ${(props) => props.$hasErrors ? 'block' : 'none'};
    pointer-events: none;
`;

const BugAlertButton: React.FC = () => {
    const intl = useIntl();
    const config = useSelector((state: GlobalState) => getConfig(state));
    const isAdmin = useSelector((state: GlobalState) => isCurrentUserSystemAdmin(state));
    const [errors, setErrors] = useState<ErrorLog[]>([]);
    const [stats, setStats] = useState<ErrorLogStats>({total: 0, api: 0, js: 0});
    const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(loadDismissedErrors);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isEnabled = config.FeatureFlagErrorLogDashboard === 'true';

    // Load errors on mount and when feature becomes enabled
    const loadErrors = useCallback(async () => {
        if (!isEnabled || !isAdmin) {
            return;
        }

        try {
            const response = await Client4.getErrorLogs();
            setErrors(response.errors || []);
            setStats(response.stats || {total: 0, api: 0, js: 0});
        } catch (e) {
            // Silently fail - user is not admin or feature is disabled
        }
    }, [isEnabled, isAdmin]);

    useEffect(() => {
        loadErrors();
    }, [loadErrors]);

    // WebSocket handler for real-time updates
    useEffect(() => {
        if (!isEnabled || !isAdmin) {
            return;
        }

        const handleWebSocketEvent = (msg: {event: string; data: {error: ErrorLog}}) => {
            if (msg.event === 'error_logged' && msg.data?.error) {
                setErrors((prev) => [msg.data.error, ...prev].slice(0, 100));
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
    }, [isEnabled, isAdmin]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Don't render if not admin or feature is disabled
    if (!isAdmin || !isEnabled) {
        return null;
    }

    // Filter out dismissed errors
    const visibleErrors = errors.filter((error) => !dismissedErrors.has(error.id));
    const errorCount = visibleErrors.length;

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleDismiss = (errorId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newDismissed = new Set(dismissedErrors);
        newDismissed.add(errorId);
        setDismissedErrors(newDismissed);
        saveDismissedErrors(newDismissed);
    };

    const handleDismissAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newDismissed = new Set(dismissedErrors);
        visibleErrors.forEach((error) => newDismissed.add(error.id));
        setDismissedErrors(newDismissed);
        saveDismissedErrors(newDismissed);
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) {
            return intl.formatMessage({id: 'bug_alert.time.seconds', defaultMessage: '{count}s'}, {count: seconds});
        }
        if (minutes < 60) {
            return intl.formatMessage({id: 'bug_alert.time.minutes', defaultMessage: '{count}m'}, {count: minutes});
        }
        return intl.formatMessage({id: 'bug_alert.time.hours', defaultMessage: '{count}h'}, {count: hours});
    };

    const truncateMessage = (message: string, maxLength = 60) => {
        if (message.length <= maxLength) {
            return message;
        }
        return message.slice(0, maxLength) + '...';
    };

    const getProfilePictureUrl = (userId: string) => {
        return Client4.getProfilePictureUrl(userId, 0);
    };

    const tooltipText = (
        <FormattedMessage
            id='bug_alert.tooltip'
            defaultMessage='Error Logs ({count})'
            values={{count: stats.total}}
        />
    );

    return (
        <div
            className='BugAlertButtonWrapper'
            ref={containerRef}
        >
            <WithTooltip title={tooltipText}>
                <BadgeContainer>
                    <IconButton
                        icon='alert-circle-outline'
                        onClick={handleToggle}
                        active={isOpen}
                        aria-controls='bugAlertDropdown'
                        aria-expanded={isOpen}
                        aria-haspopup='true'
                        aria-label={intl.formatMessage({id: 'bug_alert.aria_label', defaultMessage: 'Error Logs'})}
                    />
                    <Badge $hasErrors={errorCount > 0}>
                        {errorCount > 99 ? '99+' : errorCount}
                    </Badge>
                </BadgeContainer>
            </WithTooltip>

            {isOpen && (
                <div
                    className='BugAlertDropdown'
                    id='bugAlertDropdown'
                    role='menu'
                >
                    <div className='BugAlertDropdown__header'>
                        <span className='BugAlertDropdown__title'>
                            <FormattedMessage
                                id='bug_alert.header.title'
                                defaultMessage='Recent Errors'
                            />
                        </span>
                        <span className='BugAlertDropdown__stats'>
                            <span className='BugAlertDropdown__stat BugAlertDropdown__stat--api'>
                                {stats.api} API
                            </span>
                            <span className='BugAlertDropdown__stat BugAlertDropdown__stat--js'>
                                {stats.js} JS
                            </span>
                        </span>
                    </div>

                    {visibleErrors.length === 0 ? (
                        <div className='BugAlertDropdown__empty'>
                            <i className='icon icon-check-circle-outline'/>
                            <FormattedMessage
                                id='bug_alert.empty'
                                defaultMessage='No recent errors'
                            />
                        </div>
                    ) : (
                        <>
                            <div className='BugAlertDropdown__list'>
                                {visibleErrors.slice(0, 10).map((error) => (
                                    <div
                                        key={error.id}
                                        className='BugAlertDropdown__item'
                                    >
                                        <div className='BugAlertDropdown__item-header'>
                                            <span className={`BugAlertDropdown__item-type BugAlertDropdown__item-type--${error.type}`}>
                                                {error.type === 'api' ? 'API' : 'JS'}
                                            </span>
                                            {error.user_id && (
                                                <ProfilePicture
                                                    src={getProfilePictureUrl(error.user_id)}
                                                    size='xxs'
                                                    username={error.username}
                                                />
                                            )}
                                            <span className='BugAlertDropdown__item-user'>
                                                {error.username || 'Unknown'}
                                            </span>
                                            <span className='BugAlertDropdown__item-time'>
                                                {formatRelativeTime(error.create_at)}
                                            </span>
                                            <button
                                                className='BugAlertDropdown__item-dismiss'
                                                onClick={(e) => handleDismiss(error.id, e)}
                                                title={intl.formatMessage({id: 'bug_alert.dismiss', defaultMessage: 'Dismiss'})}
                                            >
                                                <i className='icon icon-close'/>
                                            </button>
                                        </div>
                                        <div className='BugAlertDropdown__item-message'>
                                            {truncateMessage(error.message)}
                                        </div>
                                        {error.type === 'api' && error.endpoint && (
                                            <div className='BugAlertDropdown__item-endpoint'>
                                                <span className='BugAlertDropdown__item-method'>{error.method}</span>
                                                {error.endpoint}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className='BugAlertDropdown__footer'>
                                <button
                                    className='BugAlertDropdown__dismiss-all'
                                    onClick={handleDismissAll}
                                >
                                    <FormattedMessage
                                        id='bug_alert.dismiss_all'
                                        defaultMessage='Dismiss All'
                                    />
                                </button>
                                <a
                                    className='BugAlertDropdown__view-all'
                                    href='/admin_console/mattermost_extended/error_logs'
                                >
                                    <FormattedMessage
                                        id='bug_alert.view_all'
                                        defaultMessage='View All'
                                    />
                                    <i className='icon icon-arrow-right'/>
                                </a>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default BugAlertButton;
