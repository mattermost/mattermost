// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Modal} from 'react-bootstrap';
import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import {browserHistory} from 'react-router/es6';

import PropTypes from 'prop-types';

import React from 'react';

import {deleteChannel} from 'actions/channel_actions.jsx';
import Constants from 'utils/constants.jsx';

export default class DeleteChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {show: true};
    }

    handleDelete() {
        if (this.props.channel.id.length !== 26) {
            return;
        }

        browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/town-square');
        deleteChannel(this.props.channel.id);
        this.onHide();
    }

    onHide() {
        this.setState({show: false});
    }

    handleKeyDown(e) {
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.handleDelete();
        }
    }

    render() {
        return (
            <Modal
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
                onKeyDown={this.handleKeyDown}
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
                        <FormattedHTMLMessage
                            id='delete_channel.question'
                            defaultMessage='This will delete the channel from the team and make its contents inaccessible for all users. <br /><br />Are you sure you wish to delete the <strong>{display_name}</strong> channel?'
                            values={{
                                display_name: this.props.channel.display_name
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
    onHide: PropTypes.func.isRequired,
    channel: PropTypes.object.isRequired
};
