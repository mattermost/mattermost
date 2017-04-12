// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannel} from 'actions/channel_actions.jsx';
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

        this.handleHide = this.handleHide.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);

        this.state = {
            serverError: ''
        };
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
                dialogClassName={'modal-xl'}
                show={this.props.show}
                onHide={this.handleCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='convert_channel.title'
                            defaultMessage='Convert Public Channel to Private Channel'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div
                        className={'modal-padding'}
                    >
                        <h4>
                            <FormattedMessage
                                id='convert_channel.convert_channel_question'
                                defaultMessage='Convert {displayName} to a private channel?'
                                values={{
                                    displayName: <strong>{displayName}</strong>
                                }}
                            />
                        </h4>
                        <br/>
                        <p>
                            <FormattedMessage
                                id='convert_channel.channel_public_description'
                                defaultMessage='{displayName} is currently a public channel.'
                                values={{
                                    displayName: <strong>{displayName}</strong>
                                }}
                            />
                        </p>
                        <br/>
                        <p>
                            <FormattedMessage
                                id='convert_channel.convert_private_description'
                                defaultMessage='Converting it to a private channel means:'
                            />
                        </p>
                        <ul>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_first'
                                    defaultMessage='Only people currently in the channel will be able to see and message in the channel'
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_second'
                                    defaultMessage='All previous uploaded files (unless accessed via the Public Link) and past conversations in the public channel will become inaccessible to users not in the channel'
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='convert_channel.convert_private_description_bullet_third'
                                    defaultMessage='Members will have to be invited to join this channel in the future'
                                />
                            </li>
                        </ul>
                        <br/>
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
                            defaultMessage='No, cancel'
                        />
                    </button>
                    <button
                        onClick={this.handleSubmit}
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='convert_channel.accept'
                            defaultMessage='Yes, convert to private channel'
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
