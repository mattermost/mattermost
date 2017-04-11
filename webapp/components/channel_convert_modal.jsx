// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {cleanUpUrlable, getShortenedURL} from 'utils/url.jsx';

import TeamStore from 'stores/team_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannel} from 'actions/channel_actions.jsx';
import {Modal, Tooltip, OverlayTrigger} from 'react-bootstrap';

import React from 'react';

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

    componentWillReceiveProps(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.channel, this.props.channel)) {
            this.setState({

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
        }
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
        const {formatMessage} = this.props.intl;

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
        const {formatMessage} = this.props.intl;
        let displayName = this.props.channel.display_name;

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
                            values={{
                                    displayName: (displayName)
                                }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>
                        <h4>Convert <strong>{displayName}</strong> to a private channel?</h4>
                        <br />
                        <p>
                            <strong>{displayName}</strong> is currently a public channel.
                        </p>
                        <br />
                        <p>Converting it to a private channel means:</p>
                        <ul>
                            <li>
                                Only people currently in the channel will be able to see and message in the channel
                            </li>
                            <li>
                                All previous uploaded files (unless accessed via the Public Link) and 
                                past conversations in the public channel will become inaccessible to users not in the channel
                            </li>
                            <li>
                                Members will have to be invited to join this channel in the future
                            </li>
                        </ul>
                        <p>
                            Are you sure you want to convert <strong>{displayName}</strong> to a <strong>private channel</strong>?
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
