// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {useHistory, useLocation} from 'react-router-dom';
import {FixedSizeList, ListChildComponentProps} from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getPosts} from 'mattermost-redux/actions/posts';
import {savePreferences} from 'mattermost-redux/actions/preferences';

import {loadStatusesByIds} from 'actions/status_actions';
import {leaveDirectChannel} from 'actions/views/channel';
import {openModal} from 'actions/views/modals';
import {getAllDmChannelsWithUsers} from 'selectors/views/guilded_layout';
import type {DmOrGroupDm} from 'selectors/views/guilded_layout';
import MoreDirectChannels from 'components/more_direct_channels';
import {Constants, ModalIdentifiers} from 'utils/constants';

import EnhancedDmRow from 'components/enhanced_dm_row';
import EnhancedGroupDmRow from 'components/enhanced_group_dm_row';

import DmSearchInput from './dm_search_input';

import './dm_list_page.scss';

const ROW_HEIGHT = 52;

// Data passed to each row via react-window's itemData prop
interface RowData {
    items: DmOrGroupDm[];
    currentChannelId: string;
    onClose: (channelId: string) => void;
}

// Stable row component defined outside DMListPage to avoid re-creation on parent renders.
// react-window will only re-render rows when itemData changes, and React.memo on
// EnhancedDmRow/EnhancedGroupDmRow prevents actual re-renders unless props changed.
const DmListRow = ({index, style, data}: ListChildComponentProps<RowData>) => {
    const item = data.items[index];
    if (!item) {
        return null;
    }

    const isActive = item.channel.id === data.currentChannelId;

    if (item.type === 'dm') {
        return (
            <div style={style}>
                <EnhancedDmRow
                    channel={item.channel}
                    user={item.user}
                    isActive={isActive}
                    onClose={data.onClose}
                />
            </div>
        );
    }

    return (
        <div style={style}>
            <EnhancedGroupDmRow
                channel={item.channel}
                users={item.users}
                isActive={isActive}
                onClose={data.onClose}
            />
        </div>
    );
};

