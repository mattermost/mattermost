// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import TeamStore from 'stores/team_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import InviteMembersView from 'components/invite_members/invite_members_view.jsx';
import Constants from 'utils/constants.jsx';
import Client from 'client/web_client.jsx';
import ChannelSelect from 'components/channel_select.jsx';

export default class InviteSingleChannelGuestsContainer extends React.Component {
    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            teamName: TeamStore.getCurrent().display_name,
            sendInvitesState: 'ready',
            channelId: null
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

    sendInvites(channels, emails) {
        this.setState({sendInvitesState: 'sending'});

        const data = {
            channels,
            emails
        };

        Client.inviteGuests(
            data,
            () => {
                this.setState({sendInvitesState: 'done', serverError: ''});
            },
            (err) => {
                this.setState({sendInvitesState: 'ready', serverError: err.message});
            }
        );
    }

    handleSubmit(emails) {
        this.sendInvites([this.state.channelId], emails);
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
                                id='invite_members.single_channel_guest'
                                defaultMessage='Single Channel Guests'
                            />
                        </strong>
                    </h1>
                )}
                extraFields={(
                    <div className='invite-header__info'>
                        <p>
                            <FormattedHTMLMessage
                                id='invite_members.message'
                                defaultMessage='New single-channel guests will only have access to this channel:'
                                values={{
                                    channel: defaultChannelName
                                }}
                            />
                        </p>
                        <ChannelSelect
                            id='channelId'
                            value={this.state.channelId}
                            onChange={(e) => {
                                this.setState({
                                    channelId: e.target.value
                                });
                            }}
                            selectOpen={true}
                            selectPrivate={true}
                        />
                        <hr/>
                    </div>
                )}
            />
        );
    }
}
