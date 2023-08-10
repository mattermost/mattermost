// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';

import {Client4} from 'mattermost-redux/client';

import BotDefaultIcon from 'images/bot_default_icon.png';

import type {HTMLAttributes} from 'react';

import './avatar.scss';

export type TAvatarSizeToken = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export const getAvatarWidth = (size: TAvatarSizeToken) => {
    switch (size) {
    case 'xxs':
        return 16;
    case 'xs':
        return 20;
    case 'sm':
        return 24;
    case 'md':
        return 32;
    case 'lg':
        return 36;
    case 'xl':
        return 50;
    case 'xxl':
        return 128;
    }
    return 0;
};

type Props = {
    url?: string;
    username?: string;
    size?: TAvatarSizeToken;
    text?: string;
};

type Attrs = HTMLAttributes<HTMLElement>;

const isURLForUser = (url: string) => url.startsWith(Client4.getUsersRoute());
const replaceURLWithDefaultImageURL = (url: string) => url.replace(/\?_=(\w+)/, '/default');

const Avatar = ({
    url,
    username,
    size = 'md',
    text,
    ...attrs
}: Props & Attrs) => {
    const classes = classNames(`Avatar Avatar-${size}`, attrs.className);

    if (text) {
        return (
            <div
                {...attrs}
                className={classes + ' Avatar-plain'}
                data-content={text}
            />
        );
    }

    return (
        <img
            tabIndex={0}
            {...attrs}
            className={classes}
            alt={`${username || 'user'} profile image`}
            src={url}
            loading='lazy'
            onError={(e) => {
                const fallbackSrc = (url && isURLForUser(url)) ? replaceURLWithDefaultImageURL(url) : BotDefaultIcon;

                if (e.currentTarget.src !== fallbackSrc) {
                    e.currentTarget.src = fallbackSrc;
                }
            }}
        />
    );
};
export default memo(Avatar);
