// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './easy_login_card.scss';
import EasyLoginCardSvg from './easy_login_card_svg';

const EasyLoginCard = () => {
    const {formatMessage} = useIntl();

    return (
        <div className='easy-login-card'>
            <EasyLoginCardSvg/>
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

