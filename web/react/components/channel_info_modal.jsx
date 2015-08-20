// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        var self = this;
        if(this.refs.modal) {
          $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
              var button = e.relatedTarget;
              self.setState({ channel_id: $(button).attr('data-channelid') });
          });
        }
    },
    getInitialState: function() {
        return { channel_id: ChannelStore.getCurrentId() };
    },
    render: function() {
        var channel = ChannelStore.get(this.state.channel_id);

        if (!channel) {
            channel = {};
            channel.display_name = "No Channel Found";
            channel.name = "No Channel Found";
            channel.id = "No Channel Found";
        }

        return (
            <div className="modal fade" ref="modal" id="channel_info" tabIndex="-1" role="dialog" aria-hidden="true">
               <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                      <h4 className="modal-title" id="myModalLabel"><span className="name">{channel.display_name}</span></h4>
                    </div>
                    <div className="modal-body">
                      <div className="row form-group">
                        <div className="col-sm-3 info__label">Channel Name: </div>
                        <div className="col-sm-9">{channel.display_name}</div>
                      </div>
                      <div className="row form-group">
                        <div className="col-sm-3 info__label">Channel Handle:</div>
                        <div className="col-sm-9">{channel.name}</div>
                      </div>
                      <div className="row">
                        <div className="col-sm-3 info__label">Channel ID:</div>
                        <div className="col-sm-9">{channel.id}</div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                    </div>
                  </div>
               </div>
            </div>
        );
    }
});
