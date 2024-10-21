// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {loadMyChannelMemberAndRole} from 'mattermost-redux/actions/channels';
import {ProfilesInChannelSortBy} from 'mattermost-redux/actions/users';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {loadProfilesAndReloadChannelMembers, searchProfilesAndChannelMembers} from 'actions/user_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, goBack, setEditChannelMembers} from 'actions/views/rhs';
import {setChannelMembersRhsSearchTerm} from 'actions/views/search';

import AlertBanner from 'components/alert_banner';
import ChannelInviteModal from 'components/channel_invite_modal';
import ExternalLink from 'components/external_link';
import MoreDirectChannels from 'components/more_direct_channels';

import Constants, {ModalIdentifiers} from 'utils/constants';

import ActionBar from './action_bar';
import Header from './header';
import MemberList from './member_list';
import SearchBar from './search';

const USERS_PER_PAGE = 100;
export interface ChannelMember {
    user: UserProfile;
    membership?: ChannelMembership;
    status?: string;
    displayName: string;
}

const MembersContainer = styled.div`
    flex: 1 1 auto;
    padding: 0 4px 16px;
`;

export interface Props {
    channel: Channel;
    currentUserIsChannelAdmin: boolean;
    membersCount: number;
    searchTerms: string;
    canGoBack: boolean;
    teamUrl: string;
    channelMembers: ChannelMember[];
    canManageMembers: boolean;
    editing: boolean;
}

export enum ListItemType {
    Member = 'member',
    FirstSeparator = 'first-separator',
    Separator = 'separator',
}

export interface ListItem {
    type: ListItemType;
    data: ChannelMember | JSX.Element;
}

