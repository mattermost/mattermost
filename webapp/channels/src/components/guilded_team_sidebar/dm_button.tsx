// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import {getUnreadDmCount} from 'selectors/views/guilded_layout';

import './dm_button.scss';

interface Props {
    isActive: boolean;
    onClick: () => void;
}

export default function DmButton({isActive, onClick}: Props) {
    const unreadCount = useSelector(getUnreadDmCount);

    const displayCount = unreadCount > 99 ? '99+' : unreadCount;

    return (
        <button
            className={classNames('dm-button', {
                'dm-button--active': isActive,
            })}
            onClick={onClick}
            aria-label='Direct Messages'
        >
            <span className='dm-button__icon'>
                <i className='icon icon-account-multiple-outline' />
            </span>
            {isActive && <span className='dm-button__active-indicator' />}
            {unreadCount > 0 && (
                <span className='dm-button__badge'>
                    {displayCount}
                </span>
            )}
        </button>
    );
}
