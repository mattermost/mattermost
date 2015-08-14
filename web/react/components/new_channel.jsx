// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');

module.exports = React.createClass({
    displayName: 'NewChannelModal',
    handleSubmit: function(e) {
        e.preventDefault();

        var channel = {};
        var state = {serverError: ''};

        channel.display_name = this.refs.display_name.getDOMNode().value.trim();
        if (!channel.display_name) {
            state.displayNameError = 'This field is required';
            state.inValid = true;
        } else if (channel.display_name.length > 22) {
            state.displayNameError = 'This field must be less than 22 characters';
            state.inValid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = this.refs.channel_name.getDOMNode().value.trim();
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

        channel.description = this.refs.channel_desc.getDOMNode().value.trim();
        channel.type = this.state.channelType;

        client.createChannel(channel,
            function(data) {
                $(this.refs.modal.getDOMNode()).modal('hide');

                asyncClient.getChannel(data.id);
                utils.switchChannel(data);

                this.refs.display_name.getDOMNode().value = '';
                this.refs.channel_name.getDOMNode().value = '';
                this.refs.channel_desc.getDOMNode().value = '';
            }.bind(this),
            function(err) {
                state.serverError = err.message;
                state.inValid = true;
                this.setState(state);
            }.bind(this)
        );
    },
    displayNameKeyUp: function() {
        var displayName = this.refs.display_name.getDOMNode().value.trim();
        var channelName = utils.cleanUpUrlable(displayName);
        this.refs.channel_name.getDOMNode().value = channelName;
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
    },
    getInitialState: function() {
        return {channelType: ''};
    },
    render: function() {
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
            <div className='modal fade' id='new_channel' ref='modal' tabIndex='-1' role='dialog' aria-hidden='true'>
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button type='button' className='close' data-dismiss='modal'>
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Cancel</span>
                            </button>
                            <h4 className='modal-title'>New {channelTerm}</h4>
                        </div>
                        <form role='form'>
                            <div className='modal-body'>
                                <div className={displayNameClass}>
                                    <label className='control-label'>Display Name</label>
                                    <input onKeyUp={this.displayNameKeyUp} type='text' ref='display_name' className='form-control' placeholder='Enter display name' maxLength='64' />
                                    {displayNameError}
                                </div>
                                <div className={nameClass}>
                                    <label className='control-label'>Handle</label>
                                    <input type='text' className='form-control' ref='channel_name' placeholder="lowercase alphanumeric's only" maxLength='64' />
                                    {nameError}
                                </div>
                                <div className='form-group'>
                                    <label className='control-label'>Description</label>
                                    <textarea className='form-control no-resize' ref='channel_desc' rows='3' placeholder='Description' maxLength='1024'></textarea>
                                </div>
                                {serverError}
                            </div>
                            <div className='modal-footer'>
                                <button type='button' className='btn btn-default' data-dismiss='modal'>Cancel</button>
                                <button onClick={this.handleSubmit} type='submit' className='btn btn-primary'>Create New {channelTerm}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
});
