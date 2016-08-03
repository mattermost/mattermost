// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';
import TeamStore from 'stores/team_store.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';

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
        let channelIcon;

        if (!channel) {
            const notFound = Utils.localizeMessage('channel_info.notFound', 'No Channel Found');

            channel = {
                display_name: notFound,
                name: notFound,
                purpose: notFound,
                header: notFound,
                id: notFound
            };
        }

        if (channel.type === 'O') {
            channelIcon = (<span className='fa fa-globe'/>);
        } else if (channel.type === 'P') {
            channelIcon = (<span className='fa fa-lock'/>);
        }

        const channelURL = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;

        let channelPurpose = null;
        if (channel.purpose) {
            channelPurpose = (
                <div className='form-group'>
                    <div className='info__label'>
                        <FormattedMessage
                            id='channel_info.purpose'
                            defaultMessage='Purpose:'
                        />
                    </div>
                    <div className='info__value'>{channel.purpose}</div>
                </div>
            );
        }

        let channelHeader = null;
        if (channel.header) {
            channelHeader = (
                <div className='form-group'>
                    <div className='info__label'>
                        <FormattedMessage
                            id='channel_info.header'
                            defaultMessage='Header:'
                        />
                    </div>
                    <div
                        className='info__value'
                        dangerouslySetInnerHTML={{__html: TextFormatting.formatText(channel.header, {singleline: false, mentionHighlight: false})}}
                    />
                </div>
            );
        }

        return (
            <Modal
                dialogClassName='about-modal'
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='channel_info.about'
                            defaultMessage='About'
                        />
                        <strong>{channelIcon}{channel.display_name}</strong>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    {channelPurpose}
                    {channelHeader}
                    <div className='form-group'>
                        <div className='info__label'>
                            <FormattedMessage
                                id='channel_info.url'
                                defaultMessage='URL:'
                            />
                        </div>
                        <div className='info__value'>{channelURL}</div>
                    </div>
                    <div className='about-modal__hash form-group padding-top x2'>
                        <p>
                            <FormattedMessage
                                id='channel_info.id'
                                defaultMessage='ID: '
                            />
                            {channel.id}
                        </p>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}

ChannelInfoModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
