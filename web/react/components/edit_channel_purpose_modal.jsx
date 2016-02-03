// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const Modal = ReactBootstrap.Modal;

const holders = defineMessages({
    error: {
        id: 'edit_channel_purpose_modal.error',
        defaultMessage: 'This channel purpose is too long, please enter a shorter one'
    }
});

export default class EditChannelPurposeModal extends React.Component {
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
                if (err.id === 'api.context.invalid_param.app_error') {
                    this.setState({serverError: this.props.intl.formatMessage(holders.error)});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    render() {
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

        let title = (
            <span>
                <FormattedMessage
                    id='edit_channel_purpose_modal.title1'
                    defaultMessage='Edit Purpose'
                />
            </span>
        );
        if (this.props.channel.display_name) {
            title = (
                <span>
                    <FormattedMessage
                        id='edit_channel_purpose_modal.title2'
                        defaultMessage='Edit Purpose for '
                    />
                    <span className='name'>{this.props.channel.display_name}</span>
                </span>
            );
        }

        let channelType = (
            <FormattedMessage
                id='edit_channel_purpose_modal.channel'
                defaultMessage='Channel'
            />
        );
        if (this.props.channel.type === Constants.PRIVATE_CHANNEL) {
            channelType = (
                <FormattedMessage
                    id='edit_channel_purpose_modal.group'
                    defaultMessage='Group'
                />
            );
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
                    <p>
                        <FormattedMessage
                            id='edit_channel_purpose_modal.body'
                            defaultMessage='Describe how this {type} should be used. This text appears in the channel list in the "More..." menu and helps others decide whether to join.'
                            values={{
                                type: (channelType)
                            }}
                        />
                    </p>
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
                        <FormattedMessage
                            id='edit_channel_purpose_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSave}
                    >
                        <FormattedMessage
                            id='edit_channel_purpose_modal.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelPurposeModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    channel: React.PropTypes.object,
    onModalDismissed: React.PropTypes.func.isRequired
};

export default injectIntl(EditChannelPurposeModal);