// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

module.exports = React.createClass({
    handleEdit: function(e) {
        var data = {};
        data["channel_id"] = this.state.channel_id;
        if (data["channel_id"].length !== 26) return;
        data["channel_description"] = this.state.description.trim();

        Client.updateChannelDesc(data,
            function(data) {
                this.setState({ server_error: "" });
                AsyncClient.getChannels(true);
                $(this.refs.modal.getDOMNode()).modal('hide');
            }.bind(this),
            function(err) {
                if (err.message === "Invalid channel_description parameter") {
                    this.setState({ server_error: "This description is too long, please enter a shorter one" });
                }
                else {
                    this.setState({ server_error: err.message });
                }
            }.bind(this)
        );
    },
    handleUserInput: function(e) {
        this.setState({ description: e.target.value });
    },
    handleClose: function() {
        this.setState({description: "", server_error: ""});
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({ description: $(button).attr('data-desc'), title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid'), server_error: "" });
        });
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', this.handleClose)
    },
    componentWillUnmount: function() {
        $(this.refs.modal.getDOMNode()).off('hidden.bs.modal', this.handleClose)
    },
    getInitialState: function() {
        return { description: "", title: "", channel_id: "" };
    },
    render: function() {
        var server_error = this.state.server_error ? <div className='form-group has-error'><br/><label className='control-label'>{ this.state.server_error }</label></div> : null;

        return (
            <div className="modal fade" ref="modal" id="edit_channel" role="dialog" tabIndex="-1" aria-hidden="true">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title">Edit {this.state.title} Description</h4>
                  </div>
                  <div className="modal-body">
                    <textarea className="form-control no-resize" rows="6" ref="channelDesc" maxLength="1024" value={this.state.description} onChange={this.handleUserInput}></textarea>
                    { server_error }
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={this.handleEdit}>Save</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
