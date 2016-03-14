// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
const Modal = ReactBootstrap.Modal;
import TeamStore from '../stores/team_store.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

import {browserHistory} from 'react-router';

export default class DeleteChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete() {
        if (this.props.channel.id.length !== 26) {
            return;
        }

        browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/town-square');
        Client.deleteChannel(
            this.props.channel.id,
            () => {
                AsyncClient.getChannels(true);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleDelete');
            }
        );
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
                show={this.props.show}
                onHide={this.props.onHide}
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
                    <FormattedMessage
                        id='delete_channel.question'
                        defaultMessage='Are you sure you wish to delete the {display_name} {term}?'
                        values={{
                            display_name: this.props.channel.display_name,
                            term: (channelTerm)
                        }}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
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
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
