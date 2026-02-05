// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getProfilesInChannel} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './group_dm_participants.scss';

interface Props {
    channelId: string;
}

export default function GroupDmParticipants({channelId}: Props) {
    const profiles = useSelector((state: GlobalState) =>
        (getProfilesInChannel(state, channelId) || [])
    );

    const membersWithStatus = useSelector((state: GlobalState) => {
        return profiles.map((user) => ({
            user,
            status: getStatusForUserId(state, user.id) || 'offline',
        }));
    });

    // Sort: online first, then alphabetically
    const sortedMembers = [...membersWithStatus].sort((a, b) => {
        const aOnline = a.status !== 'offline' ? 0 : 1;
        const bOnline = b.status !== 'offline' ? 0 : 1;
        if (aOnline !== bOnline) {
            return aOnline - bOnline;
        }
        return (a.user.username || '').localeCompare(b.user.username || '');
    });

    return (
        <div className='group-dm-participants'>
            {sortedMembers.map(({user, status}) => (
                <MemberRow
                    key={user.id}
                    user={user}
                    status={status}
                    isAdmin={false}
                />
            ))}
        </div>
    );
}
