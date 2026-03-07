// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import styled from 'styled-components';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import * as Utils from 'utils/utils';

import type {GroupMember} from './group_member_list_item';
import GroupMemberListItem, {ITEM_HEIGHT, MARGIN} from './group_member_list_item';

import {Load} from '../constants';

const USERS_PER_PAGE = 100;

// These constants must be changed if user list style is modified
export const VIEWPORT_SCALE_FACTOR = 0.4;
const getItemHeight = (isCap: boolean) => (isCap ? ITEM_HEIGHT + MARGIN : ITEM_HEIGHT);
export const getListHeight = (num: number) => (num * ITEM_HEIGHT) + (2 * MARGIN);

// Reasonable extrema for the user list
const MIN_LIST_HEIGHT = 120;
export const MAX_LIST_HEIGHT = 800;

export type Props = {

    /**
     * The group corresponding to the parent popover
     */
    group: Group;

    /**
     * Function to call if parent popover should be hidden
     */
    hide: () => void;

    /**
     * State of current search
     */
    searchState: Load;

    /**
     * @internal
     */
    members: GroupMember[];
    teamUrl: string;
    searchTerm: string;

    actions: {
        getUsersInGroup: (groupId: string, page: number, perPage: number, sort: string) => Promise<ActionResult<UserProfile[]>>;
        openDirectChannelToUserId: (userId: string) => Promise<ActionResult>;
        closeRightHandSide: () => void;
    };
}

const GroupMemberList = (props: Props) => {
    const {
        group,
        actions,
        members,
        hide,
        teamUrl,
        searchTerm,
        searchState,
    } = props;

    const [nextPage, setNextPage] = useState(Math.floor(members.length / USERS_PER_PAGE));
    const [nextPageLoadState, setNextPageLoadState] = useState(Load.DONE);

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
    }, [members.length, hasMounted]);

    const loadNextPage = async () => {
        setNextPageLoadState(Load.LOADING);
        const res = await actions.getUsersInGroup(group.id, nextPage, USERS_PER_PAGE, 'display_name');
        if (res.data) {
            setNextPage(nextPage + 1);
            setNextPageLoadState(Load.DONE);
        } else {
            setNextPageLoadState(Load.FAILED);
        }
    };

    const isSearching = searchTerm !== '';
    const hasNextPage = !isSearching && members.length < group.member_count;
    const itemCount = !isSearching && hasNextPage ? members.length + 1 : members.length;

    const loadMoreItems = isSearching || nextPageLoadState === Load.LOADING ? () => {} : loadNextPage;

    const maxListHeight = Math.min(MAX_LIST_HEIGHT, Math.max(MIN_LIST_HEIGHT, Utils.getViewportSize().h * VIEWPORT_SCALE_FACTOR));

    const isUserLoaded = (index: number) => {
        return isSearching || !hasNextPage || index < members.length;
    };

    const renderContent = () => {
        if (searchState === Load.LOADING) {
            return (
                <LargeLoadingItem>
                    <LoadingSpinner/>
                </LargeLoadingItem>
            );
        } else if (searchState === Load.FAILED) {
            return (
                <LoadFailedItem>
                    <span>
                        <FormattedMessage
                            id='group_member_list.searchError'
                            defaultMessage='There was a problem getting results. Clear your search term and try again.'
                        />
                    </span>
                </LoadFailedItem>
            );
        } else if (isSearching && members.length === 0) {
            return (
                <NoResultsItem>
                    <NoResultsIndicator
                        variant={NoResultsVariant.ChannelSearch}
                        titleValues={{channelName: `"${searchTerm}"`}}
                    />
                </NoResultsItem>
            );
        } else if (nextPageLoadState === Load.FAILED) {
            return (
                <LoadFailedItem>
                    <span>
                        <FormattedMessage
                            id='group_member_list.loadError'
                            defaultMessage='Oops! Something went wrong while loading this group.'
                        />
                        {' '}
                        <RetryButton
                            onClick={loadMoreItems}
                        >
                            <FormattedMessage
                                id='group_member_list.retryLoadButton'
                                defaultMessage='Retry'
                            />
                        </RetryButton>
                    </span>
                </LoadFailedItem>
            );
        }
        return (<AutoSizer>
            {({height, width}) => (
                <InfiniteLoader
                    ref={infiniteLoaderRef}
                    isItemLoaded={isUserLoaded}
                    itemCount={itemCount}
                    loadMoreItems={loadMoreItems}
                    threshold={5}
                >
                    {({onItemsRendered, ref}) => (
                        <VariableSizeList
                            itemCount={itemCount}
                            onItemsRendered={onItemsRendered}
                            ref={ref}
                            itemSize={(index) => getItemHeight(index === 0 || index === group.member_count - 1 || index === members.length + 1)}
                            height={height}
                            width={width}
                            itemData={{
                                members,
                                group,
                                hide,
                                teamUrl,
                                actions: {
                                    openDirectChannelToUserId: actions.openDirectChannelToUserId,
                                    closeRightHandSide: actions.closeRightHandSide,
                                },
                            }}
                        >
                            {GroupMemberListItem}
                        </VariableSizeList>)}
                </InfiniteLoader>
            )}
        </AutoSizer>);
    };

    return (
        <UserList
            style={{height: Math.min(maxListHeight, getListHeight(group.member_count))}}
            role='list'
        >
            {renderContent()}
        </UserList>
    );
};

const UserList = styled.div`
    display: flex;
    padding: 0;
    margin: 0;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    box-sizing: content-box;
    position: relative;
`;

const LargeLoadingItem = styled.div`
    display: flex;
    align-self: stretch;
    justify-content: center;
    align-items: center;
    width: 100%;
`;

const LoadFailedItem = styled(LargeLoadingItem)`
    padding: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    text-align: center;
    font-size: 12px;
`;

const NoResultsItem = styled.div`
    align-self: stretch;
    overflow-y: scroll;
    overflow-y: overlay;
`;

const RetryButton = styled.button`
    background: none;
    padding: 0;
    border: none;
    font-weight: 600;
    color: var(--link-color);
`;

export default React.memo(GroupMemberList);
