// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ComponentProps} from 'react';
import {useIntl} from 'react-intl';

import {t} from 'utils/i18n';

import Button from '../button';

type Props = {
    isFollowing: boolean | null | undefined;
}

function FollowButton({
    isFollowing,
    ...props
}: Props & Exclude<ComponentProps<typeof Button>, Props>) {
    const {formatMessage} = useIntl();
    return (
        <Button
            {...props}
            className={classNames(props.className, 'FollowButton')}
            disabled={Boolean(props.disabled)}
            isActive={isFollowing ?? false}
        >
            {formatMessage(isFollowing ? {
                id: t('threading.following'),
                defaultMessage: 'Following',
            } : {
                id: t('threading.notFollowing'),
                defaultMessage: 'Follow',
            })}
        </Button>
    );
}

export default memo(FollowButton);
