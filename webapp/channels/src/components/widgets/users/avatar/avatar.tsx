// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, forwardRef} from 'react';
import type {HTMLAttributes, RefObject, SyntheticEvent} from 'react';
import {useIntl} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import BotDefaultIcon from 'images/bot_default_icon.png';

import './avatar.scss';

export type TAvatarSizeToken = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xl-custom-GM' | 'xl-custom-DM' | 'xxl';

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
    case 'xl-custom-GM':
        return 72;
    case 'xl-custom-DM':
        return 96;
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

const Avatar = forwardRef<HTMLElement, Props & Attrs>(({
    url,
    username,
    size = 'md',
    text,
    ...attrs
}, ref) => {
    const {formatMessage} = useIntl();

    const classes = classNames(`Avatar Avatar-${size}`, attrs.className);

    if (text) {
        return (
            <div
                {...attrs}
                ref={ref as RefObject<HTMLDivElement>}
                className={classNames(classes, 'Avatar-plain')}
                data-content={text}
            />
        );
    }

    function handleOnError(e: SyntheticEvent<HTMLImageElement, Event>) {
        const fallbackSrc = (url && isURLForUser(url)) ? replaceURLWithDefaultImageURL(url) : BotDefaultIcon;

        if (e.currentTarget.src !== fallbackSrc) {
            e.currentTarget.src = fallbackSrc;
        }
    }

    return (
        <img
            {...attrs}
            ref={ref as RefObject<HTMLImageElement>}
            className={classes}
            alt={formatMessage({id: 'avatar.alt', defaultMessage: '{username} profile image'}, {
                username: username || 'user',
            })}
            src={url}
            loading='lazy'
            onError={handleOnError}
        />
    );
});

Avatar.displayName = 'Avatar';

export default memo(Avatar);
