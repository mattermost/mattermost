// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var utils = require('../utils/utils.jsx');

export default class RemovedFromChannelModal extends React.Component {
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

        this.setState(newState);
    }

    handleClose() {
        var townSquare = ChannelStore.getByName('town-square');
        utils.switchChannel(townSquare);

        this.setState({channelName: '', remover: ''});
    }

    componentDidMount() {
        $(React.findDOMNode(this)).on('show.bs.modal', this.handleShow);
        $(React.findDOMNode(this)).on('hidden.bs.modal', this.handleClose);
    }

    componentWillUnmount() {
        $(React.findDOMNode(this)).off('show.bs.modal', this.handleShow);
        $(React.findDOMNode(this)).off('hidden.bs.modal', this.handleClose);
    }

    render() {
        var currentUser = UserStore.getCurrentUser();

        var channelName = 'the channel';
        if (this.state.channelName) {
            channelName = this.state.channelName;
        }

        var remover = 'Someone';
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
                                    aria-label='Close'
                                ><span aria-hidden='true'>&times;</span></button>
                                <h4 className='modal-title'>Removed from <span className='name'>{channelName}</span></h4>
                            </div>
                            <div className='modal-body'>
                                  <p>{remover} removed you from {channelName}</p>
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    data-dismiss='modal'
                                >Okay</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return <div/>;
    }
}