// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client =require('../utils/client.jsx');
var AsyncClient =require('../utils/async_client.jsx');
var ChannelStore =require('../stores/channel_store.jsx')

module.exports = React.createClass({
    handleDelete: function(e) {
        if (this.state.channel_id.length != 26) return;

        Client.deleteChannel(this.state.channel_id,
            function(data) {
                AsyncClient.getChannels(true);
                window.location.href = '/';
            }.bind(this),
            function(err) {
                AsyncClient.dispatchError(err, "handleDelete");
            }.bind(this)
        );
    },
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = $(e.relatedTarget);
            self.setState({ title: button.attr('data-title'), channel_id: button.attr('data-channelid') });
        });
    },
    getInitialState: function() {
        return { title: "", channel_id: "" };
    },
    render: function() {

        var channelType = ChannelStore.getCurrent() && ChannelStore.getCurrent().type === 'P' ? "private group" : "channel"

        return (
            <div className="modal fade" ref="modal" id="delete_channel" role="dialog" aria-hidden="true">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title">Confirm DELETE Channel</h4>
                  </div>
                  <div className="modal-body">
                    <p>
                        Are you sure you wish to delete the {this.state.title} {channelType}?
                    </p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                    <button type="button" className="btn btn-danger" data-dismiss="modal" onClick={this.handleDelete}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
