// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {LogObject} from '@mattermost/types/admin';

import './log_list.scss';

type LogObjectWithAdditionalInfo = LogObject & {
    [key: string]: string;
};

type Props = {
    log: LogObjectWithAdditionalInfo;
    isExpanded: boolean;
    isFocused: boolean;
    onToggleExpand: (log: LogObjectWithAdditionalInfo) => void;
    onFocus: (log: LogObjectWithAdditionalInfo) => void;
    searchTerm: string;
    wrapText: boolean;
    compact: boolean;
};

const LEVEL_CONFIG: Record<string, {label: string; className: string}> = {
    error: {label: 'ERR', className: 'LogRow__level--error'},
    warn: {label: 'WRN', className: 'LogRow__level--warn'},
    info: {label: 'INF', className: 'LogRow__level--info'},
    debug: {label: 'DBG', className: 'LogRow__level--debug'},
};

// Fields that link to admin console pages
const ADMIN_LINK_FIELDS: Record<string, string> = {
    user_id: '/admin_console/user_management/user/',
    team_id: '/admin_console/user_management/teams/',
    channel_id: '/admin_console/user_management/channels/',
};

// Fields where a copy button is useful
const COPYABLE_FIELDS = new Set([
    'user_id', 'team_id', 'channel_id', 'post_id', 'request_id',
    'job_id', 'session_id', 'token_id', 'caller', 'url',
]);

// Mattermost IDs are always 26 lowercase alphanumeric characters
const MM_ID_PATTERN = /^[a-z0-9]{26}$/;

function formatTimestampShort(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            const match = timestamp.match(/(\d{2}:\d{2}:\d{2}\.\d{3})/);
            return match ? match[1] : timestamp.slice(11, 23);
        }
        return date.toISOString().slice(11, 23);
    } catch {
        return timestamp.slice(0, 23);
    }
}

function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
    if (!searchTerm) {
        return text;
    }

    const lowerText = text.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerSearch);

    if (index === -1) {
        return text;
    }

    return (
        <>
            {text.slice(0, index)}
            <mark className='LogRow__highlight'>{text.slice(index, index + searchTerm.length)}</mark>
            {text.slice(index + searchTerm.length)}
        </>
    );
}

const KNOWN_KEYS = new Set(['timestamp', 'level', 'msg', 'caller']);

// Small inline copy button
function CopyButton({value}: {value: string}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [value]);

    return (
        <button
            type='button'
            className='LogRow__copy-btn'
            onClick={handleCopy}
            title='Copy to clipboard'
        >
            <i className={copied ? 'icon icon-check' : 'icon icon-content-copy'}/>
        </button>
    );
}

// Value renderer: handles copy buttons and admin deep links
function DetailValue({fieldKey, value}: {fieldKey: string; value: string}) {
    const isCopyable = COPYABLE_FIELDS.has(fieldKey) || fieldKey.endsWith('_id');
    const adminPath = ADMIN_LINK_FIELDS[fieldKey];
    const isLinkable = adminPath && MM_ID_PATTERN.test(value);

    return (
        <span className='LogRow__detail-value LogRow__detail-value--mono'>
            {isLinkable ? (
                <a
                    className='LogRow__detail-link'
                    href={adminPath + value}
                    onClick={(e) => e.stopPropagation()}
                    title={'View in admin console'}
                >
                    {value}
                    <i className='icon icon-open-in-new LogRow__detail-link-icon'/>
                </a>
            ) : (
                value
            )}
            {isCopyable && value && (
                <CopyButton value={value}/>
            )}
        </span>
    );
}

