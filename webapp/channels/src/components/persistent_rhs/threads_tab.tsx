// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import {FixedSizeList} from 'react-window';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {getThreadsInChannel} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import ThreadRow from './thread_row';

import './threads_tab.scss';

const ROW_HEIGHT = 72;

export default function ThreadsTab() {
    const history = useHistory();

    const channel = useSelector(getCurrentChannel);
    const teamUrl = useSelector(getCurrentRelativeTeamUrl);
    const threads = useSelector((state: GlobalState) =>
        (channel ? getThreadsInChannel(state, channel.id) : [])
    );

    const handleThreadClick = useCallback((threadId: string) => {
        history.push(`${teamUrl}/thread/${threadId}`);
    }, [history, teamUrl]);

    const renderRow = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const thread = threads[index];

        return (
            <div style={style}>
                <ThreadRow
                    thread={thread}
                    onClick={() => handleThreadClick(thread.id)}
                />
            </div>
        );
    }, [threads, handleThreadClick]);

    if (threads.length === 0) {
        return (
            <div className='threads-tab threads-tab--empty'>
                <i className='icon icon-message-text-outline threads-tab__empty-icon' />
                <span className='threads-tab__empty-text'>{'No threads yet'}</span>
                <span className='threads-tab__empty-hint'>
                    {'Threads will appear here when someone replies to a message'}
                </span>
            </div>
        );
    }

    return (
        <div className='threads-tab'>
            <AutoSizer>
                {({height, width}) => (
                    <FixedSizeList
                        height={height}
                        width={width}
                        itemCount={threads.length}
                        itemSize={ROW_HEIGHT}
                    >
                        {renderRow}
                    </FixedSizeList>
                )}
            </AutoSizer>
        </div>
    );
}
