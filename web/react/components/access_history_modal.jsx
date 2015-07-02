// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
	getInitialState: function() {
        return {};
    },
    render: function() {
    	var accessList = [];
    	var server_error = {};

        return (
            <div>
                <div className="modal fade" ref="modal" id="default_channels" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h4 className="modal-title" id="myModalLabel">Access History</h4>
                        </div>
                        <div ref="modalBody" className="modal-body">
                            <form role="form">
                                { accessList }
                            </form>
                            { server_error }
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                        </div>
                      </div>
                   </div>
                </div>
            </div>
        );
    }
});
