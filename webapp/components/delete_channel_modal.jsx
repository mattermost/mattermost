// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import {Modal} from 'react-bootstrap';
import TeamStore from 'stores/team_store.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import {browserHistory} from 'react-router/es6';

import React from 'react';

import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';

export default class DeleteChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {show: true};
    }

    handleDelete() {
        if (this.props.channel.id.length !== 26) {
            return;
        }

        browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/town-square');
        Client.deleteChannel(
            this.props.channel.id,
            () => {
                loadChannelsForCurrentUser();
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleDelete');
            }
        );
    }

    onHide() {
        this.setState({show: false});
    }

    render() {
        let channelTerm = (
            <FormattedMessage
                id='delete_channel.channel'
                defaultMessage='channel'
            />
        );
        if (this.props.channel.type === Constants.PRIVATE_CHANNEL) {
            channelTerm = (
                <FormattedMessage
                    id='delete_channel.group'
                    defaultMessage='group'
                />
            );
        }

        return (
            <Modal
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>
                        <FormattedMessage
                            id='delete_channel.confirm'
                            defaultMessage='Confirm DELETE Channel'
                        />
                    </h4>
                </Modal.Header>
                <Modal.Body>
                    <div className='alert alert-danger'>
                        <FormattedMessage
                            id='delete_channel.question'
                            defaultMessage='This will delete the channel from the team and make its contents inaccessible for all users. Are you sure you wish to delete the {display_name} {term}?'
                            values={{
                                display_name: this.props.channel.display_name,
                                term: (channelTerm)
                            }}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='delete_channel.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                    >
                        <FormattedMessage
                            id='delete_channel.del'
                            defaultMessage='Delete'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

DeleteChannelModal.propTypes = {
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
