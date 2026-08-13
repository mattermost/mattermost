// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {ListChildComponentProps} from 'react-window';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import Member from './member';
import type {ChannelMember, ListItem} from './member_list';
import {ListItemType} from './member_list';

export interface ItemData {
    members: ListItem[];
    hasNextPage: boolean;
    channel: Channel;
    editing: boolean;
    totalMemberCount: number;
    openDirectMessage: (user: UserProfile) => void;
    fetchRemoteClusterInfo: (remoteId: string, includeDeleted?: boolean, forceRefresh?: boolean) => void;
}

const MemberListItem = memo(({index, style, data}: ListChildComponentProps<ItemData>) => {
    const {members, hasNextPage, channel, editing, totalMemberCount, openDirectMessage, fetchRemoteClusterInfo} = data;
    const isItemLoaded = !hasNextPage || index < members.length;

    if (isItemLoaded) {
        switch (members[index].type) {
        case ListItemType.Member: {
            const member = members[index].data as ChannelMember;
            return (
                <div
                    style={style}
                    key={member.user.id}
                >
                    <Member
                        channel={channel}
                        index={index}
                        totalUsers={totalMemberCount}
                        member={member}
                        editing={editing}
                        actions={{openDirectMessage, fetchRemoteClusterInfo}}
                    />
                </div>
            );
        }
        case ListItemType.Separator:
        case ListItemType.FirstSeparator:
            return (
                <div
                    key={index}
                    style={style}
                >
                    {members[index].data as JSX.Element}
                </div>
            );
        default:
            return null;
        }
    }

    return null;
});

export default MemberListItem;
