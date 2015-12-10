// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import * as utils from '../utils/utils.jsx';

const messages = defineMessages({
    channelName: {
        id: 'removed_channel.channelName',
        defaultMessage: 'the channel'
    },
    someone: {
        id: 'removed_channel.someone',
        defaultMessage: 'Someone'
    },
    close: {
        id: 'removed_channel.close',
        defaultMessage: 'Close'
    },
    from: {
        id: 'removed_channel.from',
        defaultMessage: 'Removed from'
    },
    you: {
        id: 'removed_channel.you',
        defaultMessage: 'removed you from'
    },
    okay: {
        id: 'removed_channel.okay',
        defaultMessage: 'Okay'
    }
});

class RemovedFromChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleShow = this.handleShow.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = {
            channelName: '',
            remover: ''
        };
    }

    handleShow() {
        var newState = {};
        if (BrowserStore.getItem('channel-removed-state')) {
            newState = BrowserStore.getItem('channel-removed-state');
            BrowserStore.removeItem('channel-removed-state');
        }

        var townSquare = ChannelStore.getByName('town-square');
        setTimeout(() => utils.switchChannel(townSquare), 1);

        this.setState(newState);
    }

    handleClose() {
        this.setState({channelName: '', remover: ''});
    }

    componentDidMount() {
        $(ReactDOM.findDOMNode(this)).on('show.bs.modal', this.handleShow);
        $(ReactDOM.findDOMNode(this)).on('hidden.bs.modal', this.handleClose);
    }

    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this)).off('show.bs.modal', this.handleShow);
        $(ReactDOM.findDOMNode(this)).off('hidden.bs.modal', this.handleClose);
    }

    render() {
        const {formatMessage} = this.props.intl;
        var currentUser = UserStore.getCurrentUser();

        var channelName = formatMessage(messages.channelName);
        if (this.state.channelName) {
            channelName = this.state.channelName;
        }

        var remover = formatMessage(messages.someone);
        if (this.state.remover) {
            remover = this.state.remover;
        }

        if (currentUser != null) {
            return (
                <div
                    className='modal fade'
                    ref='modal'
                    id='removed_from_channel'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label={formatMessage(messages.close)}
                                ><span aria-hidden='true'>&times;</span></button>
                                <h4 className='modal-title'>{formatMessage(messages.from)} <span className='name'>{channelName}</span></h4>
                            </div>
                            <div className='modal-body'>
                                  <p>{remover} {formatMessage(messages.you)} {channelName}</p>
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    data-dismiss='modal'
                                >{formatMessage(messages.okay)}</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return <div/>;
    }
}

RemovedFromChannelModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(RemovedFromChannelModal);
