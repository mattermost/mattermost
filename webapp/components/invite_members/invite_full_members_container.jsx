// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import TeamStore from 'stores/team_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import InviteMembersView from 'components/invite_members/invite_members_view.jsx';
import Constants from 'utils/constants.jsx';
import Client from 'client/web_client.jsx';

export default class InviteFullMembersContainer extends React.Component {
    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            teamName: TeamStore.getCurrent().display_name,
            sendInvitesState: 'ready',
            serverError: ''
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        this.setState({
            teamName: TeamStore.getCurrent().display_name
        });
    }

    handleSubmit(emails) {
        this.setState({sendInvitesState: 'sending'});

        const invites = [];
        for (let i = 0; i < emails.length; i++) {
            const invite = {
                email: emails[i]
            };
            invites.push(invite);
        }

        const data = {};
        data.invites = invites;
        Client.inviteMembers(
            data,
            () => {
                this.setState({sendInvitesState: 'done', serverError: ''});
            },
            (err) => {
                this.setState({sendInvitesState: 'ready', serverError: err.message});
            }
        );
    }

    render() {
        let defaultChannelName = '';
        if (ChannelStore.getByName(Constants.DEFAULT_CHANNEL)) {
            defaultChannelName = ChannelStore.getByName(Constants.DEFAULT_CHANNEL).display_name;
        }

        return (
            <InviteMembersView
                teamDisplayName={this.state.teamName}
                handleSubmit={this.handleSubmit}
                sendInvitesState={this.state.sendInvitesState}
                closeLink={ChannelStore.getLastViewedChannelURL()}
                serverError={this.state.serverError}
                titleText={(
                    <h1>
                        <FormattedMessage
                            id='invite_members.invite'
                            defaultMessage='Invite '
                        />
                        <strong>
                            <FormattedMessage
                                id='invite_members.full_members'
                                defaultMessage='Full Members'
                            />
                        </strong>
                    </h1>
                )}
                extraFields={(
                    <div className='invite-header__info'>
                        <span>
                            <FormattedHTMLMessage
                                id='invite_members.autoJoin'
                                defaultMessage='People invited automatically join the <strong>{channel}</strong> channel.'
                                values={{
                                    channel: defaultChannelName
                                }}
                            />
                        </span>
                    </div>
                )}
            />
        );
    }
}
