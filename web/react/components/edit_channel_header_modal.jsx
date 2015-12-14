// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Utils from '../utils/utils.jsx';

const Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    editError: {
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'This channel header is too long, please enter a shorter one'
    },
    title: {
        id: 'edit_channel_header_modal.title',
        defaultMessage: 'Edit Header for '
    },
    description: {
        id: 'edit_channel_header_modal.description',
        defaultMessage: 'Edit the text appearing next to the channel name in the channel header.'
    },
    cancel: {
        id: 'edit_channel_header_modal.cancel',
        defaultMessage: 'Cancel'
    },
    save: {
        id: 'edit_channel_header_modal.save',
        defaultMessage: 'Save'
    }
});

class EditChannelHeaderModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleEdit = this.handleEdit.bind(this);

        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {
            serverError: ''
        };
    }

    componentDidMount() {
        if (this.props.show) {
            this.onShow();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
    }

    handleEdit() {
        const {formatMessage} = this.props.intl;

        var data = {};
        data.channel_id = this.props.channel.id;

        if (data.channel_id.length !== 26) {
            return;
        }

        data.channel_header = ReactDOM.findDOMNode(this.refs.textarea).value;

        Client.updateChannelHeader(data,
            () => {
                this.setState({serverError: ''});
                AsyncClient.getChannel(this.props.channel.id);
                this.onHide();
            },
            (err) => {
                if (err.message === 'Invalid channel_header parameter') {
                    this.setState({serverError: formatMessage(messages.editError)});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    onShow() {
        const textarea = ReactDOM.findDOMNode(this.refs.textarea);
        Utils.placeCaretAtEnd(textarea);
    }

    onHide() {
        this.setState({
            serverError: ''
        });

        this.props.onHide();
    }

    render() {
        const {formatMessage} = this.props.intl;

        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><br/><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{formatMessage(messages.title) + this.props.channel.display_name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{formatMessage(messages.description)}</p>
                    <textarea
                        ref='textarea'
                        className='form-control no-resize'
                        rows='6'
                        id='edit_header'
                        maxLength='1024'
                        defaultValue={this.props.channel.header}
                    />
                    {serverError}
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
                        className='btn btn-primary'
                        onClick={this.handleEdit}
                    >
                        {formatMessage(messages.save)}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelHeaderModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(EditChannelHeaderModal);
