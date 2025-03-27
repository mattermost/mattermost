// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername, isGuest} from 'mattermost-redux/utils/user_utils';

import GuestTag from 'components/widgets/tag/guest_tag';

type Props = {
    gmMembers?: UserProfile[];
}

const ChannelHeaderTitleGroup = ({
    gmMembers = [],
}: Props) => {
    const currentUserId = useSelector(getCurrentUserId);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const channel = useSelector(getCurrentChannel);

    if (!channel) {
        return null;
    }

    const usersWithNames = gmMembers.
        filter((user) => user.id !== currentUserId).
        map((user) => ({...user, display_name: displayUsername(user, teammateNameDisplaySetting)}));

    usersWithNames.sort((a, b) => a.display_name.localeCompare(b.display_name));

    return (
        <>
            {usersWithNames.map((user, index) => {
                return (
                    <React.Fragment key={user?.id}>
                        {index > 0 && ', '}
                        {user.display_name}
                        {isGuest(user?.roles ?? '') && <GuestTag/>}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default memo(ChannelHeaderTitleGroup);
