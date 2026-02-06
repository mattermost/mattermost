// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getProfilesInChannel} from 'mattermost-redux/actions/users';

import {getChannelMembersGroupedByStatus} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './members_tab.scss';

const GROUP_HEADER_HEIGHT = 32;
const MEMBER_ROW_HEIGHT = 44;

interface ListItem {
    type: 'header' | 'member';
    label?: string;
    count?: number;
    user?: any;
    status?: string;
    isAdmin?: boolean;
}

export default function MembersTab() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const groupedMembers = useSelector((state: GlobalState) =>
        (channel ? getChannelMembersGroupedByStatus(state, channel.id) : null)
    );

    useEffect(() => {
        if (channel?.id) {
            dispatch(getProfilesInChannel(channel.id, 0, 100));
        }
    }, [dispatch, channel?.id]);

    // Flatten grouped members into list items
    const listItems: ListItem[] = useMemo(() => {
        if (!groupedMembers) {
            return [];
        }

        const items: ListItem[] = [];

        // Online Admins
        if (groupedMembers.onlineAdmins.length > 0) {
            items.push({
                type: 'header',
                label: 'Admin',
                count: groupedMembers.onlineAdmins.length,
            });
            for (const member of groupedMembers.onlineAdmins) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: member.status,
                    isAdmin: true,
                });
            }
        }

        // Online Members
        if (groupedMembers.onlineMembers.length > 0) {
            items.push({
                type: 'header',
                label: 'Member',
                count: groupedMembers.onlineMembers.length,
            });
            for (const member of groupedMembers.onlineMembers) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: member.status,
                    isAdmin: false,
                });
            }
        }

        // Offline
        if (groupedMembers.offline.length > 0) {
            items.push({
                type: 'header',
                label: 'Offline',
                count: groupedMembers.offline.length,
            });
            for (const member of groupedMembers.offline) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: 'offline',
                    isAdmin: member.isAdmin,
                });
            }
        }

        return items;
    }, [groupedMembers]);

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
                    user={item.user}
                    status={item.status || 'offline'}
                    isAdmin={item.isAdmin || false}
                />
            </div>
        );
    }, [listItems]);

    if (listItems.length === 0) {
        return (
            <div className='members-tab members-tab--empty'>
                <span>{'No members'}</span>
            </div>
        );
    }

    return (
        <div className='members-tab'>
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