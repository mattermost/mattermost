// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');

function getStateFromStoresForSessions() {
    return {
        sessions: UserStore.getSessions(),
        server_error: null,
        client_error: null
    };
}

function getStateFromStoresForAudits() {
    return {
        audits: UserStore.getAudits()
    };
}
/////////currentPostDay.toDateString()//////////////////
module.exports = React.createClass({
    componentDidMount: function() {
        UserStore.addAuditsChangeListener(this._onChange);
        AsyncClient.getAudits();
    },
    componentWillUnmount: function() {
        UserStore.removeAuditsChangeListener(this._onChange);
    },
    _onChange: function() {
        this.setState(getStateFromStoresForAudits());
    },
    getInitialState: function() {
        return getStateFromStoresForAudits();
    },
    render: function() {
        var accessList = [];
        var server_error = this.state.server_error ? this.state.server_error : null;
        var currentHistoryDate = null;

        for (var i = 0; i < this.state.audits.length; i++) {
            var currentAudit = this.state.audits[i];
            var newHistoryDate = new Date(currentAudit.create_at);

            if (!currentHistoryDate || currentHistoryDate.toLocaleDateString() !== newHistoryDate.toLocaleDateString()) {
                currentHistoryDate = newHistoryDate;
            }
            
        }

        return (
            <div>
                <div className="modal fade" ref="modal" id="access_history" tabIndex="-1" role="dialog" aria-hidden="true">
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

        /*return (
            <div>
                <div className="modal fade" ref="modal" id="access_history" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h4 className="modal-title" id="myModalLabel">Access History</h4>
                        </div>
                        <div ref="modalBody" className="modal-body">
                            <form role="form">
                                <div className="table-responsive" style={{ maxWidth: "560px", maxHeight: "300px" }}>
                                    <table className="table-condensed small">
                                        <thead>
                                        <tr><th>Id</th><th>Platform</th><th>OS</th><th>Browser</th><th>Created</th><th>Last Activity</th><th>Revoke</th></tr>
                                        </thead>
                                        <tbody>
                                        {
                                            this.state.sessions.map(function(value, index) {
                                                return (
                                                    <tr key={ "" + index }>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ value.alt_id }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{value.props.platform}</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{value.props.os}</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{value.props.browser}</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.create_at).toLocaleString() }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.last_activity_at).toLocaleString() }</td>
                                                        <td><button onClick={this.submitRevoke.bind(this, value.alt_id)} className="pull-right btn btn-primary">Revoke</button></td>
                                                    </tr>
                                                );
                                            }, this)
                                        }
                                        </tbody>
                                    </table>
                                </div>
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
        );*/
    }
});
