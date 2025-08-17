// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {ProfilesInChannelSortBy} from 'mattermost-redux/actions/users';

import AlertBanner from 'components/alert_banner';
import ChannelInviteModal from 'components/channel_invite_modal';
import useAccessControlAttributes, {EntityType} from 'components/common/hooks/useAccessControlAttributes';
import ExternalLink from 'components/external_link';
import MoreDirectChannels from 'components/more_direct_channels';
import AlertTag from 'components/widgets/tag/alert_tag';
import TagGroup from 'components/widgets/tag/tag_group';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

import ActionBar from './action_bar';
import Header from './header';
import MemberList, {ListItemType} from './member_list';
import type {ChannelMember, ListItem} from './member_list';
import SearchBar from './search';

import './channel_members_rhs.scss';

const USERS_PER_PAGE = 100;

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

    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        openDirectChannelToUserId: (userId: string) => Promise<{data: Channel}>;
        closeRightHandSide: () => void;
        goBack: () => void;
        setChannelMembersRhsSearchTerm: (terms: string) => void;
        loadProfilesAndReloadChannelMembers: (page: number, perParge: number, channelId: string, sort: string) => void;
        loadMyChannelMemberAndRole: (channelId: string) => void;
        setEditChannelMembers: (active: boolean) => void;
        searchProfilesAndChannelMembers: (term: string, options: any) => Promise<{data: UserProfile[]}>;
    };
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
    actions,
}: Props) {
    const history = useHistory();

    const [list, setList] = useState<ListItem[]>([]);

    const [page, setPage] = useState(0);
    const [isNextPageLoading, setIsNextPageLoading] = useState(false);
    const {formatMessage} = useIntl();

    const {structuredAttributes, loading} = useAccessControlAttributes(
        EntityType.Channel,
        channel.id,
        channel.policy_enforced,
    );

    // Helper function to format attribute names for tooltips
    const formatAttributeName = (name: string): string => {
        // Convert snake_case or camelCase to Title Case with spaces
        return name.
            replace(/_/g, ' ').
            replace(/([A-Z])/g, ' $1').
            replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    };

    const searching = searchTerms !== '';

    const isDefaultChannel = channel.name === Constants.DEFAULT_CHANNEL;

    // show search if there's more than 20 or if the user have an active search.
    const showSearch = searching || membersCount >= 20;

    useEffect(() => {
        return () => {
            actions.setChannelMembersRhsSearchTerm('');
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
                    data: <div className='channel-members-rhs__member-list-separator channel-members-rhs__member-list-separator--first'>{text}</div>,
                });
            } else if (!memberDone && member.membership?.scheme_admin === false) {
                listcp.push({
                    type: ListItemType.Separator,
                    data: <div className='channel-members-rhs__member-list-separator'>
                        <FormattedMessage
                            id='channel_members_rhs.list.channel_members_title'
                            defaultMessage='MEMBERS'
                        />
                    </div>,
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
            let rhsAction = actions.closeRightHandSide;
            if (canGoBack) {
                rhsAction = actions.goBack;
            }
            rhsAction();
            return;
        }

        setPage(0);
        setIsNextPageLoading(false);
        actions.setChannelMembersRhsSearchTerm('');
        actions.loadProfilesAndReloadChannelMembers(0, USERS_PER_PAGE, channel.id, ProfilesInChannelSortBy.Admin);
        actions.loadMyChannelMemberAndRole(channel.id);
    }, [channel.id, channel.type]);

    const setSearchTerms = async (terms: string) => {
        actions.setChannelMembersRhsSearchTerm(terms);
    };

    const doSearch = useCallback(debounce(async (terms: string) => {
        await actions.searchProfilesAndChannelMembers(terms, {in_team_id: channel.team_id, in_channel_id: channel.id});
    }, Constants.SEARCH_TIMEOUT_MILLISECONDS), [actions.searchProfilesAndChannelMembers]);

    useEffect(() => {
        if (searchTerms) {
            doSearch(searchTerms);
        }
    }, [searchTerms]);

    const inviteMembers = () => {
        if (channel.type === Constants.GM_CHANNEL) {
            return actions.openModal({
                modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                dialogType: MoreDirectChannels,
                dialogProps: {isExistingChannel: true, focusOriginElement: 'channelInfoRHSAddPeopleButton'},
            });
        }

        return actions.openModal({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        });
    };

    const openDirectMessage = useCallback(async (user: UserProfile) => {
        // we first prepare the DM channel...
        await actions.openDirectChannelToUserId(user.id);

        // ... and then redirect to it
        history.push(teamUrl + '/messages/@' + user.username);

        await actions.closeRightHandSide();
    }, [actions.openDirectChannelToUserId, history, teamUrl, actions.closeRightHandSide]);

    const loadMore = useCallback(async () => {
        setIsNextPageLoading(true);

        await actions.loadProfilesAndReloadChannelMembers(page + 1, USERS_PER_PAGE, channel.id, ProfilesInChannelSortBy.Admin);
        setPage(page + 1);

        setIsNextPageLoading(false);
    }, [actions.loadProfilesAndReloadChannelMembers, page, channel.id],
    );

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body channel-members-rhs'
        >

            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                goBack={actions.goBack}
            />
            {/* Show banner for policy-enforced channels */}
            {channel.policy_enforced && (
                <div className='channel-members-rhs__alert-container policy-enforced'>
                    <AlertBanner
                        mode='info'
                        variant='app'
                        title={formatMessage({
                            id: 'channel_members_rhs.policy_enforced_restrictions',
                            defaultMessage: 'Channel access is restricted by user attributes',
                        })}
                    >
                        {structuredAttributes.length > 0 && (
                            <TagGroup>
                                {structuredAttributes.flatMap((attribute) =>
                                    attribute.values.map((value) => (
                                        <AlertTag
                                            key={`${attribute.name}-${value}`}
                                            tooltipTitle={formatAttributeName(attribute.name)}
                                            text={value}
                                        />
                                    )),
                                )}
                            </TagGroup>
                        )}
                        {loading && <span className='loading-indicator'>{'Loading...'}</span>}
                    </AlertBanner>
                </div>
            )}

            <ActionBar
                channelType={channel.type}
                membersCount={membersCount}
                canManageMembers={canManageMembers}
                editing={editing}
                actions={{
                    startEditing: () => actions.setEditChannelMembers(true),
                    stopEditing: () => actions.setEditChannelMembers(false),
                    inviteMembers,
                }}
            />

            {/* Users with user management permissions have special restrictions in the default channel */}
            {(editing && isDefaultChannel && !currentUserIsChannelAdmin) && (
                <div className='channel-members-rhs__alert-container'>
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
                </div>
            )}

            {showSearch && (
                <SearchBar
                    terms={searchTerms}
                    onInput={setSearchTerms}
                />
            )}

            <div className='channel-members-rhs__members-container'>
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
            </div>
        </div>
    );
}
