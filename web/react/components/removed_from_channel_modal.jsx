// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    handleClose: function() {
      var townSquare = ChannelStore.getByName("town-square");
      utils.switchChannel(townSquare);

      $(this.refs.title.getDOMNode()).text("")
      $(this.refs.body.getDOMNode()).text("");
    },
    componentDidMount: function() {
      $(this.getDOMNode()).on('hidden.bs.modal',this.handleClose);
    },
    componentWillUnmount: function() {
      $(this.getDOMNode()).off('hidden.bs.modal',this.handleClose);
    },
    render: function() {
        currentUser = UserStore.getCurrentUser();

        if (currentUser != null) {
            return (
                <div className="modal fade" ref="modal" id="removed_from_channel" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                          <h4 ref="title" className="modal-title" />
                        </div>
                        <div className="modal-body">
                            <p ref="body" />
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