// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const Modal = ReactBootstrap.Modal;

const holders = defineMessages({
    notFound: {
        id: 'channel_info.notFound',
        defaultMessage: 'No Channel Found'
    }
});

class ChannelInfoModal extends React.Component {
    render() {
        const {formatMessage} = this.props.intl;
        let channel = this.props.channel;
        if (!channel) {
            channel = {
                display_name: formatMessage(holders.notFound),
                name: formatMessage(holders.notFound),
                purpose: formatMessage(holders.notFound),
                id: formatMessage(holders.notFound)
            };
        }

        const channelURL = Utils.getShortenedTeamURL() + channel.name;

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButtton={true}>
                    {channel.display_name}
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
                    <div className='row'>
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
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};

export default injectIntl(ChannelInfoModal);