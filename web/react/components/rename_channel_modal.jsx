// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();

        if (this.state.channel_id.length !== 26) return;

        var channel = ChannelStore.get(this.state.channel_id);
        var oldName = channel.name
        var oldDisplayName = channel.display_name
        var state = { server_error: "" };

        channel.display_name = this.state.display_name.trim();
        if (!channel.display_name) {
            state.display_name_error = "This field is required";
            state.inValid = true;
        }
        else if (channel.display_name.length > 22) {
            state.display_name_error = "This field must be less than 22 characters";
            state.inValid = true;
        }
        else {
            state.display_name_error = "";
        }

        channel.name = this.state.channel_name.trim();
        if (!channel.name) {
            state.name_error = "This field is required";
            state.inValid = true;
        }
        else if(channel.name.length > 22){
            state.name_error = "This field must be less than 22 characters";
            state.inValid = true;
        }
        else {
            var cleaned_name = utils.cleanUpUrlable(channel.name);
            if (cleaned_name != channel.name) {
                state.name_error = "Must be lowercase alphanumeric characters";
                state.inValid = true;
            }
            else {
                state.name_error = "";
            }
        }

        this.setState(state);

        if (state.inValid)
            return;

        if (oldName == channel.name && oldDisplayName == channel.display_name)
            return;

        Client.updateChannel(channel,
            function(data, text, req) {
                this.refs.display_name.getDOMNode().value = "";
                this.refs.channel_name.getDOMNode().value = "";

                $('#' + this.props.modalId).modal('hide');
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + this.state.channel_name;
                AsyncClient.getChannels(true);
            }.bind(this),
            function(err) {
                state.server_error = err.message;
                state.inValid = true;
                this.setState(state);
            }.bind(this)
        );
    },
    onNameChange: function() {
        this.setState({ channel_name: this.refs.channel_name.getDOMNode().value })
    },
    onDisplayNameChange: function() {
        this.setState({ display_name: this.refs.display_name.getDOMNode().value })
    },
    displayNameKeyUp: function(e) {
        var display_name = this.refs.display_name.getDOMNode().value.trim();
        var channel_name = utils.cleanUpUrlable(display_name);
        this.refs.channel_name.getDOMNode().value = channel_name;
        this.setState({ channel_name: channel_name })
    },
    handleClose: function() {
        this.setState({display_name: "", channel_name: "", display_name_error: "", server_error: "", name_error: ""});
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = $(e.relatedTarget);
            self.setState({ display_name: button.attr('data-display'), channel_name: button.attr('data-name'), channel_id: button.attr('data-channelid') });
        });
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        $(this.refs.modal.getDOMNode()).off('hidden.bs.modal', this.handleClose);
    },
    getInitialState: function() {
        return { display_name: "", channel_name: "", channel_id: "" };
    },
    render: function() {

        var display_name_error = this.state.display_name_error ? <label className='control-label'>{ this.state.display_name_error }</label> : null;
        var name_error = this.state.name_error ? <label className='control-label'>{ this.state.name_error }</label> : null;
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

        return (
            <div className="modal fade" ref="modal" id="rename_channel" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                        <h4 className="modal-title">Rename Channel</h4>
                        </div>
                        <div className="modal-body">
                            <form role="form">
                                <div className={ this.state.display_name_error ? "form-group has-error" : "form-group" }>
                                    <label className='control-label'>Display Name</label>
                                    <input onKeyUp={this.displayNameKeyUp} onChange={this.onDisplayNameChange} type="text" ref="display_name" className="form-control" placeholder="Enter display name" value={this.state.display_name} maxLength="64" />
                                    { display_name_error }
                                </div>
                                <div className={ this.state.name_error ? "form-group has-error" : "form-group" }>
                                    <label className='control-label'>Handle</label>
                                    <input onChange={this.onNameChange} type="text" className="form-control" ref="channel_name" placeholder="lowercase alphanumeric's only" value={this.state.channel_name} maxLength="64" />
                                    { name_error }
                                </div>
                                { server_error }
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-default" data-dismiss="modal">Cancel</button>
                            <button onClick={this.handleSubmit} type="button" className="btn btn-primary">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

