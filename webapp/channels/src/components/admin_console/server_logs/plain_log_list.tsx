// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';

import './plain_log_list.scss';

type Props = {
    loading: boolean;
    logs: string[];
    page: number;
    perPage: number;
    nextPage: () => void;
    previousPage: () => void;
    goToPage: (page: number) => void;
    onReload: () => void;
    downloadUrl: string;
};

// Highlight JSON/JSONL content in a log line
function highlightLogLine(line: string): React.ReactNode {
    const trimmed = line.trim();

    // Try to detect and highlight JSON lines
    if (trimmed.startsWith('{')) {
        return highlightJson(trimmed);
    }

    // Mattermost plain log format: timestamp [LEVEL] msg key=value ...
    // Highlight the level tag and key=value pairs
    return highlightPlainLog(line);
}

function highlightJson(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < text.length) {
        // Strings
        if (text[i] === '"') {
            const end = findStringEnd(text, i);
            const str = text.slice(i, end);

            // Check if this is a key (followed by colon)
            const afterStr = text.slice(end).trimStart();
            if (afterStr[0] === ':') {
                parts.push(
                    <span
                        key={key++}
                        className='PlainLogViewer__json-key'
                    >{str}</span>,
                );
            } else {
                parts.push(
                    <span
                        key={key++}
                        className='PlainLogViewer__json-string'
                    >{str}</span>,
                );
            }
            i = end;
            continue;
        }

        // Numbers
        if ((/[-\d]/).test(text[i]) && (i === 0 || (/[,:\s[{]/).test(text[i - 1]))) {
            const match = text.slice(i).match(/^-?\d+\.?\d*([eE][+-]?\d+)?/);
            if (match) {
                parts.push(
                    <span
                        key={key++}
                        className='PlainLogViewer__json-number'
                    >{match[0]}</span>,
                );
                i += match[0].length;
                continue;
            }
        }

        // Booleans and null
        const remaining = text.slice(i);
        const boolMatch = remaining.match(/^(true|false|null)\b/);
        if (boolMatch) {
            parts.push(
                <span
                    key={key++}
                    className='PlainLogViewer__json-bool'
                >{boolMatch[0]}</span>,
            );
            i += boolMatch[0].length;
            continue;
        }

        // Brackets and braces
        if ('{}[]'.includes(text[i])) {
            parts.push(
                <span
                    key={key++}
                    className='PlainLogViewer__json-bracket'
                >{text[i]}</span>,
            );
            i++;
            continue;
        }

        // Accumulate plain text
        let plain = '';
        while (i < text.length && text[i] !== '"' && !'{}[]'.includes(text[i]) && !(text[i] === '-' && (/\d/).test(text[i + 1] || '')) && !(/\d/).test(text[i])) {
            plain += text[i];
            i++;
        }
        if (plain) {
            parts.push(<span key={key++}>{plain}</span>);
        } else if (i < text.length) {
            // Safety: advance at least one character to prevent infinite loop
            parts.push(<span key={key++}>{text[i]}</span>);
            i++;
        }
    }

    return <>{parts}</>;
}

function findStringEnd(text: string, start: number): number {
    let i = start + 1;
    while (i < text.length) {
        if (text[i] === '\\') {
            i += 2;
            continue;
        }
        if (text[i] === '"') {
            return i + 1;
        }
        i++;
    }
    return text.length;
}

function highlightPlainLog(line: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Match level tags like [INFO], [EROR], [WARN], [DBUG]
    const levelMatch = line.match(/\[(EROR|WARN|INFO|DBUG)\]/);
    if (!levelMatch) {
        return line;
    }

    const levelIdx = levelMatch.index!;
    const levelEnd = levelIdx + levelMatch[0].length;

    // Timestamp portion (before level)
    if (levelIdx > 0) {
        parts.push(
            <span
                key={key++}
                className='PlainLogViewer__log-timestamp'
            >
                {line.slice(0, levelIdx)}
            </span>,
        );
    }

    // Level tag
    const levelClass = {
        EROR: 'PlainLogViewer__log-level--error',
        WARN: 'PlainLogViewer__log-level--warn',
        INFO: 'PlainLogViewer__log-level--info',
        DBUG: 'PlainLogViewer__log-level--debug',
    }[levelMatch[1]] || '';

    parts.push(
        <span
            key={key++}
            className={`PlainLogViewer__log-level ${levelClass}`}
        >
            {levelMatch[0]}
        </span>,
    );

    // Rest of the line - highlight key=value pairs
    const rest = line.slice(levelEnd);
    const kvRegex = /(\s)([a-zA-Z_][a-zA-Z0-9_.]*)(=)/g;
    let lastIdx = 0;
    let match;

    while ((match = kvRegex.exec(rest)) !== null) {
        if (match.index + 1 > lastIdx) {
            parts.push(<span key={key++}>{rest.slice(lastIdx, match.index + 1)}</span>);
        }

        // Key
        parts.push(
            <span
                key={key++}
                className='PlainLogViewer__log-key'
            >{match[2]}</span>,
        );
        parts.push(
            <span
                key={key++}
                className='PlainLogViewer__log-equals'
            >{'='}</span>,
        );
        lastIdx = match.index + match[0].length;
    }

    // Remaining text
    if (lastIdx < rest.length) {
        parts.push(<span key={key++}>{rest.slice(lastIdx)}</span>);
    }

    return <>{parts}</>;
}

export default function PlainLogList({
    loading, logs: rawLogs, page, perPage, nextPage, previousPage, goToPage, onReload, downloadUrl,
}: Props) {
    const logs = rawLogs || [];
    const intl = useIntl();
    const logPanelRef = useRef<HTMLDivElement>(null);
    const [followTail, setFollowTail] = useState(true);
    const [wrapText, setWrapText] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    const [newestFirst, setNewestFirst] = useState(false);
    const [goToPageInput, setGoToPageInput] = useState('');
    const [showGoToPage, setShowGoToPage] = useState(false);

    // Reverse logs if newest-first
    const displayLogs = useMemo(() => {
        return newestFirst ? [...logs].reverse() : logs;
    }, [logs, newestFirst]);

    // Auto-scroll to bottom when follow tail is on
    useEffect(() => {
        if (followTail && logPanelRef.current) {
            logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
        }
    }, [displayLogs, followTail]);

    // Detect manual scroll to auto-disable follow tail
    const handleScroll = useCallback(() => {
        if (!logPanelRef.current) {
            return;
        }
        const {scrollTop, scrollHeight, clientHeight} = logPanelRef.current;
        const atBottom = scrollHeight - scrollTop - clientHeight < 40;
        if (!atBottom && followTail) {
            setFollowTail(false);
        } else if (atBottom && !followTail) {
            setFollowTail(true);
        }
    }, [followTail]);

    const handleCopyAll = useCallback(() => {
        navigator.clipboard.writeText(displayLogs.join('\n')).catch(() => {
            // Fallback: noop if clipboard API unavailable
        });
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }, [displayLogs]);

    const handleGoToPage = useCallback(() => {
        const pageNum = parseInt(goToPageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1) {
            goToPage(pageNum - 1);
            setShowGoToPage(false);
            setGoToPageInput('');
        }
    }, [goToPageInput, goToPage]);

    const handleGoToPageKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleGoToPage();
        } else if (e.key === 'Escape') {
            setShowGoToPage(false);
            setGoToPageInput('');
        }
    }, [handleGoToPage]);

    const hasMore = logs.length >= perPage;
    const hasPrevious = page > 0;
    const totalShowing = logs.length;

    // Line numbers: account for sort order
    const getLineNumber = (i: number) => {
        const offset = page * perPage;
        if (newestFirst) {
            return (offset + logs.length) - i;
        }
        return offset + i + 1;
    };

    // Memoize highlighted lines to avoid re-rendering on scroll/toggle changes
    const highlightedLines = useMemo(() => {
        return displayLogs.map((line) => highlightLogLine(line));
    }, [displayLogs]);

    return (
        <div className='PlainLogViewer'>
            {/* Toolbar */}
            <div className='PlainLogViewer__toolbar'>
                <div className='PlainLogViewer__toolbar-group'>
                    <button
                        type='button'
                        className='PlainLogViewer__action-btn'
                        onClick={onReload}
                        title={intl.formatMessage({id: 'admin.logs.reload', defaultMessage: 'Reload'})}
                    >
                        <i className='icon icon-refresh'/>
                        <FormattedMessage
                            id='admin.logs.reload'
                            defaultMessage='Reload'
                        />
                    </button>
                    <ExternalLink
                        location='download_plain_logs'
                        className='PlainLogViewer__action-btn'
                        href={downloadUrl}
                    >
                        <i className='icon icon-download-outline'/>
                        <FormattedMessage
                            id='admin.logs.download'
                            defaultMessage='Download'
                        />
                    </ExternalLink>
                </div>
                <div className='PlainLogViewer__toolbar-spacer'/>
                <div className='PlainLogViewer__toolbar-group'>
                    <button
                        type='button'
                        className={`PlainLogViewer__action-btn ${newestFirst ? 'PlainLogViewer__action-btn--active' : ''}`}
                        onClick={() => setNewestFirst(!newestFirst)}
                        title={intl.formatMessage({
                            id: newestFirst ? 'admin.logs.oldestFirst' : 'admin.logs.newestFirst',
                            defaultMessage: newestFirst ? 'Oldest first' : 'Newest first',
                        })}
                    >
                        <i className={newestFirst ? 'icon icon-arrow-down' : 'icon icon-arrow-up'}/>
                        {newestFirst ? (
                            <FormattedMessage
                                id='admin.logs.newestFirst'
                                defaultMessage='Newest'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.logs.oldestFirst'
                                defaultMessage='Oldest'
                            />
                        )}
                    </button>
                    <button
                        type='button'
                        className={`PlainLogViewer__action-btn ${showLineNumbers ? 'PlainLogViewer__action-btn--active' : ''}`}
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                    >
                        <i className='icon icon-format-list-numbered'/>
                        <FormattedMessage
                            id='admin.logs.lineNumbers'
                            defaultMessage='Lines'
                        />
                    </button>
                    <button
                        type='button'
                        className={`PlainLogViewer__action-btn ${wrapText ? 'PlainLogViewer__action-btn--active' : ''}`}
                        onClick={() => setWrapText(!wrapText)}
                    >
                        {wrapText ? (
                            <FormattedMessage
                                id='admin.logs.nowrap'
                                defaultMessage='No wrap'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.logs.wrap'
                                defaultMessage='Wrap'
                            />
                        )}
                    </button>
                    <button
                        type='button'
                        className='PlainLogViewer__action-btn'
                        onClick={handleCopyAll}
                    >
                        <i className={copySuccess ? 'icon icon-check' : 'icon icon-content-copy'}/>
                        {copySuccess ? (
                            <FormattedMessage
                                id='admin.logs.copied'
                                defaultMessage='Copied!'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.logs.copyAll'
                                defaultMessage='Copy all'
                            />
                        )}
                    </button>
                </div>
            </div>

            {/* Log content */}
            <div
                ref={logPanelRef}
                className={[
                    'PlainLogViewer__content',
                    wrapText ? 'PlainLogViewer__content--wrap' : '',
                    showLineNumbers ? 'PlainLogViewer__content--numbered' : '',
                ].filter(Boolean).join(' ')}
                onScroll={handleScroll}
                tabIndex={-1}
            >
                {loading && (
                    <div className='PlainLogViewer__loading'>
                        <div className='PlainLogViewer__loading-spinner'/>
                        <FormattedMessage
                            id='admin.logs.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                )}
                {!loading && displayLogs.length === 0 && (
                    <div className='PlainLogViewer__empty'>
                        <FormattedMessage
                            id='admin.logs.noLogs'
                            defaultMessage='No logs to display.'
                        />
                    </div>
                )}
                {!loading && displayLogs.length > 0 && (
                    highlightedLines.map((highlighted, i) => {
                        const line = displayLogs[i];
                        let lineClass = 'PlainLogViewer__line';
                        if (line.indexOf('[EROR]') > 0) {
                            lineClass += ' PlainLogViewer__line--error';
                        } else if (line.indexOf('[WARN]') > 0) {
                            lineClass += ' PlainLogViewer__line--warn';
                        }
                        return (
                            <div
                                key={i} // eslint-disable-line react/no-array-index-key
                                className={lineClass}
                                data-line-number={getLineNumber(i)}
                            >
                                <span className='PlainLogViewer__line-text'>
                                    {highlighted}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className='PlainLogViewer__footer'>
                <div className='PlainLogViewer__footer-left'>
                    <span className='PlainLogViewer__footer-info'>
                        <FormattedMessage
                            id='admin.logs.plain.pageInfo'
                            defaultMessage='Page {page} · {count} lines'
                            values={{page: page + 1, count: totalShowing}}
                        />
                    </span>
                    <div className='PlainLogViewer__footer-pagination'>
                        <button
                            type='button'
                            className='PlainLogViewer__page-btn'
                            onClick={() => goToPage(0)}
                            disabled={!hasPrevious}
                            title={intl.formatMessage({id: 'admin.logs.firstPage', defaultMessage: 'First page'})}
                        >
                            <span className='PlainLogViewer__double-chevron'>{'«'}</span>
                        </button>
                        <button
                            type='button'
                            className='PlainLogViewer__page-btn'
                            onClick={previousPage}
                            disabled={!hasPrevious}
                            title={intl.formatMessage({id: 'admin.logs.prevPage', defaultMessage: 'Previous page'})}
                        >
                            <i className='icon icon-chevron-left'/>
                        </button>
                        <button
                            type='button'
                            className='PlainLogViewer__page-btn PlainLogViewer__page-btn--page-num'
                            onClick={() => {
                                setGoToPageInput(String(page + 1));
                                setShowGoToPage(!showGoToPage);
                            }}
                            title={intl.formatMessage({id: 'admin.logs.goToPage', defaultMessage: 'Go to page'})}
                        >
                            {page + 1}
                        </button>
                        <button
                            type='button'
                            className='PlainLogViewer__page-btn'
                            onClick={nextPage}
                            disabled={!hasMore}
                            title={intl.formatMessage({id: 'admin.logs.nextPage', defaultMessage: 'Next page'})}
                        >
                            <i className='icon icon-chevron-right'/>
                        </button>
                    </div>
                    {showGoToPage && (
                        <div className='PlainLogViewer__goto-page'>
                            <FormattedMessage
                                id='admin.logs.goToPageLabel'
                                defaultMessage='Go to page:'
                            />
                            <input
                                type='number'
                                className='PlainLogViewer__goto-input'
                                value={goToPageInput}
                                onChange={(e) => setGoToPageInput(e.target.value)}
                                onKeyDown={handleGoToPageKeyDown}
                                min={1}
                                autoFocus={true} // eslint-disable-line jsx-a11y/no-autofocus
                            />
                            <button
                                type='button'
                                className='PlainLogViewer__action-btn PlainLogViewer__action-btn--small'
                                onClick={handleGoToPage}
                            >
                                <FormattedMessage
                                    id='admin.logs.go'
                                    defaultMessage='Go'
                                />
                            </button>
                        </div>
                    )}
                </div>
                <div className='PlainLogViewer__footer-right'>
                    {!followTail && (
                        <button
                            type='button'
                            className='PlainLogViewer__action-btn PlainLogViewer__action-btn--small'
                            onClick={() => {
                                setFollowTail(true);
                                if (logPanelRef.current) {
                                    logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
                                }
                            }}
                        >
                            <i className='icon icon-arrow-down'/>
                            <FormattedMessage
                                id='admin.logs.scrollToBottom'
                                defaultMessage='Scroll to bottom'
                            />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
