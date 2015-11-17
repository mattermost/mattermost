// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AsyncClient = require('../utils/async_client.jsx');
const Client = require('../utils/client.jsx');
const Modal = require('./modal.jsx');
const TeamStore = require('../stores/team_store.jsx');
const Utils = require('../utils/utils.jsx');

export default class DeleteChannelModal extends React.Component {
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
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/town-square';
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleDelete');
            }
        );
    }

    render() {
        const channelTerm = Utils.getChannelTerm(this.props.channel.type).toLowerCase();

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>{'Confirm DELETE Channel'}</Modal.Header>
                <Modal.Body>
                    {`Are you sure you wish to delete the ${this.props.channel.display_name} ${channelTerm}?`}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.handleDelete}
                    >
                        {'Delete'}
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
