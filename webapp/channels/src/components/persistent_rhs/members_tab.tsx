// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getProfilesInChannel} from 'mattermost-redux/actions/users';
import {getChannelMembers} from 'mattermost-redux/actions/channels';

import {loadStatusesForProfilesList} from 'actions/status_actions';
import {getChannelMembersGroupedByStatus} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './members_tab.scss';

interface MemberGroup {
    label: string;
    members: Array<{user: any; status: string; isAdmin: boolean}>;
}

export default function MembersTab() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const groupedMembers = useSelector((state: GlobalState) =>
        (channel ? getChannelMembersGroupedByStatus(state, channel.id) : null),
    );

    useEffect(() => {
        if (channel?.id) {
            dispatch(getProfilesInChannel(channel.id, 0, 100)).then(({data}) => {
                if (data) {
                    dispatch(loadStatusesForProfilesList(data));
                }
            });
            dispatch(getChannelMembers(channel.id));
        }
    }, [dispatch, channel?.id]);

    const groups: MemberGroup[] = useMemo(() => {
        if (!groupedMembers) {
            return [];
        }

        const result: MemberGroup[] = [];

        if (groupedMembers.onlineAdmins.length > 0) {
            result.push({
                label: `Admin — ${groupedMembers.onlineAdmins.length}`,
                members: groupedMembers.onlineAdmins.map((m: any) => ({
                    user: m.user,
                    status: m.status,
                    isAdmin: true,
                })),
            });
        }

        if (groupedMembers.onlineMembers.length > 0) {
            result.push({
                label: `Member — ${groupedMembers.onlineMembers.length}`,
                members: groupedMembers.onlineMembers.map((m: any) => ({
                    user: m.user,
                    status: m.status,
                    isAdmin: false,
                })),
            });
        }

        if (groupedMembers.offline.length > 0) {
            result.push({
                label: `Offline — ${groupedMembers.offline.length}`,
                members: groupedMembers.offline.map((m: any) => ({
                    user: m.user,
                    status: 'offline',
                    isAdmin: m.isAdmin,
                })),
            });
        }

        return result;
    }, [groupedMembers]);

    if (groups.length === 0) {
        return (
            <div className='members-tab members-tab--empty'>
                <span>{'No members'}</span>
            </div>
        );
    }

    return (
        <div className='members-tab'>
            {groups.map((group) => (
                <div key={group.label}>
                    <div className='members-tab__group-header'>
                        <span className='members-tab__group-label'>
                            {group.label}
                        </span>
                    </div>
                    {group.members.map((member) => (
                        <MemberRow
                            key={member.user.id}
                            user={member.user}
                            status={member.status}
                            isAdmin={member.isAdmin}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
