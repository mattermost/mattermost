// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Client = require('../utils/client.jsx');
const AsyncClient = require('../utils/async_client.jsx');

export default class EditChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleEdit = this.handleEdit.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.onShow = this.onShow.bind(this);

        this.state = {
            header: '',
            title: '',
            channelId: '',
            serverError: ''
        };
    }
    handleEdit() {
        var data = {};
        data.channel_id = this.state.channelId;

        if (data.channel_id.length !== 26) {
            return;
        }

        data.channel_header = this.state.header.trim();

        Client.updateChannelHeader(data,
            () => {
                this.setState({serverError: ''});
                AsyncClient.getChannel(this.state.channelId);
                $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
            },
            (err) => {
                if (err.message === 'Invalid channel_header parameter') {
                    this.setState({serverError: 'This channel header is too long, please enter a shorter one'});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }
    handleUserInput(e) {
        this.setState({header: e.target.value});
    }
    handleClose() {
        this.setState({header: '', serverError: ''});
    }
    onShow(e) {
        const button = e.relatedTarget;
        this.setState({header: $(button).attr('data-header'), title: $(button).attr('data-title'), channelId: $(button).attr('data-channelid'), serverError: ''});
    }
    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', this.onShow);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.modal)).off('hidden.bs.modal', this.handleClose);
    }
    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><br/><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var editTitle = (
            <h4
                className='modal-title'
                ref='title'
            >
                Edit Header
            </h4>
        );
        if (this.state.title) {
            editTitle = (
                <h4
                    className='modal-title'
                    ref='title'
                >
                    Edit Header for <span className='name'>{this.state.title}</span>
                </h4>
            );
        }

        return (
            <div
                className='modal fade'
                ref='modal'
                id='edit_channel'
                role='dialog'
                tabIndex='-1'
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
                            >
                                <span aria-hidden='true'>&times;</span>
                            </button>
                            {editTitle}
                        </div>
                        <div className='modal-body'>
                            <textarea
                                className='form-control no-resize'
                                rows='6'
                                maxLength='1024'
                                value={this.state.header}
                                onChange={this.handleUserInput}
                            />
                            {serverError}
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                Cancel
                            </button>
                            <button
                                type='button'
                                className='btn btn-primary'
                                onClick={this.handleEdit}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
