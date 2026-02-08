// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './followers_tab.scss';

interface MemberGroup {
    label: string;
    members: Array<{user: UserProfile; status: string; isAdmin: boolean}>;
}

interface Props {
    threadId: string;
    channelId: string;
}

export default function FollowersTab({threadId, channelId}: Props) {
    const [followers, setFollowers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const channelMembers = useSelector((state: GlobalState) => getChannelMembersInChannels(state)?.[channelId]);
    const statuses = useSelector((state: GlobalState) => {
        const result: Record<string, string> = {};
        for (const user of followers) {
            result[user.id] = getStatusForUserId(state, user.id) || 'offline';
        }
        return result;
    });

    const fetchFollowers = useCallback(() => {
        if (threadId) {
            setIsLoading(true);
            Client4.getThreadFollowers(threadId).then((users) => {
                setFollowers(users);
                setIsLoading(false);
            }).catch(() => {
                setFollowers([]);
                setIsLoading(false);
            });
        }
    }, [threadId]);

    useEffect(() => {
        fetchFollowers();
    }, [fetchFollowers]);

    const groups: MemberGroup[] = useMemo(() => {
        if (followers.length === 0) {
            return [];
        }

        const onlineAdmins: {user: UserProfile; status: string}[] = [];
        const onlineMembers: {user: UserProfile; status: string}[] = [];
        const bots: {user: UserProfile}[] = [];
        const offline: {user: UserProfile; isAdmin: boolean}[] = [];

        const sortByName = (a: {user: UserProfile}, b: {user: UserProfile}) => {
            const nameA = (a.user.nickname || a.user.username).toLowerCase();
            const nameB = (b.user.nickname || b.user.username).toLowerCase();
            return nameA.localeCompare(nameB);
        };

        for (const user of followers) {
            const status = statuses[user.id] || 'offline';
            const isAdmin = channelMembers?.[user.id]?.scheme_admin === true;

            if (user.is_bot) {
                bots.push({user});
                continue;
            }

            if (status === 'offline') {
                offline.push({user, isAdmin});
            } else if (isAdmin) {
                onlineAdmins.push({user, status});
            } else {
                onlineMembers.push({user, status});
            }
        }

        onlineAdmins.sort(sortByName);
        onlineMembers.sort(sortByName);
        bots.sort(sortByName);
        offline.sort(sortByName);

        const result: MemberGroup[] = [];

        if (onlineAdmins.length > 0) {
            result.push({
                label: `Admin — ${onlineAdmins.length}`,
                members: onlineAdmins.map((m) => ({user: m.user, status: m.status, isAdmin: true})),
            });
        }

        if (onlineMembers.length > 0) {
            result.push({
                label: `Member — ${onlineMembers.length}`,
                members: onlineMembers.map((m) => ({user: m.user, status: m.status, isAdmin: false})),
            });
        }

        if (bots.length > 0) {
            result.push({
                label: `Bot — ${bots.length}`,
                members: bots.map((m) => ({user: m.user, status: 'online', isAdmin: false})),
            });
        }

        if (offline.length > 0) {
            result.push({
                label: `Offline — ${offline.length}`,
                members: offline.map((m) => ({user: m.user, status: 'offline', isAdmin: m.isAdmin})),
            });
        }

        return result;
    }, [followers, statuses, channelMembers]);

    if (isLoading) {
        return (
            <div className='followers-tab followers-tab--empty'>
                <span className='followers-tab__empty-text'>{'Loading...'}</span>
            </div>
        );
    }

    if (followers.length === 0) {
        return (
            <div className='followers-tab followers-tab--empty'>
                <i className='icon icon-account-multiple-outline followers-tab__empty-icon'/>
                <span className='followers-tab__empty-text'>{'No followers yet'}</span>
            </div>
        );
    }

    return (
        <div className='followers-tab'>
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
