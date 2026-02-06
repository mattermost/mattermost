// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './followers_tab.scss';

const GROUP_HEADER_HEIGHT = 32;
const MEMBER_ROW_HEIGHT = 44;

interface ListItem {
    type: 'header' | 'member';
    label?: string;
    count?: number;
    user?: UserProfile;
    status?: string;
    isAdmin?: boolean;
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

    // Group followers by role and status, same as MembersTab
    const listItems: ListItem[] = useMemo(() => {
        if (followers.length === 0) {
            return [];
        }

        const onlineAdmins: {user: UserProfile; status: string}[] = [];
        const onlineMembers: {user: UserProfile; status: string}[] = [];
        const offline: {user: UserProfile; isAdmin: boolean}[] = [];

        const sortByName = (a: {user: UserProfile}, b: {user: UserProfile}) => {
            const nameA = (a.user.nickname || a.user.username).toLowerCase();
            const nameB = (b.user.nickname || b.user.username).toLowerCase();
            return nameA.localeCompare(nameB);
        };

        for (const user of followers) {
            const status = statuses[user.id] || 'offline';
            const isAdmin = channelMembers?.[user.id]?.scheme_admin === true;

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
        offline.sort(sortByName);

        const items: ListItem[] = [];

        if (onlineAdmins.length > 0) {
            items.push({type: 'header', label: 'Admin', count: onlineAdmins.length});
            for (const m of onlineAdmins) {
                items.push({type: 'member', user: m.user, status: m.status, isAdmin: true});
            }
        }

        if (onlineMembers.length > 0) {
            items.push({type: 'header', label: 'Member', count: onlineMembers.length});
            for (const m of onlineMembers) {
                items.push({type: 'member', user: m.user, status: m.status, isAdmin: false});
            }
        }

        if (offline.length > 0) {
            items.push({type: 'header', label: 'Offline', count: offline.length});
            for (const m of offline) {
                items.push({type: 'member', user: m.user, status: 'offline', isAdmin: m.isAdmin});
            }
        }

        return items;
    }, [followers, statuses, channelMembers]);

    const getItemSize = useCallback((index: number) => {
        const item = listItems[index];
        return item.type === 'header' ? GROUP_HEADER_HEIGHT : MEMBER_ROW_HEIGHT;
    }, [listItems]);

    const renderItem = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const item = listItems[index];

        if (item.type === 'header') {
            return (
                <div
                    className='members-tab__group-header'
                    style={style}
                >
                    <span className='members-tab__group-label'>
                        {`${item.label} — ${item.count}`}
                    </span>
                </div>
            );
        }

        return (
            <div style={style}>
                <MemberRow
                    user={item.user!}
                    status={item.status || 'offline'}
                    isAdmin={item.isAdmin || false}
                />
            </div>
        );
    }, [listItems]);

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
            <AutoSizer>
                {({height, width}) => (
                    <VariableSizeList
                        height={height}
                        width={width}
                        itemCount={listItems.length}
                        itemSize={getItemSize}
                    >
                        {renderItem}
                    </VariableSizeList>
                )}
            </AutoSizer>
        </div>
    );
}
