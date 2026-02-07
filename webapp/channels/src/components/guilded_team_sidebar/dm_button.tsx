// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './dm_button.scss';

interface Props {
    isActive: boolean;
    onClick: () => void;
}

export default function DmButton({isActive, onClick}: Props) {
    return (
        <div
            className={classNames('dm-button', {
                'dm-button--active': isActive,
            })}
            onClick={onClick}
            role='button'
            tabIndex={0}
            aria-label='Direct Messages'
        >
            <i className='icon icon-account-multiple-outline' />
            {isActive && <span className='dm-button__active-indicator' />}
        </div>
    );
}
