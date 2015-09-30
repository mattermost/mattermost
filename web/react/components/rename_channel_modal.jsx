// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Utils = require('../utils/utils.jsx');
const Client = require('../utils/client.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const ChannelStore = require('../stores/channel_store.jsx');

export default class RenameChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.onNameChange = this.onNameChange.bind(this);
        this.onDisplayNameChange = this.onDisplayNameChange.bind(this);
        this.displayNameKeyUp = this.displayNameKeyUp.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            displayName: '',
            channelName: '',
            channelId: '',
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        };
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.channelId.length !== 26) {
            return;
        }

        let channel = ChannelStore.get(this.state.channelId);
        const oldName = channel.name;
        const oldDisplayName = channel.displayName;
        let state = {serverError: ''};

        channel.display_name = this.state.displayName.trim();
        if (!channel.display_name) {
            state.displayNameError = 'This field is required';
            state.invalid = true;
        } else if (channel.display_name.length > 22) {
            state.displayNameError = 'This field must be less than 22 characters';
            state.invalid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = this.state.channelName.trim();
        if (!channel.name) {
            state.nameError = 'This field is required';
            state.invalid = true;
        } else if (channel.name.length > 22) {
            state.nameError = 'This field must be less than 22 characters';
            state.invalid = true;
        } else {
            let cleanedName = Utils.cleanUpUrlable(channel.name);
            if (cleanedName !== channel.name) {
                state.nameError = 'Must be lowercase alphanumeric characters';
                state.invalid = true;
            } else {
                state.nameError = '';
            }
        }

        this.setState(state);

        if (state.invalid || (oldName === channel.name && oldDisplayName === channel.display_name)) {
            return;
        }

        Client.updateChannel(channel,
            function handleUpdateSuccess() {
                $(React.findDOMNode(this.refs.modal)).modal('hide');

                AsyncClient.getChannel(channel.id);
                Utils.updateAddressBar(channel.name);

                React.findDOMNode(this.refs.displayName).value = '';
                React.findDOMNode(this.refs.channelName).value = '';
            }.bind(this),
            function handleUpdateError(err) {
                state.serverError = err.message;
                state.invalid = true;
                this.setState(state);
            }.bind(this)
        );
    }
    onNameChange() {
        this.setState({channelName: React.findDOMNode(this.refs.channelName).value});
    }
    onDisplayNameChange() {
        this.setState({displayName: React.findDOMNode(this.refs.displayName).value});
    }
    displayNameKeyUp() {
        const displayName = React.findDOMNode(this.refs.displayName).value.trim();
        const channelName = Utils.cleanUpUrlable(displayName);
        React.findDOMNode(this.refs.channelName).value = channelName;
        this.setState({channelName: channelName});
    }
    handleClose() {
        this.state = {
            displayName: '',
            channelName: '',
            channelId: '',
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        };
    }
    componentDidMount() {
        $(React.findDOMNode(this.refs.modal)).on('show.bs.modal', function handleShow(e) {
            const button = $(e.relatedTarget);
            this.setState({displayName: button.attr('data-display'), channelName: button.attr('data-name'), channelId: button.attr('data-channelid')});
        }.bind(this));
        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $(React.findDOMNode(this.refs.modal)).off('hidden.bs.modal', this.handleClose);
    }
    render() {
        let displayNameError = null;
        let displayNameClass = 'form-group';
        if (this.state.displayNameError) {
            displayNameError = <label className='control-label'>{this.state.displayNameError}</label>;
            displayNameClass += ' has-error';
        }

        let nameError = null;
        let nameClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameClass += ' has-error';
        }

        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <div
                className='modal fade'
                ref='modal'
                id='rename_channel'
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
                            >
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Close</span>
                            </button>
                        <h4 className='modal-title'>Rename Channel</h4>
                        </div>
                        <form role='form'>
                            <div className='modal-body'>
                                <div className={displayNameClass}>
                                    <label className='control-label'>Display Name</label>
                                    <input
                                        onKeyUp={this.displayNameKeyUp}
                                        onChange={this.onDisplayNameChange}
                                        type='text'
                                        ref='displayName'
                                        className='form-control'
                                        placeholder='Enter display name'
                                        value={this.state.displayName}
                                        maxLength='64'
                                    />
                                    {displayNameError}
                                </div>
                                <div className={nameClass}>
                                    <label className='control-label'>Handle</label>
                                    <input
                                        onChange={this.onNameChange}
                                        type='text'
                                        className='form-control'
                                        ref='channelName'
                                        placeholder='lowercase alphanumeric&#39;s only'
                                        value={this.state.channelName}
                                        maxLength='64'
                                    />
                                    {nameError}
                                </div>
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
                                    onClick={this.handleSubmit}
                                    type='submit'
                                    className='btn btn-primary'
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}
