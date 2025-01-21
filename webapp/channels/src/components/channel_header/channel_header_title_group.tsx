// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername, isGuest} from 'mattermost-redux/utils/user_utils';

import GuestTag from 'components/widgets/tag/guest_tag';

type Props = {
    gmMembers?: UserProfile[];
}

const ChannelHeaderTitleGroup = ({
    gmMembers,
}: Props) => {
    const currentUser = useSelector(getCurrentUser);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const channel = useSelector(getCurrentChannel);

    if (!channel) {
        return null;
    }

    // map the displayname to the gm member users
    const membersMap: Record<string, UserProfile[]> = {};
    if (gmMembers) {
        for (const user of gmMembers) {
            if (user.id === currentUser.id) {
                continue;
            }
            const userDisplayName = displayUsername(user, teammateNameDisplaySetting);

            if (!membersMap[userDisplayName]) {
                membersMap[userDisplayName] = []; //Create an array for cases with same display name
            }

            membersMap[userDisplayName].push(user);
        }
    }

    const displayNames = channel.display_name.split(', ');

    return (
        <>
            {displayNames.map((displayName, index) => {
                if (!membersMap[displayName]) {
                    return displayName;
                }

                const user = membersMap[displayName].shift();

                return (
                    <React.Fragment key={user?.id}>
                        {index > 0 && ', '}
                        {displayName}
                        {isGuest(user?.roles ?? '') && <GuestTag/>}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default memo(ChannelHeaderTitleGroup);
