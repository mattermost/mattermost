// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    getInitialState: function() {
        return { };
    },
    render: function() {
        var currentUser = UserStore.getCurrentUser()

        if (currentUser != null) {
            return (
                <div className="modal fade" ref="modal" id="post_deleted" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                          <h4 className="modal-title" id="myModalLabel">Comment could not be posted</h4>
                        </div>
                        <div className="modal-body">
                            <p>Someone deleted the message on which you tried to post a comment.</p>
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
