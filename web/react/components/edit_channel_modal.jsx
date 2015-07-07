// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

module.exports = React.createClass({
    handleEdit: function(e) {
        var data = {}
        data["channel_id"] = this.state.channel_id;
        if (data["channel_id"].length !== 26) return;
        data["channel_description"] = this.state.description.trim();

        Client.updateChannelDesc(data,
            function(data) {
                AsyncClient.getChannels(true);
            }.bind(this),
            function(err) {
                AsyncClient.dispatchError(err, "updateChannelDesc");
            }.bind(this)
        );
    },
    handleUserInput: function(e) {
        this.setState({ description: e.target.value });
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({ description: $(button).attr('data-desc'), title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid') });
        });
    },
    getInitialState: function() {
        return { description: "", title: "", channel_id: "" };
    },
    render: function() {
        return (
            <div className="modal fade" ref="modal" id="edit_channel" role="dialog" aria-hidden="true">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title">Edit {this.state.title} Description</h4>
                  </div>
                  <div className="modal-body">
                    <textarea className="form-control" style={{resize: "none"}} rows="6" ref="channelDesc" maxLength="1024" value={this.state.description} onChange={this.handleUserInput}></textarea>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                    <button type="button" className="btn btn-primary" data-dismiss="modal" onClick={this.handleEdit}>Save</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