export default function ChannelMembersRHS({
    channel,
    currentUserIsChannelAdmin,
    searchTerms,
    membersCount,
    canGoBack,
    teamUrl,
    channelMembers,
    canManageMembers,
    editing = false,
}: Props) {
    const history = useHistory();

    const [list, setList] = useState<ListItem[]>([]);

    const [page, setPage] = useState(0);
    const [isNextPageLoading, setIsNextPageLoading] = useState(false);
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const searching = searchTerms !== '';

    const isDefaultChannel = channel.name === Constants.DEFAULT_CHANNEL;

    // show search if there's more than 20 or if the user have an active search.
    const showSearch = searching || membersCount >= 20;

    useEffect(() => {
        return () => {
            dispatch(setChannelMembersRhsSearchTerm(''));
        };
    }, []);

    useEffect(() => {
        const listcp: ListItem[] = [];
        let memberDone = false;

        for (let i = 0; i < channelMembers.length; i++) {
            const member = channelMembers[i];
            if (listcp.length === 0) {
                let text = null;
                if (member.membership?.scheme_admin === true) {
                    text = (
                        <FormattedMessage
                            id='channel_members_rhs.list.channel_admin_title'
                            defaultMessage='CHANNEL ADMINS'
                        />
                    );
                } else {
                    text = (
                        <FormattedMessage
                            id='channel_members_rhs.list.channel_members_title'
                            defaultMessage='MEMBERS'
                        />
                    );
                    memberDone = true;
                }

                listcp.push({
                    type: ListItemType.FirstSeparator,
                    data: <FirstMemberListSeparator>{text}</FirstMemberListSeparator>,
                });
            } else if (!memberDone && member.membership?.scheme_admin === false) {
                listcp.push({
                    type: ListItemType.Separator,
                    data: <MemberListSeparator>
                        <FormattedMessage
                            id='channel_members_rhs.list.channel_members_title'
                            defaultMessage='MEMBERS'
                        />
                    </MemberListSeparator>,
                });
                memberDone = true;
            }

            listcp.push({type: ListItemType.Member, data: member});
        }
        if (JSON.stringify(list) !== JSON.stringify(listcp)) {
            setList(listcp);
        }
    }, [channelMembers]);

    useEffect(() => {
        if (channel.type === Constants.DM_CHANNEL) {
            let rhsAction: any = closeRightHandSide;
            if (canGoBack) {
                rhsAction = goBack;
            }
            dispatch(rhsAction());
            return;
        }

        setPage(0);
        setIsNextPageLoading(false);
        dispatch(setChannelMembersRhsSearchTerm(''));
        dispatch(loadProfilesAndReloadChannelMembers(0, USERS_PER_PAGE, channel.id, ProfilesInChannelSortBy.Admin));
        dispatch(loadMyChannelMemberAndRole(channel.id));
    }, [channel.id, channel.type]);

    const setSearchTerms = useCallback(async (terms: string) => {
        dispatch(setChannelMembersRhsSearchTerm(terms));
    }, [dispatch]);

    const doSearch = useCallback(debounce(async (terms: string) => {
        await dispatch(searchProfilesAndChannelMembers(terms, {in_team_id: channel.team_id, in_channel_id: channel.id}));
    }, Constants.SEARCH_TIMEOUT_MILLISECONDS), [dispatch, channel.team_id, channel.id]);

    useEffect(() => {
        if (searchTerms) {
            doSearch(searchTerms);
        }
    }, [searchTerms]);

    const inviteMembers = useCallback(() => {
        if (channel.type === Constants.GM_CHANNEL) {
            return dispatch(openModal({
                modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                dialogType: MoreDirectChannels,
                dialogProps: {isExistingChannel: true},
            }));
        }

        return dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        }));
    }, [channel, dispatch]);

    const openDirectMessage = useCallback(async (user: UserProfile) => {
        // we first prepare the DM channel...
        await dispatch(openDirectChannelToUserId(user.id));

        // ... and then redirect to it
        history.push(teamUrl + '/messages/@' + user.username);

        await dispatch(closeRightHandSide());
    }, [dispatch, history, teamUrl]);

    const loadMore = useCallback(async () => {
        setIsNextPageLoading(true);

        await dispatch(loadProfilesAndReloadChannelMembers(page + 1, USERS_PER_PAGE, channel.id, ProfilesInChannelSortBy.Admin));
        setPage(page + 1);

        setIsNextPageLoading(false);
    }, [dispatch, page, channel.id]);

    const headerOnClose = useCallback(() => dispatch(closeRightHandSide), [dispatch]);
    const headerGoBack = useCallback(() => dispatch(goBack), [dispatch]);
    const actionBarStartEditing = useCallback(() => dispatch(setEditChannelMembers(true)), [dispatch]);
    const actionBarStopEditing = useCallback(() => dispatch(setEditChannelMembers(false)), [dispatch]);

    const actionBarActions = useMemo(() => ({
        startEditing: actionBarStartEditing,
        stopEditing: actionBarStopEditing,
        inviteMembers,
    }), [actionBarStartEditing, actionBarStopEditing, inviteMembers]);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >

            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={headerOnClose}
                goBack={headerGoBack}
            />

            <ActionBar
                channelType={channel.type}
                membersCount={membersCount}
                canManageMembers={canManageMembers}
                editing={editing}
                actions={actionBarActions}
            />

            {/* Users with user management permissions have special restrictions in the default channel */}
            {(editing && isDefaultChannel && !currentUserIsChannelAdmin) && (
                <AlertContainer>
                    <AlertBanner
                        mode='info'
                        variant='app'
                        message={formatMessage({
                            id: 'channel_members_rhs.default_channel_moderation_restrictions',
                            defaultMessage: 'In this channel, you can only remove guests. Only <link>channel admins</link> can manage other members.',
                        }, {
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://docs.mattermost.com/welcome/about-user-roles.html#channel-admin'
                                    location='channel_members_rhs'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        })}
                    />
                </AlertContainer>
            )}

            {showSearch && (
                <SearchBar
                    terms={searchTerms}
                    onInput={setSearchTerms}
                />
            )}

            <MembersContainer>
                {channelMembers.length > 0 && (
                    <MemberList
                        searchTerms={searchTerms}
                        members={list}
                        editing={editing}
                        channel={channel}
                        openDirectMessage={openDirectMessage}
                        loadMore={loadMore}
                        hasNextPage={channelMembers.length < membersCount}
                        isNextPageLoading={isNextPageLoading}
                    />
                )}
            </MembersContainer>
        </div>
    );
}

const MemberListSeparator = styled.div`
    font-weight: 600;
    font-size: 12px;
    line-height: 28px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 0px 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    margin-top: 16px;
`;

const FirstMemberListSeparator = styled(MemberListSeparator)`
    margin-top: 0px;
`;

const AlertContainer = styled.div`
    padding: 0 20px 15px;
`;
