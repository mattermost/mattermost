// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ComponentProps} from 'react';
import {useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import Button from '../button';

type Props = {
    isFollowing: boolean | null | undefined;

    // Compact header control: Compass bell-outline (following) / bell-off-outline
    // (not following), matching the other RHS icon buttons.
    iconOnly?: boolean;
};

function FollowButton({
    isFollowing,
    iconOnly = false,
    ...props
}: Props & Exclude<ComponentProps<typeof Button>, Props>) {
    const {formatMessage} = useIntl();
    const following = isFollowing ?? false;
    const label = following ? formatMessage({
        id: 'threading.following',
        defaultMessage: 'Following',
    }) : formatMessage({
        id: 'threading.notFollowing',
        defaultMessage: 'Follow',
    });

    if (iconOnly) {
        const {className, disabled, onClick} = props;
        return (
            <WithTooltip title={label}>
                <button
                    type='button'
                    className={classNames(
                        'btn btn-icon btn-sm FollowButton FollowButton--icon',
                        {'btn-force-active': following},
                        className,
                    )}
                    disabled={Boolean(disabled)}
                    aria-label={label}
                    aria-pressed={following}
                    onClick={onClick}
                >
                    <i
                        className={classNames('icon', following ? 'icon-bell-outline' : 'icon-bell-off-outline')}
                        aria-hidden={true}
                    />
                </button>
            </WithTooltip>
        );
    }

    return (
        <Button
            {...props}
            className={classNames(props.className, 'FollowButton')}
            disabled={Boolean(props.disabled)}
            isActive={following}
        >
            {label}
        </Button>
    );
}

export default memo(FollowButton);
