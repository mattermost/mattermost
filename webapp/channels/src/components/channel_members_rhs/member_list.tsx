// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useMemo, useRef, useState} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import MemberListItem from './member_list_item';
import type {ItemData} from './member_list_item';

export interface ChannelMember {
    user: UserProfile;
    membership?: ChannelMembership;
    status?: string;
    displayName: string;
    remoteDisplayName?: string;
}

export enum ListItemType {
    Member = 'member',
    FirstSeparator = 'first-separator',
    Separator = 'separator',
}

export type ListItem = {
    type: ListItemType;
    data: ChannelMember | JSX.Element;
};
export interface Props {
    channel: Channel;
    members: ListItem[];
    editing: boolean;
    hasNextPage: boolean;
    isNextPageLoading: boolean;
    searchTerms: string;
    openDirectMessage: (user: UserProfile) => void;
    fetchRemoteClusterInfo: (remoteId: string, includeDeleted?: boolean, forceRefresh?: boolean) => void;
    loadMore: () => void;
}

const MemberList = ({
    hasNextPage,
    isNextPageLoading,
    channel,
    members,
    searchTerms,
    editing,
    openDirectMessage,
    fetchRemoteClusterInfo,
    loadMore,
}: Props) => {
    const infiniteLoaderRef = useRef<InfiniteLoader | null>(null);
    const variableSizeListRef = useRef<VariableSizeList | null>(null);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        if (hasMounted) {
            if (infiniteLoaderRef.current) {
                infiniteLoaderRef.current.resetloadMoreItemsCache();
            }
            if (variableSizeListRef.current) {
                variableSizeListRef.current.resetAfterIndex(0);
            }
        }
        setHasMounted(true);
    }, [searchTerms, members.length, hasMounted]);

    const itemCount = hasNextPage ? members.length + 1 : members.length;

    const loadMoreItems = isNextPageLoading ? () => {} : loadMore;

    const isItemLoaded = (index: number) => {
        return !hasNextPage || index < members.length;
    };

    const getItemSize = (index: number) => {
        if (!(index in members)) {
            return 0;
        }

        switch (members[index].type) {
        case ListItemType.FirstSeparator:
            return 28;
        case ListItemType.Separator:
            return 16 + 28;
        }

        return 48;
    };

    const totalMemberCount = useMemo(
        () => members.filter((l) => l.type === ListItemType.Member).length,
        [members],
    );

    const itemData: ItemData = useMemo(() => ({
        members,
        hasNextPage,
        channel,
        editing,
        totalMemberCount,
        openDirectMessage,
        fetchRemoteClusterInfo,
    }), [members, hasNextPage, channel, editing, totalMemberCount, openDirectMessage, fetchRemoteClusterInfo]);

    if (members.length === 0) {
        return null;
    }

    return (
        <AutoSizer>
            {({height, width}) => (
                <InfiniteLoader
                    ref={infiniteLoaderRef}
                    isItemLoaded={isItemLoaded}
                    itemCount={itemCount}
                    loadMoreItems={loadMoreItems}
                >
                    {({onItemsRendered, ref}) => (

                        <VariableSizeList
                            itemCount={itemCount}
                            onItemsRendered={onItemsRendered}
                            ref={(list) => {
                                ref(list);
                                variableSizeListRef.current = list;
                            }}
                            itemData={itemData}
                            itemSize={getItemSize}
                            height={height}
                            width={width}
                        >
                            {MemberListItem}
                        </VariableSizeList>
                    )}
                </InfiniteLoader>
            )}
        </AutoSizer>
    );
};

export default memo(MemberList);