function LogRow({log, isExpanded, isFocused, onToggleExpand, onFocus, searchTerm, wrapText, compact}: Props) {
    const [copyJsonSuccess, setCopyJsonSuccess] = useState(false);
    const [copyLineSuccess, setCopyLineSuccess] = useState(false);
    const levelConfig = LEVEL_CONFIG[log.level] || {label: log.level?.toUpperCase()?.slice(0, 3) || '???', className: 'LogRow__level--debug'};

    const handleClick = useCallback(() => {
        onToggleExpand(log);
    }, [log, onToggleExpand]);

    const handleFocus = useCallback(() => {
        onFocus(log);
    }, [log, onFocus]);

    const handleCopyJson = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(log, undefined, 2));
        setCopyJsonSuccess(true);
        setTimeout(() => setCopyJsonSuccess(false), 2000);
    }, [log]);

    const handleCopyLine = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const line = `${log.timestamp} [${log.level?.toUpperCase()}] ${log.msg} (${log.caller})`;
        navigator.clipboard.writeText(line);
        setCopyLineSuccess(true);
        setTimeout(() => setCopyLineSuccess(false), 2000);
    }, [log]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(log);
        }
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
            navigator.clipboard.writeText(JSON.stringify(log, undefined, 2));
            setCopyJsonSuccess(true);
            setTimeout(() => setCopyJsonSuccess(false), 2000);
        }
    }, [log, onToggleExpand]);

    const rowClasses = [
        'LogRow',
        compact ? 'LogRow--compact' : 'LogRow--comfortable',
        isExpanded ? 'LogRow--expanded' : '',
        isFocused ? 'LogRow--focused' : '',
        log.level === 'error' ? 'LogRow--error-bg' : '',
        log.level === 'warn' ? 'LogRow--warn-bg' : '',
        wrapText ? 'LogRow--wrap' : 'LogRow--nowrap',
    ].filter(Boolean).join(' ');

    // Collect extra fields (not timestamp, level, msg, caller)
    const extraFields: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(log)) {
        if (!KNOWN_KEYS.has(key) && value) {
            extraFields.push([key, String(value)]);
        }
    }

    return (
        <div
            className={rowClasses}
            onClick={handleClick}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            role='row'
            tabIndex={0}
            aria-expanded={isExpanded}
            data-level={log.level}
        >
            <div className='LogRow__main'>
                <span className={`LogRow__level ${levelConfig.className}`}>
                    {levelConfig.label}
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
                <span className='LogRow__caller'>
                    {log.caller}
                </span>
                <span className='LogRow__expand-indicator'>
                    {isExpanded ? '\u25BC' : '\u25B6'}
                </span>
            </div>
            {isExpanded && (
                <div
                    className='LogRow__details'
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Core fields - compact summary */}
                    <div className='LogRow__details-core'>
                        <div className='LogRow__detail-item'>
                            <span className='LogRow__detail-label'>
                                <FormattedMessage
                                    id='admin.logs.detail.timestamp'
                                    defaultMessage='Timestamp'
                                />
                            </span>
                            <span className='LogRow__detail-value'>{log.timestamp}</span>
                        </div>
                        <div className='LogRow__detail-item'>
                            <span className='LogRow__detail-label'>
                                <FormattedMessage
                                    id='admin.logs.detail.level'
                                    defaultMessage='Level'
                                />
                            </span>
                            <span className='LogRow__detail-value'>{log.level}</span>
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
                        <div className='LogRow__detail-item LogRow__detail-item--full'>
                            <span className='LogRow__detail-label'>
                                <FormattedMessage
                                    id='admin.logs.detail.message'
                                    defaultMessage='Message'
                                />
                            </span>
                            <span className='LogRow__detail-value'>{log.msg}</span>
                        </div>
                    </div>

                    {/* Extra fields with copy + links */}
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

                    {/* Action buttons */}
                    <div className='LogRow__details-actions'>
                        <button
                            type='button'
                            className='LogRow__action-btn'
                            onClick={handleCopyJson}
                        >
                            <i className={copyJsonSuccess ? 'icon icon-check' : 'icon icon-code-json'}/>
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
                            className='LogRow__action-btn'
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
