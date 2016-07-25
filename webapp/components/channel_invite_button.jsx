// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {FormattedMessage} from 'react-intl';
import SpinnerButton from 'components/spinner_button.jsx';

export default class ChannelInviteButton extends React.Component {
    static get propTypes() {
        return {
            user: React.PropTypes.object.isRequired,
            channel: React.PropTypes.object.isRequired,
            onInviteError: React.PropTypes.func.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);

        this.state = {
            addingUser: false
        };
    }

    handleClick() {
        if (this.state.addingUser) {
            return;
        }

        this.setState({
            addingUser: true
        });

        Client.addChannelMember(
            this.props.channel.id,
            this.props.user.id,
            () => {
                this.setState({
                    addingUser: false
                });

                this.props.onInviteError(null);
                AsyncClient.getChannelExtraInfo();
            },
            (err) => {
                this.setState({
                    addingUser: false
                });

                this.props.onInviteError(err);
            }
        );
    }

    render() {
        return (
            <SpinnerButton
                className='btn btn-sm btn-primary'
                onClick={this.handleClick}
                spinning={this.state.addingUser}
            >
                <i className='fa fa-envelope fa-margin--right'/>
                <FormattedMessage
                    id='channel_invite.add'
                    defaultMessage=' Add'
                />
            </SpinnerButton>
        );
    }
}
