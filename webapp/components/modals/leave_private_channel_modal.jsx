// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from 'components/confirm_modal.jsx';

import * as ChannelActions from 'actions/channel_actions.jsx';

import ModalStore from 'stores/modal_store.jsx';
import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, FormattedMessage} from 'react-intl';

import React from 'react';

class LeavePrivateChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        this.state = {
            show: false,
            channel: null
        };
        this.mounted = false;
    }

    componentDidMount() {
        this.mounted = true;
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_LEAVE_PRIVATE_CHANNEL_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        this.mounted = false;
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_LEAVE_PRIVATE_CHANNEL_MODAL, this.handleToggle);
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && this.state.show) {
            this.handleSubmit();
        }
    }

    handleSubmit() {
        const channelId = this.state.channel.id;
        this.setState({
            show: false,
            channel: null
        });
        ChannelActions.leaveChannel(channelId);
    }

    handleToggle(value) {
        this.setState({
            channel: value,
            show: value !== null
        });
    }

    handleHide() {
        this.setState({
            show: false
        });
    }

    render() {
        let title = '';
        let message = '';
        if (this.state.channel) {
            title = (
                <FormattedMessage
                    id='leave_private_channel_modal.title'
                    defaultMessage='Leave Private Channel {channel}'
                    values={{
                        channel: <b>{this.state.channel.display_name}</b>
                    }}
                />
            );

            message = (
                <FormattedMessage
                    id='leave_private_channel_modal.message'
                    defaultMessage='Are you sure you wish to leave the private channel {channel}? You must be re-invited in order to re-join this channel in the future.'
                    values={{
                        channel: <b>{this.state.channel.display_name}</b>
                    }}
                />
            );
        }

        const buttonClass = 'btn btn-danger';
        const button = (
            <FormattedMessage
                id='leave_private_channel_modal.leave'
                defaultMessage='Yes, leave channel'
            />
        );

        return (
            <ConfirmModal
                show={this.state.show}
                title={title}
                message={message}
                confirmButtonClass={buttonClass}
                confirmButtonText={button}
                onConfirm={this.handleSubmit}
                onCancel={this.handleHide}
            />
        );
    }
}

LeavePrivateChannelModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(LeavePrivateChannelModal);
