// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannel} from 'actions/channel_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';
import React from 'react';
import {Modal} from 'react-bootstrap';

const holders = defineMessages({
    privateChannel: {
        id: 'convert_channel.private_channel',
        defaultMessage: 'private channel'
    }
});

export class ConvertChannelModal extends React.Component {
    constructor(props) {
        super(props);
        this.handleShow = this.handleShow.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);

        this.state = {
            serverError: ''
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.channel, this.props.channel)) {
            this.setState({
                displayName: nextProps.channel.display_name,
                channelName: nextProps.channel.name
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!nextProps.show && !this.props.show) {
            return false;
        }

        if (!Utils.areObjectsEqual(nextState, this.state)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps, this.props)) {
            return true;
        }

        return false;
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.show && this.props.show) {
            this.handleShow();
        }
    }

    handleShow() {
        const convertChannelBtn = ReactDOM.findDOMNode(this.refs.convertChannelBtn);
        convertChannelBtn.focus();
    }

    handleHide(e) {
        if (e) {
            e.preventDefault();
        }

        this.props.onHide();

        this.setState({
            serverError: ''
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        const channel = Object.assign({}, this.props.channel);
        const oldChannelType = channel.type;
        const state = {serverError: ''};

        channel.type = Constants.PRIVATE_CHANNEL;

        this.setState(state);

        if (oldChannelType !== Constants.OPEN_CHANNEL) {
            return;
        }

        trackEvent('api', 'api_channels_convert_private');

        updateChannel(channel,
            () => {
                this.handleHide();
            },
            (err) => {
                this.setState({
                    serverError: err.message
                });
            }
        );
    }

    handleCancel(e) {
        this.handleHide(e);
    }

    render() {
        const displayName = this.props.channel.display_name;
        const {formatMessage} = this.props.intl;

        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.handleCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='convert_channel.title'
                            defaultMessage='Convert {displayName} to a private channel?'
                            values={{
                                displayName: <strong>{displayName}</strong>
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>
                        <p>
                            <FormattedMessage
                                id='convert_channel.channel_private_description'
                                defaultMessage='When you convert {displayName} to a private channel:'
                                values={{
                                    displayName: <strong>{displayName}</strong>
                                }}
                            />
                        </p>
                        <ul>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_first'
                                    defaultMessage='History and membership are preserved'
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_second'
                                    defaultMessage='Files shared via a public link remain accessible to others'
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_third'
                                    defaultMessage='New members need be added before they can join the conversation'
                                />
                            </li>
                        </ul>
                        <p>
                            <FormattedMessage
                                id='convert_channel.convert_channel_permanent'
                                defaultMessage='The change is permanent and cannot be undone.'
                            />
                        </p>
                        <p>
                            <FormattedMessage
                                id='convert_channel.convert_channel_confirm_question'
                                defaultMessage='Are you sure you want to convert {displayName} to a {privateChannel}?'
                                values={{
                                    displayName: <strong>{displayName}</strong>,
                                    privateChannel: <strong>{formatMessage(holders.privateChannel)}</strong>
                                }}
                            />
                        </p>
                        {serverError}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleCancel}
                    >
                        <FormattedMessage
                            id='convert_channel.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        ref='convertChannelBtn'
                        onClick={this.handleSubmit}
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='convert_channel.accept'
                            defaultMessage='Yes, convert'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ConvertChannelModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};

export default injectIntl(ConvertChannelModal);
