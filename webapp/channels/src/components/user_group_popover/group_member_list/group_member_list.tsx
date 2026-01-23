// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';
import type {ListChildComponentProps} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import styled, {css} from 'styled-components';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import ProfilePopover from 'components/profile_popover';
import StatusIcon from 'components/status_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import Avatar from 'components/widgets/users/avatar';
import WithTooltip from 'components/with_tooltip';

import {UserStatuses} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {Load} from '../constants';

const USERS_PER_PAGE = 100;

// These constants must be changed if user list style is modified
export const VIEWPORT_SCALE_FACTOR = 0.4;
const ITEM_HEIGHT = 40;
const MARGIN = 8;
const getItemHeight = (isCap: boolean) => (isCap ? ITEM_HEIGHT + MARGIN : ITEM_HEIGHT);
export const getListHeight = (num: number) => (num * ITEM_HEIGHT) + (2 * MARGIN);

// Reasonable extrema for the user list
const MIN_LIST_HEIGHT = 120;
export const MAX_LIST_HEIGHT = 800;

export type GroupMember = {
    user: UserProfile;
    displayName: string;
}

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

    const history = useHistory();

    const {formatMessage} = useIntl();

    const [nextPage, setNextPage] = useState(Math.floor(members.length / USERS_PER_PAGE));
    const [nextPageLoadState, setNextPageLoadState] = useState(Load.DONE);
    const [currentDMLoading, setCurrentDMLoading] = useState<string | undefined>(undefined);

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

    const showDirectChannel = (user: UserProfile) => {
        if (currentDMLoading !== undefined) {
            return;
        }
        setCurrentDMLoading(user.id);
        actions.openDirectChannelToUserId(user.id).then((result: ActionResult) => {
            if (!result.error) {
                actions.closeRightHandSide();
                setCurrentDMLoading(undefined);
                hide?.();
                history.push(`${teamUrl}/messages/@${user.username}`);
            }
        });
    };

    const isSearching = searchTerm !== '';
    const hasNextPage = !isSearching && members.length < group.member_count;
    const itemCount = !isSearching && hasNextPage ? members.length + 1 : members.length;

    const loadMoreItems = isSearching || nextPageLoadState === Load.LOADING ? () => {} : loadNextPage;

    const maxListHeight = Math.min(MAX_LIST_HEIGHT, Math.max(MIN_LIST_HEIGHT, Utils.getViewportSize().h * VIEWPORT_SCALE_FACTOR));

    const isUserLoaded = (index: number) => {
        return isSearching || !hasNextPage || index < members.length;
    };

    const Item = ({index, style}: ListChildComponentProps) => {
        const status = useSelector((state: GlobalState) => getStatusForUserId(state, members[index]?.user?.id) || UserStatuses.OFFLINE);

        // Remove explicit height provided by VariableSizeList
        style.height = undefined;

        if (isUserLoaded(index)) {
            const user = members[index].user;
            const name = members[index].displayName;

            return (
                <UserListItem
                    className='group-member-list_item'
                    first={index === 0}
                    last={index === group.member_count - 1}
                    style={style}
                    key={user.id}
                    role='listitem'
                >
                    <ProfilePopover
                        userId={user.id}
                        src={Utils.imageURLForUser(user?.id ?? '')}
                        hideStatus={user.is_bot}
                    >
                        <UserButton>
                            <span className='status-wrapper'>
                                <Avatar
                                    username={user.username}
                                    size={'sm'}
                                    url={Utils.imageURLForUser(user?.id ?? '')}
                                    className={'avatar-post-preview'}
                                    tabIndex={-1}
                                />
                                <StatusIcon
                                    status={status}
                                />
                            </span>
                            <Username className='overflow--ellipsis text-nowrap'>{name}</Username>
                            <Gap className='group-member-list_gap'/>
                        </UserButton>
                    </ProfilePopover>
                    <DMContainer className='group-member-list_dm-button'>
                        <WithTooltip
                            title={formatMessage({id: 'group_member_list.sendMessageTooltip', defaultMessage: 'Send message'})}
                        >
                            <DMButton
                                className='btn btn-icon btn-xs'
                                aria-label={formatMessage(
                                    {id: 'group_member_list.sendMessageButton', defaultMessage: 'Send message to {user}'},
                                    {user: name})}
                                onClick={() => showDirectChannel(user)}
                            >
                                <i
                                    className='icon icon-send'
                                />
                            </DMButton>
                        </WithTooltip>
                    </DMContainer>
                </UserListItem>
            );
        }

        return (
            <LoadingItem
                style={style}
                first={index === 0}
                last={index === members.length}
            >
                <LoadingSpinner/>
            </LoadingItem>
        );
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
                        >
                            {Item}
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

const UserListItem = styled.div<{first?: boolean; last?: boolean}>`
    ${(props) => props.first && css `
        margin-top: ${MARGIN}px;
    `}

    ${(props) => props.last && css `
        margin-bottom: ${MARGIN}px;
    `}

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .group-member-list_gap {
        display: none;
    }

    .group-member-list_dm-button {
        opacity: 0;
    }

    &:hover .group-member-list_gap,
    &:focus-within .group-member-list_gap {
        display: initial;
    }

    &:hover .group-member-list_dm-button,
    &:focus-within .group-member-list_dm-button {
        opacity: 1;
    }
`;

const UserButton = styled.button`
    display: flex;
    width: 100%;
    padding: 5px 20px;
    border: none;
    background: unset;
    text-align: unset;
    align-items: center;
`;

// A gap to make space for the DM button to be positioned on
const Gap = styled.span`
    width: 24px;
    flex: 0 0 auto;
    margin-left: 4px;
`;

const Username = styled.span`
    padding-left: 12px;
    flex: 1 1 auto;
`;

const DMContainer = styled.div`
    height: 100%;
    position: absolute;
    right: 20px;
    top: 0;
    display: flex;
    align-items: center;
`;

const DMButton = styled.button`
    width: 24px;
    height: 24px;

    svg {
        width: 16px;
    }
`;

const LoadingItem = styled.div<{first?: boolean; last?: boolean}>`
    ${(props) => props.first && css `
        padding-top: ${MARGIN}px;
    `}

    ${(props) => props.last && css `
        padding-bottom: ${MARGIN}px;
    `}

    display: flex;
    justify-content: center;
    align-items: center;
    height: ${ITEM_HEIGHT}px;
    box-sizing: content-box;
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
