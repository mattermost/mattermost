// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './guest_magic_link_card.scss';
import GuestMagicLinkCardSvg from './guest_magic_link_card_svg';

const GuestMagicLinkCard = () => {
    const {formatMessage} = useIntl();

    return (
        <div className='guest-magic-link-card'>
            <GuestMagicLinkCardSvg/>
            <h2>
                {formatMessage({
                    id: 'guest_magic_link.success.title',
                    defaultMessage: 'Magic link sent to your email',
                })}
            </h2>
            <p>
                {formatMessage({
                    id: 'guest_magic_link.success.description',
                    defaultMessage: 'Check your email for a magic link to log in without a password.',
                })}
            </p>
            <p className='guest-magic-link-card-expiry'>
                {formatMessage({
                    id: 'guest_magic_link.success.expiry',
                    defaultMessage: 'The link expires in five minutes.',
                })}
            </p>
        </div>
    );
};

export default GuestMagicLinkCard;

