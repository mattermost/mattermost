// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';

import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import * as TextFormatting from 'utils/text_formatting';

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

// Represents a highlighted line: either an HTML string (JSON via highlight.js) or a React node (plain log)
type HighlightedLine = {
    isHtml: true;
    html: string;
} | {
    isHtml: false;
    node: React.ReactNode;
};

// Initial (synchronous) highlight: uses sanitized HTML for JSON, React nodes for plain logs
function highlightLogLineSync(line: string): HighlightedLine {
    const trimmed = line.trim();

    if (trimmed.startsWith('{')) {
        return {isHtml: true, html: TextFormatting.sanitizeHtml(trimmed)};
    }

    return {isHtml: false, node: highlightPlainLog(line)};
}

// Async highlight for JSON lines using highlight.js
async function highlightJsonLines(lines: string[]): Promise<Map<number, string>> {
    const jsonEntries: Array<{index: number; text: string}> = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('{')) {
            jsonEntries.push({index: i, text: lines[i].trim()});
        }
    }

    if (jsonEntries.length === 0) {
        return new Map();
    }

    const results = new Map<number, string>();
    const combined = jsonEntries.map((e) => e.text).join('\n');
    const highlighted = await SyntaxHighlighting.highlight('json', combined);
    const highlightedLines = highlighted.split('\n');

    // Map highlighted lines back to their indices
    let lineIdx = 0;
    for (const entry of jsonEntries) {
        const lineCount = entry.text.split('\n').length;
        const slice = highlightedLines.slice(lineIdx, lineIdx + lineCount).join('\n');
        results.set(entry.index, slice);
        lineIdx += lineCount;
    }

    return results;
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

function getCopyIconClass(success: boolean, failed: boolean): string {
    if (success) {
        return 'icon icon-check';
    }
    if (failed) {
        return 'icon icon-alert-outline';
    }
    return 'icon icon-content-copy';
}

function getCopyLabel(success: boolean, failed: boolean): React.ReactNode {
    if (success) {
        return (
            <FormattedMessage
                id='admin.logs.copied'
                defaultMessage='Copied!'
            />
        );
    }
    if (failed) {
        return (
            <FormattedMessage
                id='admin.logs.copyFailed'
                defaultMessage='Copy failed'
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.logs.copyAll'
            defaultMessage='Copy all'
        />
    );
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

    // Auto-scroll to tail when follow tail is on (top when newestFirst, bottom otherwise)
    useEffect(() => {
        if (followTail && logPanelRef.current) {
            if (newestFirst) {
                logPanelRef.current.scrollTop = 0;
            } else {
                logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
            }
        }
    }, [displayLogs, followTail, newestFirst]);

    // Detect manual scroll to auto-disable follow tail
    const handleScroll = useCallback(() => {
        if (!logPanelRef.current) {
            return;
        }
        const {scrollTop, scrollHeight, clientHeight} = logPanelRef.current;
        const atTail = newestFirst ?
            scrollTop < 40 :
            scrollHeight - scrollTop - clientHeight < 40;
        if (!atTail && followTail) {
            setFollowTail(false);
        } else if (atTail && !followTail) {
            setFollowTail(true);
        }
    }, [followTail, newestFirst]);

    const [copyFailed, setCopyFailed] = useState(false);

    const handleCopyAll = useCallback(() => {
        navigator.clipboard.writeText(displayLogs.join('\n')).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }).catch(() => {
            setCopyFailed(true);
            setTimeout(() => setCopyFailed(false), 2000);
        });
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

    // Synchronous initial highlighting (plain logs get React nodes, JSON gets sanitized HTML)
    const initialHighlightedLines = useMemo(() => {
        return displayLogs.map((line) => highlightLogLineSync(line));
    }, [displayLogs]);

    // Async highlight.js enhancement for JSON lines
    const [jsonHighlights, setJsonHighlights] = useState<Map<number, string>>(new Map());
    useEffect(() => {
        let cancelled = false;
        setJsonHighlights(new Map());
        highlightJsonLines(displayLogs).then((results) => {
            if (!cancelled) {
                setJsonHighlights(results);
            }
        });
        return () => {
            cancelled = true;
        };
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
                        <i className={getCopyIconClass(copySuccess, copyFailed)}/>
                        {getCopyLabel(copySuccess, copyFailed)}
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
                            id='admin.logs.plain.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                )}
                {!loading && displayLogs.length === 0 && (
                    <div className='PlainLogViewer__empty'>
                        <FormattedMessage
                            id='admin.logs.plain.noLogs'
                            defaultMessage='No logs to display.'
                        />
                    </div>
                )}
                {!loading && displayLogs.length > 0 && (
                    initialHighlightedLines.map((highlighted, i) => {
                        const line = displayLogs[i];
                        let lineClass = 'PlainLogViewer__line';
                        if (line.indexOf('[EROR]') > 0) {
                            lineClass += ' PlainLogViewer__line--error';
                        } else if (line.indexOf('[WARN]') > 0) {
                            lineClass += ' PlainLogViewer__line--warn';
                        }

                        // JSON lines: render with highlight.js HTML (or sanitized fallback)
                        if (highlighted.isHtml) {
                            const jsonHtml = jsonHighlights.get(i) || highlighted.html;
                            return (
                                <div
                                    key={i} // eslint-disable-line react/no-array-index-key
                                    className={lineClass}
                                    data-line-number={getLineNumber(i)}
                                >
                                    <span
                                        className='PlainLogViewer__line-text hljs'
                                        dangerouslySetInnerHTML={{__html: jsonHtml}} // eslint-disable-line react/no-danger
                                    />
                                </div>
                            );
                        }

                        // Plain log lines: render React nodes
                        return (
                            <div
                                key={i} // eslint-disable-line react/no-array-index-key
                                className={lineClass}
                                data-line-number={getLineNumber(i)}
                            >
                                <span className='PlainLogViewer__line-text'>
                                    {highlighted.node}
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
                            defaultMessage='Page {page, number} · {count, number} lines'
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
                                    logPanelRef.current.scrollTop = newestFirst ? 0 : logPanelRef.current.scrollHeight;
                                }
                            }}
                        >
                            <i className={newestFirst ? 'icon icon-arrow-up' : 'icon icon-arrow-down'}/>
                            <FormattedMessage
                                id={newestFirst ? 'admin.logs.scrollToTop' : 'admin.logs.scrollToBottom'}
                                defaultMessage={newestFirst ? 'Scroll to top' : 'Scroll to bottom'}
                            />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
