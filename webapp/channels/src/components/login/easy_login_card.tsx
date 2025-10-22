// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './easy_login_card.scss';

const EasyLoginCard = () => {
    const {formatMessage} = useIntl();

    return (
        <div className='easy-login-card'>
            <svg
                width='200'
                height='200'
                viewBox='0 0 240 240'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
            >
                <rect
                    x='40'
                    y='60'
                    width='160'
                    height='120'
                    rx='8'
                    fill='#E8E8E8'
                />
                <rect
                    x='50'
                    y='70'
                    width='140'
                    height='80'
                    rx='4'
                    fill='white'
                />
                <path
                    d='M70 90h100M70 100h80M70 110h90'
                    stroke='#CCCCCC'
                    strokeWidth='2'
                    strokeLinecap='round'
                />
                <circle
                    cx='120'
                    cy='140'
                    r='20'
                    fill='#28A745'
                />
                <path
                    d='M112 140l6 6 12-12'
                    stroke='white'
                    strokeWidth='3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
                <path
                    d='M60 100l40 30 40-30'
                    stroke='#666666'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
            <h2>
                {formatMessage({
                    id: 'easy_login.success.title',
                    defaultMessage: 'We sent you a link to login!',
                })}
            </h2>
            <p>
                {formatMessage({
                    id: 'easy_login.success.description',
                    defaultMessage: 'Please check your email for the link to login.',
                })}
            </p>
            <p className='easy-login-card-expiry'>
                {formatMessage({
                    id: 'easy_login.success.expiry',
                    defaultMessage: 'Your link will expire in 5 minutes.',
                })}
            </p>
        </div>
    );
};

export default EasyLoginCard;

