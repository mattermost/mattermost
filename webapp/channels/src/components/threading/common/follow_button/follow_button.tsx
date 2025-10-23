// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ComponentProps} from 'react';
import {useIntl} from 'react-intl';

import ThreadButton from '../thread_button';

type Props = {
    isFollowing: boolean | null | undefined;
}

function FollowButton({
    isFollowing,
    ...props
}: Props & Exclude<ComponentProps<typeof ThreadButton>, Props>) {
    const {formatMessage} = useIntl();
    return (
        <ThreadButton
            {...props}
            className={classNames(props.className, 'FollowButton')}
            disabled={Boolean(props.disabled)}
            isActive={isFollowing ?? false}
        >
            {isFollowing ? formatMessage({
                id: 'threading.following',
                defaultMessage: 'Following',
            }) : formatMessage({
                id: 'threading.notFollowing',
                defaultMessage: 'Follow',
            })}
        </ThreadButton>
    );
}

export default memo(FollowButton);
