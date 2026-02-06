// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {useHistory} from 'react-router-dom';
import {FixedSizeList, ListChildComponentProps} from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getPosts} from 'mattermost-redux/actions/posts';

import {openModal} from 'actions/views/modals';
import {getAllDmChannelsWithUsers} from 'selectors/views/guilded_layout';
import MoreDirectChannels from 'components/more_direct_channels';
import {ModalIdentifiers} from 'utils/constants';

import EnhancedDmRow from 'components/enhanced_dm_row';
import EnhancedGroupDmRow from 'components/enhanced_group_dm_row';

import DmListHeader from './dm_list_header';
import DmSearchInput from './dm_search_input';

import './dm_list_page.scss';

const ROW_HEIGHT = 48;

const DMListPage = () => {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentChannelId = useSelector(getCurrentChannelId);
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const allDms = useSelector(getAllDmChannelsWithUsers);
    const hasFetchedPosts = useRef(false);
    const hasAutoSelected = useRef(false);

    const [searchTerm, setSearchTerm] = useState('');

    // Fetch latest post for each DM channel (once on mount)
    useEffect(() => {
        if (!hasFetchedPosts.current && allDms.length > 0) {
            hasFetchedPosts.current = true;
            allDms.forEach((dm) => {
                dispatch(getPosts(dm.channel.id, 0, 1));
            });
        }
    }, [dispatch, allDms]);

    // Auto-select the most recent DM on mount
    useEffect(() => {
        if (!hasAutoSelected.current && allDms.length > 0 && currentTeamUrl) {
            hasAutoSelected.current = true;
            const firstDm = allDms[0];
            if (firstDm.type === 'dm') {
                history.push(`${currentTeamUrl}/messages/@${firstDm.user.username}`);
            } else {
                history.push(`${currentTeamUrl}/messages/${firstDm.channel.name}`);
            }
        }
    }, [allDms, currentTeamUrl, history]);

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
            dialogProps: {},
        }));
    }, [dispatch]);

    const Row = useCallback(({index, style}: ListChildComponentProps) => {
        const item = filteredDms[index];
        if (!item) {
            return null;
        }

        if (item.type === 'dm') {
            return (
                <div style={style}>
                    <EnhancedDmRow
                        channel={item.channel}
                        user={item.user}
                        isActive={item.channel.id === currentChannelId}
                    />
                </div>
            );
        }

        return (
            <div style={style}>
                <EnhancedGroupDmRow
                    channel={item.channel}
                    users={item.users}
                    isActive={item.channel.id === currentChannelId}
                />
            </div>
        );
    }, [filteredDms, currentChannelId]);

    return (
        <div className='dm-list-page'>
            <DmListHeader
                onNewMessageClick={handleNewMessage}
            />
            <DmSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
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
                            >
                                {Row}
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