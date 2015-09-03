// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');

export default class NewChannelModal extends React.Component {
    constructor() {
        super();

        this.handleSubmit = this.handleSubmit.bind(this);
        this.displayNameKeyUp = this.displayNameKeyUp.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = {channelType: ''};
    }
    handleSubmit(e) {
        e.preventDefault();

        var channel = {};
        var state = {serverError: ''};

        channel.display_name = React.findDOMNode(this.refs.display_name).value.trim();
        if (!channel.display_name) {
            state.displayNameError = 'This field is required';
            state.inValid = true;
        } else if (channel.display_name.length > 22) {
            state.displayNameError = 'This field must be less than 22 characters';
            state.inValid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = React.findDOMNode(this.refs.channel_name).value.trim();
        if (!channel.name) {
            state.nameError = 'This field is required';
            state.inValid = true;
        } else if (channel.name.length > 22) {
            state.nameError = 'This field must be less than 22 characters';
            state.inValid = true;
        } else {
            var cleanedName = utils.cleanUpUrlable(channel.name);
            if (cleanedName !== channel.name) {
                state.nameError = "Must be lowercase alphanumeric characters, allowing '-' but not starting or ending with '-'";
                state.inValid = true;
            } else {
                state.nameError = '';
            }
        }

        this.setState(state);

        if (state.inValid) {
            return;
        }

        var cu = UserStore.getCurrentUser();
        channel.team_id = cu.team_id;

        channel.description = React.findDOMNode(this.refs.channel_desc).value.trim();
        channel.type = this.state.channelType;

        client.createChannel(channel,
            function success(data) {
                $(React.findDOMNode(this.refs.modal)).modal('hide');

                asyncClient.getChannel(data.id);
                utils.switchChannel(data);

                React.findDOMNode(this.refs.display_name).value = '';
                React.findDOMNode(this.refs.channel_name).value = '';
                React.findDOMNode(this.refs.channel_desc).value = '';
            }.bind(this),
            function error(err) {
                state.serverError = err.message;
                state.inValid = true;
                this.setState(state);
            }.bind(this)
        );
    }
    displayNameKeyUp() {
        var displayName = React.findDOMNode(this.refs.display_name).value.trim();
        var channelName = utils.cleanUpUrlable(displayName);
        React.findDOMNode(this.refs.channel_name).value = channelName;
    }
    componentDidMount() {
        var self = this;
        $(React.findDOMNode(this.refs.modal)).on('show.bs.modal', function onModalShow(e) {
            var button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $(React.findDOMNode(this.refs.modal)).off('hidden.bs.modal', this.handleClose);
    }
    handleClose() {
        $(React.findDOMNode(this)).find('.form-control').each(function clearForms() {
            this.value = '';
        });

        this.setState({channelType: '', displayNameError: '', nameError: '', serverError: '', inValid: false});
    }
    render() {
        var displayNameError = null;
        var nameError = null;
        var serverError = null;
        var displayNameClass = 'form-group';
        var nameClass = 'form-group';

        if (this.state.displayNameError) {
            displayNameError = <label className='control-label'>{this.state.displayNameError}</label>;
            displayNameClass += ' has-error';
        }
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameClass += ' has-error';
        }
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var channelTerm = 'Channel';
        if (this.state.channelType === 'P') {
            channelTerm = 'Group';
        }

        return (
            <div
                className='modal fade'
                id='new_channel'
                ref='modal'
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
                                <span className='sr-only'>Cancel</span>
                            </button>
                            <h4 className='modal-title'>New {channelTerm}</h4>
                        </div>
                        <form role='form'>
                            <div className='modal-body'>
                                <div className={displayNameClass}>
                                    <label className='control-label'>Display Name</label>
                                    <input
                                        onKeyUp={this.displayNameKeyUp}
                                        type='text'
                                        ref='display_name'
                                        className='form-control'
                                        placeholder='Enter display name'
                                        maxLength='22'
                                    />
                                    {displayNameError}
                                </div>
                                <div className={nameClass}>
                                    <label className='control-label'>Handle</label>
                                    <input
                                        type='text'
                                        className='form-control'
                                        ref='channel_name'
                                        placeholder="lowercase alphanumeric's only"
                                        maxLength='22'
                                    />
                                    {nameError}
                                </div>
                                <div className='form-group'>
                                    <label className='control-label'>Description</label>
                                    <textarea
                                        className='form-control no-resize'
                                        ref='channel_desc'
                                        rows='3'
                                        placeholder='Description'
                                        maxLength='1024'
                                    />
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
                                    Create New {channelTerm}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}
