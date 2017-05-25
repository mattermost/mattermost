// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SpinnerButton from 'components/spinner_button.jsx';

import {addUserToChannel} from 'actions/channel_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class ChannelInviteButton extends React.Component {
    static get propTypes() {
        return {
            user: PropTypes.object.isRequired,
            channel: PropTypes.object.isRequired,
            onInviteError: PropTypes.func.isRequired
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

        addUserToChannel(
            this.props.channel.id,
            this.props.user.id,
            () => {
                this.props.onInviteError(null);
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
                id='addMembers'
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
