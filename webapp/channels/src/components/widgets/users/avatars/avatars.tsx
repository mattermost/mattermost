// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo, useEffect} from 'react';
import type {ComponentProps, CSSProperties} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import tinycolor from 'tinycolor2';

import type {UserProfile} from '@mattermost/types/users';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getUser as selectUser, makeDisplayNameGetter} from 'mattermost-redux/selectors/entities/users';

import ProfilePopover from 'components/profile_popover';
import Avatar from 'components/widgets/users/avatar';
import WithTooltip from 'components/with_tooltip';

import {imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './avatars.scss';

type Props = {
    userIds: Array<UserProfile['id']>;
    totalUsers?: number;
    size?: ComponentProps<typeof Avatar>['size'];
    fetchMissingUsers?: boolean;
};

const OTHERS_DISPLAY_LIMIT = 99;

function countMeta<T>(
    items: T[],
    total = items.length,
): [T[], T[], {overflowUnnamedCount: number; nonDisplayCount: number}] {
    const breakAt = Math.max(items.length, total) > 4 ? 3 : 4;

    const displayItems = items.slice(0, breakAt);
    const overflowItems = items.slice(breakAt);

    const overflowUnnamedCount = Math.max(total - displayItems.length - overflowItems.length, 0);
    const nonDisplayCount = overflowItems.length + overflowUnnamedCount;

    return [displayItems, overflowItems, {overflowUnnamedCount, nonDisplayCount}];
}

const displayNameGetter = makeDisplayNameGetter();

function UserAvatar({
    userId,
    ...props
}: {
    userId: UserProfile['id'];
} & ComponentProps<typeof Avatar>) {
    const user = useSelector((state: GlobalState) => selectUser(state, userId)) as UserProfile | undefined;
    const name = useSelector((state: GlobalState) => displayNameGetter(state, true)(user));

    const profilePictureURL = userId ? imageURLForUser(userId) : '';

    return (
        <ProfilePopover<HTMLButtonElement>
            triggerComponentAs='button'
            triggerComponentClass='style--none rounded-button'
            userId={userId}
            src={profilePictureURL}
        >
            <WithTooltip
                id={`tooltip-name-${userId}`}
                title={name}
                placement='top'
            >
                <Avatar
                    url={imageURLForUser(userId, user?.last_picture_update)}
                    tabIndex={-1}
                    {...props}
                />
            </WithTooltip>
        </ProfilePopover>
    );
}

function Avatars({
    size,
    userIds,
    totalUsers,
    fetchMissingUsers = true,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [displayUserIds, overflowUserIds, {overflowUnnamedCount, nonDisplayCount}] = countMeta(userIds, totalUsers);
    const overflowNames = useSelector((state: GlobalState) => {
        return overflowUserIds.map((userId) => displayNameGetter(state, true)(selectUser(state, userId))).join(', ');
    });

    const {centerChannelBg, centerChannelColor} = useSelector(getTheme);
    const avatarStyle: CSSProperties = useMemo(() => ({
        background: tinycolor.mix(centerChannelBg, centerChannelColor, 8).toRgbString(),
    }), [centerChannelBg, centerChannelColor]);

    useEffect(() => {
        if (fetchMissingUsers) {
            dispatch(getMissingProfilesByIds(userIds));
        }
    }, [fetchMissingUsers, userIds]);

    let overflowUsersTooltip = '';
    if (nonDisplayCount) {
        if (overflowUserIds.length) {
            overflowUsersTooltip = formatMessage(
                {
                    id: 'avatars.overflowUsers',
                    defaultMessage: '{overflowUnnamedCount, plural, =0 {{names}} =1 {{names} and one other} other {{names} and # others}}',
                },
                {
                    overflowUnnamedCount,
                    names: overflowNames,
                },
            );
        } else {
            overflowUsersTooltip = formatMessage(
                {
                    id: 'avatars.overflowUnnamedOnly',
                    defaultMessage: '{overflowUnnamedCount, plural, =1 {one other} other {# others}}',
                },
                {overflowUnnamedCount},
            );
        }
    }

    return (
        <div
            className={`Avatars Avatars___${size}`}
        >
            {displayUserIds.map((id) => (
                <UserAvatar
                    style={avatarStyle}
                    key={id}
                    userId={id}
                    size={size}
                />
            ))}
            {Boolean(nonDisplayCount) && (
                <WithTooltip
                    id={'names-overflow'}
                    placement='top'
                    title={overflowUsersTooltip}
                >
                    <Avatar
                        style={avatarStyle}
                        size={size}
                        tabIndex={0}
                        text={nonDisplayCount > OTHERS_DISPLAY_LIMIT ? `${OTHERS_DISPLAY_LIMIT}+` : `+${nonDisplayCount}`}
                    />
                </WithTooltip>
            )}
        </div>
    );
}

export default memo(Avatars);
