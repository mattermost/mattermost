// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
const Modal = ReactBootstrap.Modal;
import TeamStore from '../stores/team_store.jsx';
import * as Utils from '../utils/utils.jsx';

const messages = defineMessages({
    channel: {
        id: 'delete_channel.channel',
        defaultMessage: 'channel'
    },
    private: {
        id: 'delete_channel.private',
        defaultMessage: 'private group'
    },
    close: {
        id: 'delete_channel.close',
        defaultMessage: 'Close'
    },
    confirm: {
        id: 'delete_channel.confirm',
        defaultMessage: 'Confirm DELETE Channel'
    },
    question: {
        id: 'delete_channel.question',
        defaultMessage: 'Are you sure you wish to delete the '
    },
    cancel: {
        id: 'delete_channel.cancel',
        defaultMessage: 'Cancel'
    },
    del: {
        id: 'delete_channel.del',
        defaultMessage: 'Delete'
    },
    pg: {
        id: 'delete_channel.pg',
        defaultMessage: 'private group'
    }
});

class DeleteChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete() {
        if (this.props.channel.id.length !== 26) {
            return;
        }

        Client.deleteChannel(
            this.props.channel.id,
            () => {
                AsyncClient.getChannels(true);
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/general';
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleDelete');
            }
        );
    }

    render() {
        const {formatMessage, locale} = this.props.intl;
        const channelTerm = Utils.getChannelTerm(this.props.channel.type, locale).toLowerCase();

        let question = `${formatMessage(messages.question)} ${this.props.channel.display_name} ${channelTerm}?`;
        if (locale === 'es') {
            question = `${formatMessage(messages.question)} ${channelTerm} ${this.props.channel.display_name}?`;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>{formatMessage(messages.confirm)}</h4>
                </Modal.Header>
                <Modal.Body>
                    {question}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        {formatMessage(messages.cancel)}
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                    >
                        {formatMessage(messages.del)}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

DeleteChannelModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(DeleteChannelModal);