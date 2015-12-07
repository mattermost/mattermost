// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
const Modal = ReactBootstrap.Modal;
import TeamStore from '../stores/team_store.jsx';
import * as Utils from '../utils/utils.jsx';

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
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>{'Confirm DELETE Channel'}</h4>
                </Modal.Header>
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
