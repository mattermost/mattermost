// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';

const Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    editError: {
        id: 'edit_channel_purpose_modal.editError',
        defaultMessage: 'This channel purpose is too long, please enter a shorter one'
    },
    title1: {
        id: 'edit_channel_purpose_modal.title1',
        defaultMessage: 'Edit Purpose'
    },
    title2: {
        id: 'edit_channel_purpose_modal.title2',
        defaultMessage: 'Edit Purpose for '
    },
    body1: {
        id: 'edit_channel_purpose_modal.body1',
        defaultMessage: 'Describe how this'
    },
    body2: {
        id: 'edit_channel_purpose_modal.body2',
        defaultMessage: 'should be used. This text appears in the channel list in the "More..." menu and helps others decide whether to join.'
    },
    cancel: {
        id: 'edit_channel_purpose_modal.cancel',
        defaultMessage: 'Cancel'
    },
    save: {
        id: 'edit_channel_purpose_modal.save',
        defaultMessage: 'Save'
    }
});

class EditChannelPurposeModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleSave = this.handleSave.bind(this);

        this.state = {serverError: ''};
    }

    componentDidUpdate() {
        if (this.props.show) {
            $(ReactDOM.findDOMNode(this.refs.purpose)).focus();
        }
    }

    handleHide() {
        this.setState({serverError: ''});

        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    }

    handleSave() {
        const {formatMessage} = this.props.intl;

        if (!this.props.channel) {
            return;
        }

        const data = {
            channel_id: this.props.channel.id,
            channel_purpose: ReactDOM.findDOMNode(this.refs.purpose).value.trim()
        };

        Client.updateChannelPurpose(data,
            () => {
                AsyncClient.getChannel(this.props.channel.id);

                this.handleHide();
            },
            (err) => {
                if (err.message === 'Invalid channel_purpose parameter') {
                    this.setState({serverError: formatMessage(messages.editError)});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    render() {
        const {formatMessage, locale} = this.props.intl;
        if (!this.props.show) {
            return null;
        }

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <br/>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        let title = <span>{formatMessage(messages.title1)}</span>;
        if (this.props.channel.display_name) {
            title = <span>{formatMessage(messages.title2)}<span className='name'>{this.props.channel.display_name}</span></span>;
        }

        return (
            <Modal
                className='modal-edit-channel-purpose'
                ref='modal'
                show={this.props.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        {title}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{`${formatMessage(messages.body1)} ${Utils.getChannelTerm(this.props.channel.channelType, locale)} ${formatMessage(messages.body2)}`}</p>
                    <textarea
                        ref='purpose'
                        className='form-control no-resize'
                        rows='6'
                        maxLength='128'
                        defaultValue={this.props.channel.purpose}
                    />
                    {serverError}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        {formatMessage(messages.cancel)}
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSave}
                    >
                        {formatMessage(messages.save)}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelPurposeModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    channel: React.PropTypes.object,
    onModalDismissed: React.PropTypes.func.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(EditChannelPurposeModal);