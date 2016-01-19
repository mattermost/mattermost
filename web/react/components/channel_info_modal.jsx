// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Modal = ReactBootstrap.Modal;
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    notFound: {
        id: 'channel_info.notFound',
        defaultMessage: 'No Channel Found'
    },
    close: {
        id: 'channel_info.close',
        defaultMessage: 'Close'
    },
    name: {
        id: 'channel_info.name',
        defaultMessage: 'Channel Name:'
    },
    handle: {
        id: 'channel_info.handle',
        defaultMessage: 'Channel Handle:'
    },
    channelId: {
        id: 'channel_info.channelId',
        defaultMessage: 'Channel ID:'
    }
});

class ChannelInfoModal extends React.Component {
    render() {
        const {formatMessage} = this.props.intl;
        let channel = this.props.channel;
        if (!channel) {
            channel = {
                display_name: formatMessage(messages.notFound),
                name: formatMessage(messages.notFound),
                id: formatMessage(messages.notFound)
            };
        }

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
                        <div className='col-sm-3 info__label'>{formatMessage(messages.name)}</div>
                        <div className='col-sm-9'>{channel.display_name}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{formatMessage(messages.handle)}</div>
                        <div className='col-sm-9'>{channel.name}</div>
                    </div>
                    <div className='row'>
                        <div className='col-sm-3 info__label'>{formatMessage(messages.channelId)}</div>
                        <div className='col-sm-9'>{channel.id}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        {formatMessage(messages.close)}
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