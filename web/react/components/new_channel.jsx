// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();

        var channel = {};
        var state = { server_error: "" };

        channel.display_name = this.refs.display_name.getDOMNode().value.trim();
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

        channel.name = this.refs.channel_name.getDOMNode().value.trim();
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
                state.name_error = "Must be lowercase alphanumeric characters, allowing '-' but not starting or ending with '-'";
                state.inValid = true;
            }
            else {
                state.name_error = "";
            }
        }

        this.setState(state);

        if (state.inValid)
            return;

        var cu = UserStore.getCurrentUser();
        channel.team_id = cu.team_id;

        channel.description = this.refs.channel_desc.getDOMNode().value.trim();
        channel.type = this.state.channel_type;

        var self = this;
        client.createChannel(channel,
            function(data) {
                this.refs.display_name.getDOMNode().value = "";
                this.refs.channel_name.getDOMNode().value = "";
                this.refs.channel_desc.getDOMNode().value = "";

                $(self.refs.modal.getDOMNode()).modal('hide');
                window.location.href = "/channels/" + channel.name;
                asyncClient.getChannels(true);
            }.bind(this),
            function(err) {
                state.server_error = err.message;
                state.inValid = true;
                this.setState(state);
            }.bind(this)
        );
    },
    displayNameKeyUp: function(e) {
        var display_name = this.refs.display_name.getDOMNode().value.trim();
        var channel_name = utils.cleanUpUrlable(display_name);
        this.refs.channel_name.getDOMNode().value = channel_name;
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({ channel_type: $(button).attr('data-channeltype') });
        });
    },
    getInitialState: function() {
        return { channel_type: "" };
    },
    render: function() {

        var display_name_error = this.state.display_name_error ? <label className='control-label'>{ this.state.display_name_error }</label> : null;
        var name_error = this.state.name_error ? <label className='control-label'>{ this.state.name_error }</label> : null;
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

        return (
            <div className="modal fade" id="new_channel" ref="modal" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                        <h4 className="modal-title">New Channel</h4>
                        </div>
                        <div className="modal-body">
                            <form role="form">
                                <div className={ this.state.display_name_error ? "form-group has-error" : "form-group" }>
                                    <label className='control-label'>Display Name</label>
                                    <input onKeyUp={this.displayNameKeyUp} type="text" ref="display_name" className="form-control" placeholder="Enter display name" maxLength="64" />
                                    { display_name_error }
                                </div>
                                <div className={ this.state.name_error ? "form-group has-error" : "form-group" }>
                                    <label className='control-label'>Handle</label>
                                    <input type="text" className="form-control" ref="channel_name" placeholder="lowercase alphanumeric's only" maxLength="64" />
                                    { name_error }
                                </div>
                                <div className="form-group">
                                    <label className='control-label'>Description</label>
                                    <textarea className="form-control" ref="channel_desc" rows="3" placeholder="Description" maxLength="1024"></textarea>
                                </div>
                                { server_error }
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                            <button onClick={this.handleSubmit} type="button" className="btn btn-primary">Create New Channel</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
