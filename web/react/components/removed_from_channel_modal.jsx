// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx')
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    handleShow: function() {
      var newState = {};
      if(BrowserStore.getItem("channel-removed-state")) {
        newState = BrowserStore.getItem("channel-removed-state");
        BrowserStore.removeItem("channel-removed-state");
      }

      this.setState(newState);
    },
    handleClose: function() {
      var townSquare = ChannelStore.getByName("town-square");
      utils.switchChannel(townSquare);

      this.setState({channelName: "", remover: ""})
    },
    componentDidMount: function() {
      $(this.getDOMNode()).on('show.bs.modal',this.handleShow);
      $(this.getDOMNode()).on('hidden.bs.modal',this.handleClose);
    },
    componentWillUnmount: function() {
      $(this.getDOMNode()).off('show.bs.modal',this.handleShow);
      $(this.getDOMNode()).off('hidden.bs.modal',this.handleClose);
    },
    getInitialState: function() {
      return {channelName: "", remover: ""}
    },
    render: function() {
        var currentUser = UserStore.getCurrentUser();
        var channelName = this.state.channelName ? this.state.channelName : "the channel"
        var remover = this.state.remover ? this.state.remover : "Someone"

        if (currentUser != null) {
            return (
                <div className="modal fade" ref="modal" id="removed_from_channel" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                          <h4 className="modal-title">Removed from {channelName}</h4>
                        </div>
                        <div className="modal-body">
                            <p>{remover} removed you from {channelName}</p>
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-primary" data-dismiss="modal">Okay</button>
                        </div>
                      </div>
                   </div>
                </div>
            );
        } else {
            return <div/>;
        }
    }
});