// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import './rhs_tab_bar.scss';

interface Props {
    activeTab: 'members' | 'threads';
    onTabChange: (tab: 'members' | 'threads') => void;
    memberCount: number;
    threadCount: number;
}

export default function RhsTabBar({activeTab, onTabChange, memberCount, threadCount}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div
            className='rhs-tab-bar'
            role='tablist'
        >
            <button
                className={classNames('rhs-tab-bar__tab', {
                    'rhs-tab-bar__tab--active': activeTab === 'members',
                })}
                onClick={() => onTabChange('members')}
                role='tab'
                aria-selected={activeTab === 'members'}
                aria-label={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
            >
                <i className='icon icon-account-outline' />
                {memberCount > 0 && <span className='rhs-tab-bar__count'>{memberCount}</span>}
            </button>
            <button
                className={classNames('rhs-tab-bar__tab', {
                    'rhs-tab-bar__tab--active': activeTab === 'threads',
                })}
                onClick={() => onTabChange('threads')}
                role='tab'
                aria-selected={activeTab === 'threads'}
                aria-label={formatMessage({id: 'rhs_tab_bar.threads', defaultMessage: 'Threads'})}
            >
                <span className='icon icon-discord-thread' />
                {threadCount > 0 && <span className='rhs-tab-bar__count'>{threadCount}</span>}
            </button>
        </div>
    );
}
