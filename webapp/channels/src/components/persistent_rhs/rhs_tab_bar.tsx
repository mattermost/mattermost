// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './rhs_tab_bar.scss';

interface Props {
    activeTab: 'members' | 'threads';
    onTabChange: (tab: 'members' | 'threads') => void;
}

export default function RhsTabBar({activeTab, onTabChange}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='rhs-tab-bar'>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {
                        'rhs-tab-bar__tab--active': activeTab === 'members',
                    })}
                    onClick={() => onTabChange('members')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
                >
                    <i className='icon icon-account-multiple-outline' />
                </button>
            </WithTooltip>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.threads', defaultMessage: 'Threads'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {
                        'rhs-tab-bar__tab--active': activeTab === 'threads',
                    })}
                    onClick={() => onTabChange('threads')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.threads', defaultMessage: 'Threads'})}
                >
                    <i className='icon icon-message-text-outline' />
                </button>
            </WithTooltip>
        </div>
    );
}
