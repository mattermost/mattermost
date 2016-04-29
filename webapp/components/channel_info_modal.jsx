// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';

import React from 'react';

export default class ChannelInfoModal extends React.Component {
    shouldComponentUpdate(nextProps) {
        if (nextProps.show !== this.props.show) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.channel, this.props.channel)) {
            return true;
        }

        return false;
    }
    render() {
        let channel = this.props.channel;
        if (!channel) {
            const notFound = Utils.localizeMessage('channel_info.notFound', 'No Channel Found');

            channel = {
                display_name: notFound,
                name: notFound,
                purpose: notFound,
                id: notFound
            };
        }

        const channelURL = Utils.getTeamURLFromAddressBar() + '/channels/' + channel.name;

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButtton={true}>
                    <Modal.Title>
                        {channel.display_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='channel_info.name'
                                defaultMessage='Channel Name:'
                            />
                        </div>
                        <div className='col-sm-9'>{channel.display_name}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='channel_info.url'
                                defaultMessage='Channel URL:'
                            />
                        </div>
                        <div className='col-sm-9'>{channelURL}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='channel_info.id'
                                defaultMessage='Channel ID:'
                            />
                        </div>
                        <div className='col-sm-9'>{channel.id}</div>
                    </div>
                    <div className='row'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='channel_info.purpose'
                                defaultMessage='Channel Purpose:'
                            />
                        </div>
                        <div className='col-sm-9'>{channel.purpose}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        <FormattedMessage
                            id='channel_info.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ChannelInfoModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
