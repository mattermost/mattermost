// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, FormattedMessage} from 'react-intl';
import {updateChannel} from 'actions/channel_actions.jsx';
import React from 'react';
import {Modal} from 'react-bootstrap';

export class ConvertChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);

        this.state = {
            serverError: '',
            invalid: false
        };
    }

    handleHide(e) {
        if (e) {
            e.preventDefault();
        }

        this.props.onHide();

        this.setState({
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        const channel = Object.assign({}, this.props.channel);
        const oldChannelType = channel.type;

        channel.type = Constants.PRIVATE_CHANNEL;

        if (oldChannelType !== Constants.OPEN_CHANNEL) {
            return;
        }

        updateChannel(channel,
            () => {
                this.handleHide();
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    invalid: true
                });
            }
        );
    }

    handleCancel(e) {
        this.handleHide(e);
    }

    render() {
        const displayName = this.props.channel.display_name;

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
                            defaultMessage='Convert Public Channel to Private channel'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>
                        <h4>
                            <FormattedMessage
                                id='convert_channel.convert_channel_question'
                                defaultMessage='Convert <strong>{displayName}</strong> to a private channel?'
                                values={{displayName}}
                            />
                        </h4>
                        <br/>
                        <p>
                            <FormattedMessage
                                id='convert_channel.channel_public_description'
                                defaultMessage='<strong>{displayName}</strong> is currently a public channel.'
                                values={{displayName}}
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
                        <p>
                            <FormattedMessage
                                id='convert_channel.convert_channel_confirm_question'
                                defaultMessage='Are you sure you want to convert <strong>{displayName}</strong> to a <strong>private channel</strong>?'
                            />
                        </p>
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
