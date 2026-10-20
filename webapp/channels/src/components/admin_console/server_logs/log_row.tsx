// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {useUser} from 'components/common/hooks/useUser';
import Avatar from 'components/widgets/users/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {LogObjectWithAdditionalInfo} from './types';
import useClipboardCopy from './use_clipboard_copy';
import {formatLogValue} from './utils';

import './log_list.scss';

type Props = {
    log: LogObjectWithAdditionalInfo;
    isExpanded: boolean;
    isFocused: boolean;
    onToggleExpand: (log: LogObjectWithAdditionalInfo) => void;
    onFocus: (log: LogObjectWithAdditionalInfo) => void;
    searchTerm: string;
    wrapText: boolean;
};

const LEVEL_CONFIG: Record<string, {label: MessageDescriptor; className: string}> = {
    error: {label: defineMessage({id: 'admin.logs.level.error', defaultMessage: 'Error'}), className: 'LogRow__level--error'},
    warn: {label: defineMessage({id: 'admin.logs.level.warn', defaultMessage: 'Warn'}), className: 'LogRow__level--warn'},
    info: {label: defineMessage({id: 'admin.logs.level.info', defaultMessage: 'Info'}), className: 'LogRow__level--info'},
    debug: {label: defineMessage({id: 'admin.logs.level.debug', defaultMessage: 'Debug'}), className: 'LogRow__level--debug'},
};

// Fields that link to admin console pages
const ADMIN_LINK_FIELDS: Record<string, string> = {
    team_id: '/admin_console/user_management/teams/',
    channel_id: '/admin_console/user_management/channels/',
};

// Fields where a copy button is useful
const COPYABLE_FIELDS = new Set([
    'user_id', 'team_id', 'channel_id', 'post_id', 'request_id',
    'job_id', 'session_id', 'token_id', 'caller', 'url',
]);

const USER_ID_FIELDS = new Set(['user_id', 'sender_id', 'creator_id', 'bot_id']);

function isUserIdField(key: string): boolean {
    return USER_ID_FIELDS.has(key) || key.endsWith('_user_id');
}

// Mattermost IDs are always 26 lowercase alphanumeric characters
const MM_ID_PATTERN = /^[a-z0-9]{26}$/;

function formatTimestampShort(timestamp: string): string {
    // Extract time directly from the raw string to preserve original wall-clock timezone
    const match = timestamp.match(/(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (match) {
        return match[1];
    }

    // Fallback: try Date parsing for non-standard formats
    try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toISOString().slice(11, 23);
        }
    } catch {
        // ignore
    }
    return timestamp.slice(0, 23);
}

function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
    if (!searchTerm) {
        return text;
    }

    const lowerSearch = searchTerm.toLowerCase();
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        const index = remaining.toLowerCase().indexOf(lowerSearch);
        if (index === -1) {
            parts.push(<span key={key++}>{remaining}</span>);
            break;
        }
        if (index > 0) {
            parts.push(<span key={key++}>{remaining.slice(0, index)}</span>);
        }
        parts.push(
            <mark
                key={key++}
                className='LogRow__highlight'
            >
                {remaining.slice(index, index + searchTerm.length)}
            </mark>,
        );
        remaining = remaining.slice(index + searchTerm.length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}

const KNOWN_KEYS = new Set(['timestamp', 'level', 'msg', 'caller']);

function CopyButton({value}: {value: string}) {
    const intl = useIntl();
    const [status, copy] = useClipboardCopy();

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        copy(value);
    }, [copy, value]);

    return (
        <button
            type='button'
            className='LogRow__copy-btn btn btn-icon btn-xs btn-compact'
            onClick={handleCopy}
            aria-label={intl.formatMessage({id: 'admin.logs.copyToClipboard', defaultMessage: 'Copy to clipboard'})}
        >
            <i className={status === 'copied' ? 'icon icon-check' : 'icon icon-content-copy'}/>
        </button>
    );
}

