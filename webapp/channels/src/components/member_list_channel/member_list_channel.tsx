// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ChannelMembersDropdown from 'components/channel_members_dropdown';
import LoadingScreen from 'components/loading_screen';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import Constants from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

const USERS_PER_PAGE = 50;

export type Props = {
    currentTeamId: string;
    currentChannelId: string;
    searchTerm: string;
    usersToDisplay: UserProfile[];
    actionUserProps: {
        [userId: string]: {
            channel: Channel;
            teamMember: any;
            channelMember: ChannelMembership;
        };
    };
    totalChannelMembers: number;
    channel: Channel;
    actions: {
        searchProfiles: (term: string, options?: Record<string, unknown>) => Promise<ActionResult<UserProfile[]>>;
        getChannelMembers: (channelId: string) => Promise<ActionResult<ChannelMembership[]>>;
        getChannelStats: (channelId: string) => Promise<ActionResult<ChannelStats>>;
        setModalSearchTerm: (term: string) => void;
        loadProfilesAndTeamMembersAndChannelMembers: (
            page: number,
            perPage: number,
            teamId: string,
            channelId: string,
            options?: any
        ) => Promise<ActionResult>;
        loadStatusesForProfilesList: (users: UserProfile[]) => void;
        loadTeamMembersAndChannelMembersForProfilesList: (
            profiles: UserProfile[],
            teamId: string,
            channelId: string
        ) => Promise<ActionResult>;
    };
}

type State = {
    loading: boolean;
}

export default class MemberListChannel extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
        };
    }

    async componentDidMount() {
        const {
            actions,
            currentChannelId,
            currentTeamId,
        } = this.props;

        await Promise.all([
            actions.loadProfilesAndTeamMembersAndChannelMembers(0, Constants.PROFILE_CHUNK_SIZE, currentTeamId, currentChannelId, {active: true}),
            actions.getChannelMembers(currentChannelId),
            actions.getChannelStats(currentChannelId),
        ]);
        this.loadComplete();
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);
            const searchTerm = this.props.searchTerm;

            if (searchTerm === '') {
                this.loadComplete();
                this.searchTimeoutId = 0;
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    const {data} = await prevProps.actions.searchProfiles(searchTerm, {team_id: this.props.currentTeamId, in_channel_id: this.props.currentChannelId});

                    if (searchTimeoutId !== this.searchTimeoutId) {
                        return;
                    }

                    this.props.actions.loadStatusesForProfilesList(data!);
                    this.props.actions.loadTeamMembersAndChannelMembersForProfilesList(data!, this.props.currentTeamId, this.props.currentChannelId).then(({data: membersLoaded}) => {
                        if (membersLoaded) {
                            this.loadComplete();
                        }
                    });
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );

            this.searchTimeoutId = searchTimeoutId;
        }
    }

    loadComplete = () => {
        this.setState({loading: false});
    };

    nextPage = (page: number) => {
        this.props.actions.loadProfilesAndTeamMembersAndChannelMembers(page + 1, USERS_PER_PAGE, '', '', {active: true});
    };

    handleSearch = (term: string) => {
        this.props.actions.setModalSearchTerm(term);
    };

    render() {
        if (this.state.loading) {
            return (<LoadingScreen/>);
        }
        const channelIsArchived = this.props.channel.delete_at !== 0;
        return (
            <SearchableUserList
                users={this.props.usersToDisplay}
                usersPerPage={USERS_PER_PAGE}
                total={this.props.totalChannelMembers}
                nextPage={this.nextPage}
                search={this.handleSearch}
                actions={channelIsArchived ? [] : [ChannelMembersDropdown]}
                actionUserProps={this.props.actionUserProps}
                focusOnMount={!UserAgent.isMobile()}
            />
        );
    }
}
