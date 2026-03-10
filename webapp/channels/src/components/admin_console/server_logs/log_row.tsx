// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {LogLevelEnum, LogObject} from '@mattermost/types/admin';

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

function formatTimestampShort(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            // Try parsing the mattermost log format "2006-01-02 15:04:05.999 Z"
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

function LogRow({log, isExpanded, isFocused, onToggleExpand, onFocus, searchTerm, wrapText, compact}: Props) {
    const [copySuccess, setCopySuccess] = useState(false);
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
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }, [log]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(log);
        }
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
            navigator.clipboard.writeText(JSON.stringify(log, undefined, 2));
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
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
                    <div className='LogRow__details-grid'>
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
                            <span className='LogRow__detail-value LogRow__detail-value--mono'>{log.caller}</span>
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
                        {extraFields.map(([key, value]) => (
                            <div
                                className='LogRow__detail-item'
                                key={key}
                            >
                                <span className='LogRow__detail-label'>{key}</span>
                                <span className='LogRow__detail-value LogRow__detail-value--mono'>{value}</span>
                            </div>
                        ))}
                    </div>
                    <div className='LogRow__details-actions'>
                        <button
                            type='button'
                            className='btn btn-sm btn-tertiary'
                            onClick={handleCopyJson}
                        >
                            {copySuccess ? (
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(LogRow);
