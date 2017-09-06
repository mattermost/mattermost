// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberListChannel from 'components/member_list_channel';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {canManageMembers} from 'utils/channel_utils.jsx';
import {Constants} from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

export default class ChannelMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.onHide = this.onHide.bind(this);

        this.state = {
            channel: this.props.channel,
            show: true
        };
    }

    onHide() {
        this.setState({show: false});
    }

    render() {
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
        const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
        const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();

        let addMembersButton = null;
        if (canManageMembers(this.state.channel, isChannelAdmin, isTeamAdmin, isSystemAdmin) && this.state.channel.name !== Constants.DEFAULT_CHANNEL) {
            addMembersButton = (
                <a
                    id='showInviteModal'
                    className='btn btn-md btn-primary'
                    href='#'
                    onClick={() => {
                        this.props.showInviteModal();
                        this.onHide();
                    }}
                >
                    <FormattedMessage
                        id='channel_members_modal.addNew'
                        defaultMessage=' Add New Members'
                    />
                </a>
            );
        }

        return (
            <div>
                <Modal
                    dialogClassName='more-modal more-modal--action'
                    show={this.state.show}
                    onHide={this.onHide}
                    onExited={this.props.onModalDismissed}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <span className='name'>{this.props.channel.display_name}</span>
                            <FormattedMessage
                                id='channel_members_modal.members'
                                defaultMessage=' Members'
                            />
                        </Modal.Title>
                        {addMembersButton}
                    </Modal.Header>
                    <Modal.Body
                        ref='modalBody'
                    >
                        <MemberListChannel
                            channel={this.props.channel}
                        />
                    </Modal.Body>
                </Modal>
            </div>
        );
    }
}

ChannelMembersModal.propTypes = {
    onModalDismissed: PropTypes.func.isRequired,
    showInviteModal: PropTypes.func.isRequired,
    channel: PropTypes.object.isRequired
};