const DMListPage = () => {
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const currentChannelId = useSelector(getCurrentChannelId);
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const currentUserId = useSelector(getCurrentUserId);
    const allDms = useSelector(getAllDmChannelsWithUsers);
    const hasFetchedPosts = useRef<Set<string>>(new Set());
    const hasFetchedStatuses = useRef(false);
    const hasAutoSelected = useRef(false);

    // Refs for stable callback access to latest values
    const allDmsRef = useRef(allDms);
    allDmsRef.current = allDms;
    const currentChannelIdRef = useRef(currentChannelId);
    currentChannelIdRef.current = currentChannelId;
    const currentTeamUrlRef = useRef(currentTeamUrl);
    currentTeamUrlRef.current = currentTeamUrl;

    const [searchTerm, setSearchTerm] = useState('');

    // Fetch latest post for each DM channel (on mount and when new DMs appear)
    useEffect(() => {
        allDms.forEach((dm) => {
            if (!hasFetchedPosts.current.has(dm.channel.id)) {
                hasFetchedPosts.current.add(dm.channel.id);
                dispatch(getPosts(dm.channel.id, 0, 1));
            }
        });
    }, [dispatch, allDms]);

    // Fetch statuses for all DM users (once on mount)
    useEffect(() => {
        if (!hasFetchedStatuses.current && allDms.length > 0) {
            hasFetchedStatuses.current = true;
            const userIds: string[] = [];
            allDms.forEach((dm) => {
                if (dm.type === 'dm') {
                    userIds.push(dm.user.id);
                } else if (dm.type === 'group') {
                    dm.users.forEach((u) => userIds.push(u.id));
                }
            });
            if (userIds.length > 0) {
                dispatch(loadStatusesByIds(userIds));
            }
        }
    }, [dispatch, allDms]);

    // Auto-select the most recent DM on mount ONLY IF we are not already on a DM channel.
    // We check both currentChannelId (Redux state, updates async) and the URL path
    // (updates synchronously with history.push) to avoid overriding avatar click navigation.
    useEffect(() => {
        if (!hasAutoSelected.current && allDms.length > 0 && currentTeamUrl) {
            // Check if already navigating to a DM via URL (handles avatar clicks where
            // currentChannelId hasn't updated yet but the URL has)
            const isOnDmRoute = location.pathname.includes('/messages/');

            // Also check if the current channel is already a DM in the list
            const isAlreadyOnDm = isOnDmRoute || (currentChannelId && allDms.some((dm) => dm.channel.id === currentChannelId));
            hasAutoSelected.current = true;
            if (!isAlreadyOnDm) {
                const firstDm = allDms[0];
                if (firstDm.type === 'dm') {
                    history.push(`${currentTeamUrl}/messages/@${firstDm.user.username}`);
                } else {
                    history.push(`${currentTeamUrl}/messages/${firstDm.channel.name}`);
                }
            }
        }
    }, [allDms, currentTeamUrl, currentChannelId, location.pathname, history]);

    const filteredDms = useMemo(() => {
        if (!searchTerm) {
            return allDms;
        }

        const term = searchTerm.toLowerCase();
        return allDms.filter((item) => {
            if (item.type === 'dm') {
                const user = item.user;
                return (
                    user.username.toLowerCase().includes(term) ||
                    (user.nickname && user.nickname.toLowerCase().includes(term)) ||
                    (user.first_name && user.first_name.toLowerCase().includes(term)) ||
                    (user.last_name && user.last_name.toLowerCase().includes(term))
                );
            } else if (item.type === 'group') {
                // Search in channel display name or any user in the group
                if (item.channel.display_name.toLowerCase().includes(term)) {
                    return true;
                }
                return item.users.some((user) =>
                    user.username.toLowerCase().includes(term) ||
                    (user.nickname && user.nickname.toLowerCase().includes(term))
                );
            }
            return false;
        });
    }, [allDms, searchTerm]);

    const handleNewMessage = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
            dialogType: MoreDirectChannels,
            dialogProps: {
                isExistingChannel: false,
                focusOriginElement: null,
            },
        }));
    }, [dispatch]);

    // Stable callback using refs to avoid re-creation when allDms/currentChannelId change.
    // This prevents the Row component and all child React.memo components from re-rendering
    // just because a new DM appeared or the active channel changed.
    const handleCloseDm = useCallback((channelId: string) => {
        const currentAllDms = allDmsRef.current;
        const item = currentAllDms.find((dm) => dm.channel.id === channelId);
        if (!item) {
            return;
        }

        const channel = item.channel;
        let category: string;
        let prefName: string;
        if (channel.type === Constants.DM_CHANNEL) {
            category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
            prefName = item.type === 'dm' ? item.user.id : '';
        } else {
            category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;
            prefName = channel.id;
        }

        if (!prefName) {
            return;
        }

        dispatch(leaveDirectChannel(channel.name));
        dispatch(savePreferences(currentUserId, [{user_id: currentUserId, category, name: prefName, value: 'false'}]));

        // If closing the currently active DM, navigate to the next available one
        if (channelId === currentChannelIdRef.current) {
            const remaining = currentAllDms.filter((dm) => dm.channel.id !== channelId);
            if (remaining.length > 0) {
                const next = remaining[0];
                const teamUrl = currentTeamUrlRef.current;
                if (next.type === 'dm') {
                    history.push(`${teamUrl}/messages/@${next.user.username}`);
                } else {
                    history.push(`${teamUrl}/messages/${next.channel.name}`);
                }
            }
        }
    }, [currentUserId, dispatch, history]);

    // Memoize itemData so react-window only re-renders rows when data actually changes
    const itemData = useMemo<RowData>(() => ({
        items: filteredDms,
        currentChannelId,
        onClose: handleCloseDm,
    }), [filteredDms, currentChannelId, handleCloseDm]);

    // Stable key extractor helps react-window reuse DOM elements when items reorder
    const itemKey = useCallback((index: number, data: RowData) => {
        return data.items[index]?.channel.id || String(index);
    }, []);

    return (
        <div className='dm-list-page'>
            <DmSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onNewMessageClick={handleNewMessage}
            />

            <div className='dm-list-page__list-container'>
                {filteredDms.length > 0 ? (
                    <AutoSizer>
                        {({height, width}) => (
                            <FixedSizeList
                                height={height}
                                width={width}
                                itemCount={filteredDms.length}
                                itemSize={ROW_HEIGHT}
                                itemData={itemData}
                                itemKey={itemKey}
                            >
                                {DmListRow}
                            </FixedSizeList>
                        )}
                    </AutoSizer>
                ) : (
                    <div className='dm-list-page__empty'>
                        <i className='icon icon-magnify'/>
                        <h2>
                            <FormattedMessage
                                id='guilded_layout.dm_list.no_results'
                                defaultMessage='No direct messages found'
                            />
                        </h2>
                        <p>
                            <FormattedMessage
                                id='guilded_layout.dm_list.no_results_detail'
                                defaultMessage="Try searching for someone's name or username."
                            />
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DMListPage;