function UserIdValue({value}: {value: string}) {
    const intl = useIntl();
    const user = useUser(value);
    const displayName = useSelector((state: GlobalState) => getDisplayNameByUser(state, user));

    return (
        <span className='LogRow__detail-value LogRow__detail-value--mono'>
            {value}
            <CopyButton value={value}/>
            {user && (
                <span className='LogRow__user'>
                    {'('}
                    <Link
                        className='LogRow__detail-link'
                        to={`/admin_console/user_management/user/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        title={intl.formatMessage({id: 'admin.logs.viewInAdmin', defaultMessage: 'View in admin console'})}
                    >
                        <Avatar
                            size='xxs'
                            url={imageURLForUser(user.id, user.last_picture_update)}
                            alt=''
                        />
                        {displayName === user.username ? `@${user.username}` : displayName}
                    </Link>
                    {')'}
                </span>
            )}
        </span>
    );
}

// Value renderer: handles copy buttons and admin deep links
function DetailValue({fieldKey, value}: {fieldKey: string; value: string}) {
    const intl = useIntl();
    if (isUserIdField(fieldKey) && MM_ID_PATTERN.test(value)) {
        return <UserIdValue value={value}/>;
    }

    const isCopyable = COPYABLE_FIELDS.has(fieldKey) || fieldKey.endsWith('_id');
    const adminPath = ADMIN_LINK_FIELDS[fieldKey];
    const isLinkable = adminPath && MM_ID_PATTERN.test(value);

    return (
        <span className='LogRow__detail-value LogRow__detail-value--mono'>
            {isLinkable ? (
                <Link
                    className='LogRow__detail-link'
                    to={adminPath + value}
                    onClick={(e) => e.stopPropagation()}
                    title={intl.formatMessage({id: 'admin.logs.viewInAdmin', defaultMessage: 'View in admin console'})}
                >
                    {value}
                    <i className='icon icon-open-in-new LogRow__detail-link-icon'/>
                </Link>
            ) : (
                value
            )}
            {isCopyable && value && (
                <CopyButton value={value}/>
            )}
        </span>
    );
}

function LogRow({log, isExpanded, isFocused, onToggleExpand, onFocus, searchTerm, wrapText}: Props) {
    const [copyJsonStatus, copyJson] = useClipboardCopy();
    const [copyLineStatus, copyLine] = useClipboardCopy();
    const copyJsonSuccess = copyJsonStatus === 'copied';
    const copyLineSuccess = copyLineStatus === 'copied';
    const levelConfig = LEVEL_CONFIG[log.level];

    const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        // Finishing a text selection in the row ends with a click, which shouldn't toggle it
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && e.currentTarget.contains(selection.anchorNode)) {
            return;
        }
        onToggleExpand(log);
    }, [log, onToggleExpand]);

    const handleFocus = useCallback(() => {
        onFocus(log);
    }, [log, onFocus]);

    const handleCopyJson = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        copyJson(JSON.stringify(log, undefined, 2));
    }, [copyJson, log]);

    const handleCopyLine = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        copyLine(`${log.timestamp} [${log.level?.toUpperCase()}] ${log.msg} (${log.caller})`);
    }, [copyLine, log]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Ignore events from interactive descendants (buttons, links)
        const target = e.target as HTMLElement;
        if (target !== e.currentTarget && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT')) {
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(log);
        }
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
            copyJson(JSON.stringify(log, undefined, 2));
        }
    }, [copyJson, log, onToggleExpand]);

    const rowClasses = [
        'LogRow',
        'LogRow--compact',
        isExpanded ? 'LogRow--expanded' : '',
        isFocused ? 'LogRow--focused' : '',
        log.level === 'error' ? 'LogRow--error-bg' : '',
        log.level === 'warn' ? 'LogRow--warn-bg' : '',
        wrapText || isExpanded ? 'LogRow--wrap' : 'LogRow--nowrap',
    ].filter(Boolean).join(' ');

    // Collect extra fields (not timestamp, level, msg, caller)
    const extraFields: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(log)) {
        if (!KNOWN_KEYS.has(key) && value != null) {
            extraFields.push([key, formatLogValue(value)]);
        }
    }

    return (
        <div
            className={rowClasses}
            onFocus={handleFocus}
            role='listitem'
            data-level={log.level}
        >
            {/* The row summary is the disclosure control for the details below it */}
            <div
                className='LogRow__main'
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                role='button'
                tabIndex={0}
                aria-expanded={isExpanded}
            >
                <span className={`LogRow__level ${levelConfig ? levelConfig.className : 'LogRow__level--debug'}`}>
                    {levelConfig ? <FormattedMessage {...levelConfig.label}/> : log.level}
                </span>
                <span
                    className='LogRow__timestamp'
                    title={log.timestamp}
                >
                    {formatTimestampShort(log.timestamp)}
                </span>
                <span className='LogRow__message'>
                    {highlightSearchTerm(log.msg || '', searchTerm)}
                </span>
                <span
                    className='LogRow__caller'
                    title={log.caller}
                >
                    {log.caller}
                </span>
                <i
                    className={`icon ${isExpanded ? 'icon-chevron-down' : 'icon-chevron-right'} LogRow__expand-indicator`}
                    aria-hidden='true'
                />
            </div>
            {isExpanded && (
                <div
                    className='LogRow__details'
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className='LogRow__details-core'>
                        <div className='LogRow__detail-item'>
                            <span className='LogRow__detail-label'>
                                <FormattedMessage
                                    id='admin.logs.detail.timestamp'
                                    defaultMessage='Timestamp'
                                />
                            </span>
                            <span className='LogRow__detail-value LogRow__detail-value--mono'>{log.timestamp}</span>
                        </div>
                        <div className='LogRow__detail-item'>
                            <span className='LogRow__detail-label'>
                                <FormattedMessage
                                    id='admin.logs.detail.caller'
                                    defaultMessage='Caller'
                                />
                            </span>
                            <span className='LogRow__detail-value LogRow__detail-value--mono'>
                                {log.caller}
                                <CopyButton value={log.caller}/>
                            </span>
                        </div>
                    </div>

                    {extraFields.length > 0 && (
                        <div className='LogRow__details-extra'>
                            <div className='LogRow__details-grid'>
                                {extraFields.map(([key, value]) => (
                                    <div
                                        className='LogRow__detail-item'
                                        key={key}
                                    >
                                        <span className='LogRow__detail-label'>{key}</span>
                                        <DetailValue
                                            fieldKey={key}
                                            value={value}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className='LogRow__details-actions'>
                        <button
                            type='button'
                            className='btn btn-sm btn-quaternary'
                            onClick={handleCopyJson}
                        >
                            <i className={copyJsonSuccess ? 'icon icon-check' : 'icon icon-content-copy'}/>
                            {copyJsonSuccess ? (
                                <FormattedMessage
                                    id='admin.logs.copied'
                                    defaultMessage='Copied!'
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.logs.copyJson'
                                    defaultMessage='Copy JSON'
                                />
                            )}
                        </button>
                        <button
                            type='button'
                            className='btn btn-sm btn-quaternary'
                            onClick={handleCopyLine}
                        >
                            <i className={copyLineSuccess ? 'icon icon-check' : 'icon icon-content-copy'}/>
                            {copyLineSuccess ? (
                                <FormattedMessage
                                    id='admin.logs.copiedLine'
                                    defaultMessage='Copied!'
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.logs.copyLine'
                                    defaultMessage='Copy log line'
                                />
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(LogRow);
