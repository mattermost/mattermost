// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import './plain_log_list.scss';

type Props = {
    loading: boolean;
    logs: string[];
    page: number;
    perPage: number;
    nextPage: () => void;
    previousPage: () => void;
    onReload: () => void;
    downloadUrl: string;
};

export default function PlainLogList({
    loading, logs: rawLogs, page, perPage, nextPage, previousPage, onReload, downloadUrl,
}: Props) {
    const logs = rawLogs || [];
    const intl = useIntl();
    const logPanelRef = useRef<HTMLDivElement>(null);
    const [followTail, setFollowTail] = useState(true);
    const [wrapText, setWrapText] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    // Auto-scroll to bottom when follow tail is on
    useEffect(() => {
        if (followTail && logPanelRef.current) {
            logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
        }
    }, [logs, followTail]);

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
        navigator.clipboard.writeText(logs.join('\n'));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }, [logs]);

    const hasMore = logs.length >= perPage;
    const hasPrevious = page > 0;
    const totalShowing = logs.length;

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
                    <a
                        className='PlainLogViewer__action-btn'
                        href={downloadUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        title={intl.formatMessage({id: 'admin.logs.download', defaultMessage: 'Download'})}
                    >
                        <i className='icon icon-download-outline'/>
                        <FormattedMessage
                            id='admin.logs.download'
                            defaultMessage='Download'
                        />
                    </a>
                </div>
                <div className='PlainLogViewer__toolbar-spacer'/>
                <div className='PlainLogViewer__toolbar-group'>
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
                className={`PlainLogViewer__content ${wrapText ? 'PlainLogViewer__content--wrap' : ''}`}
                onScroll={handleScroll}
                tabIndex={-1}
            >
                {loading ? (
                    <div className='PlainLogViewer__loading'>
                        <div className='PlainLogViewer__loading-spinner'/>
                        <FormattedMessage
                            id='admin.logs.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                ) : logs.length === 0 ? (
                    <div className='PlainLogViewer__empty'>
                        <FormattedMessage
                            id='admin.logs.noLogs'
                            defaultMessage='No logs to display.'
                        />
                    </div>
                ) : (
                    logs.map((line, i) => {
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
                            >
                                {line}
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
                            defaultMessage='Page {page} \u00B7 {count} lines'
                            values={{page: page + 1, count: totalShowing}}
                        />
                    </span>
                    <div className='PlainLogViewer__footer-pagination'>
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
                            className='PlainLogViewer__page-btn'
                            onClick={nextPage}
                            disabled={!hasMore}
                            title={intl.formatMessage({id: 'admin.logs.nextPage', defaultMessage: 'Next page'})}
                        >
                            <i className='icon icon-chevron-right'/>
                        </button>
                    </div>
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
