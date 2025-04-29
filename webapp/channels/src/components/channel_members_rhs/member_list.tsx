// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useRef, useState} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';
import type {ListChildComponentProps} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import Member from './member';

interface ChannelMember {
    user: UserProfile;
    membership?: ChannelMembership;
    status?: string;
    displayName: string;
}

enum ListItemType {
    Member = 'member',
    FirstSeparator = 'first-separator',
    Separator = 'separator',
}

interface ListItem {
    type: ListItemType;
    data: ChannelMember | JSX.Element;
}
export interface Props {
    channel: Channel;
    members: ListItem[];
    editing: boolean;
    hasNextPage: boolean;
    isNextPageLoading: boolean;
    searchTerms: string;
    openDirectMessage: (user: UserProfile) => void;
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

    const Item = ({index, style}: ListChildComponentProps) => {
        if (isItemLoaded(index)) {
            switch (members[index].type) {
            case ListItemType.Member:
                // eslint-disable-next-line no-case-declarations
                const member = members[index].data as ChannelMember;
                return (
                    <div
                        style={style}
                        key={member.user.id}
                    >
                        <Member
                            channel={channel}
                            index={index}
                            totalUsers={members.filter((l) => l.type === ListItemType.Member).length}
                            member={member}
                            editing={editing}
                            actions={{openDirectMessage}}
                        />
                    </div>
                );
            case ListItemType.Separator:
            case ListItemType.FirstSeparator:
                return (
                    <div
                        key={index}
                        style={style}
                    >
                        {members[index].data}
                    </div>
                );
            default:
                return null;
            }
        }

        return null;
    };

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

                            itemSize={getItemSize}
                            height={height}
                            width={width}
                        >
                            {Item}
                        </VariableSizeList>
                    )}
                </InfiniteLoader>
            )}
        </AutoSizer>
    );
};

export default memo(MemberList);
