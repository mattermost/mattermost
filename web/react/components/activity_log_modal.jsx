// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

function getStateFromStoresForSessions() {
    return {
        sessions: UserStore.getSessions(),
        server_error: null,
        client_error: null
    };
}

module.exports = React.createClass({
    submitRevoke: function(altId) {
        var self = this;
        Client.revokeSession(altId,
            function(data) {
                AsyncClient.getSessions();
            }.bind(this),
            function(err) {
                state = getStateFromStoresForSessions();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    componentDidMount: function() {
        UserStore.addSessionsChangeListener(this._onChange);
        AsyncClient.getSessions();
    },
    componentWillUnmount: function() {
        UserStore.removeSessionsChangeListener(this._onChange);
    },
    _onChange: function() {
        this.setState(getStateFromStoresForSessions());
    },
    getInitialState: function() {
        return getStateFromStoresForSessions();
    },
    render: function() {
        var activityList = [];
        var server_error = this.state.server_error ? this.state.server_error : null;

        for (var i = 0; i < this.state.sessions.length; i++) {
            var currentSession = this.state.sessions[i];
            
            activityList[i] = (
                <div>
                    <div className="single-device">
                        <div className="device-platform-name">{currentSession.props.platform}</div>
                        <div className="activity-info">
                            <div>{"Last activity: " + new Date(currentSession.last_activity_at).toString()}</div>
                            <div>{"First time active: " + new Date(currentSession.create_at).toString()}</div>
                            <div>{"OS: " + currentSession.props.os}</div>
                            <div>{"Browser: " + currentSession.props.browser}</div>
                            <div>{"Session ID: " + currentSession.alt_id}</div>
                        </div>
                        <div><button onClick={this.submitRevoke.bind(this, currentSession.alt_id)} className="pull-right btn btn-primary">Revoke</button></div>
                        <br/>
                        {i < this.state.sessions.length - 1 ?
                        <div className="divider-light"/>
                        :
                        null
                        }
                    </div>
                </div>
            );
        }

        return (
            <div>
                <div className="modal fade" ref="modal" id="activity_log" tabIndex="-1" role="dialog" aria-hidden="true">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                                <h4 className="modal-title" id="myModalLabel">Active Devices</h4>
                            </div>
                            <div ref="modalBody" className="modal-body">
                                <form role="form">
                                { activityList }
                                </form>
                                { server_error }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );

        /*return (
            <div>
                <div className="modal fade" ref="modal" id="activity_log" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h4 className="modal-title" id="myModalLabel">Active Devices</h4>
                        </div>
                        <div ref="modalBody" className="modal-body">
                            <form role="form">
                                <div className="table-responsive" style={{ maxWidth: "560px", maxHeight: "300px" }}>
                                    <table className="table-condensed small">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Action</th>
                                                <th>IP Address</th>
                                                <th>Session</th>
                                                <th>Other Info</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        {
                                            this.state.audits.map(function(value, index) {
                                                return (
                                                    <tr key={ "" + index }>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ new Date(value.create_at).toLocaleString() }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ value.action.replace("/api/v1", "") }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ value.ip_address }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ value.session_id }</td>
                                                        <td style={{ whiteSpace: "nowrap" }}>{ value.extra_info }</td>
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
