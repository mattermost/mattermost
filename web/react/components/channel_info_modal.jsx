// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
const Modal = ReactBootstrap.Modal;

export default class ChannelInfoModal extends React.Component {
    render() {
        let channel = this.props.channel;
        if (!channel) {
            channel = {
                display_name: 'No Channel Found',
                name: 'No Channel Found',
                purpose: 'No Channel Found',
                id: 'No Channel Found'
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
                        <div className='col-sm-3 info__label'>{'Channel Name:'}</div>
                        <div className='col-sm-9'>{channel.display_name}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Channel URL:'}</div>
                        <div className='col-sm-9'>{channelURL}</div>
                    </div>
                    <div className='row'>
                        <div className='col-sm-3 info__label'>{'Channel ID:'}</div>
                        <div className='col-sm-9'>{channel.id}</div>
                    </div>
                    <div className='row'>
                        <div className='col-sm-3 info__label'>{'Channel Purpose:'}</div>
                        <div className='col-sm-9'>{channel.purpose}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        {'Close'}
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
