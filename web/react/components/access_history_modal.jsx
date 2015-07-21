// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Utils = require('../utils/utils.jsx');

function getStateFromStoresForAudits() {
    return {
        audits: UserStore.getAudits()
    };
}

module.exports = React.createClass({
    componentDidMount: function() {
        UserStore.addAuditsChangeListener(this._onChange);
        AsyncClient.getAudits();

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            self.setState({ moreInfo: [] });
        });
    },
    componentWillUnmount: function() {
        UserStore.removeAuditsChangeListener(this._onChange);
    },
    _onChange: function() {
        this.setState(getStateFromStoresForAudits());
    },
    handleMoreInfo: function(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({ moreInfo: newMoreInfo });
    },
    getInitialState: function() {
        var initialState = getStateFromStoresForAudits();
        initialState.moreInfo = [];
        return initialState;
    },
    render: function() {
        var accessList = [];
        var currentHistoryDate = null;

        for (var i = 0; i < this.state.audits.length; i++) {
            var currentAudit = this.state.audits[i];
            var newHistoryDate = new Date(currentAudit.create_at);
            var newDate = null;

            if (!currentHistoryDate || currentHistoryDate.toLocaleDateString() !== newHistoryDate.toLocaleDateString()) {
                currentHistoryDate = newHistoryDate;
                newDate = ( <div className="access-date">{currentHistoryDate.toDateString()}</div> );
            }
            
            accessList[i] = (
                <div>
                    {newDate}
                    <div className="single-access">
                        <div className="access-time">{newHistoryDate.toLocaleTimeString(navigator.language, {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="access-info">
                            <div>{"IP: " + currentAudit.ip_address}</div>
                            { this.state.moreInfo[i] ?
                            <div>
                                <div>{"Session ID: " + currentAudit.session_id}</div>
                                <div>{"URL: " + currentAudit.action.replace("/api/v1", "")}</div>
                            </div>
                            :
                            <a href="#" onClick={this.handleMoreInfo.bind(this, i)}>More info</a>
                            }
                        </div>
                        <br/>
                        {i < this.state.audits.length - 1 ?
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
                <div className="modal fade" ref="modal" id="access_history" tabIndex="-1" role="dialog" aria-hidden="true">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                                <h4 className="modal-title" id="myModalLabel">Access History</h4>
                            </div>
                            <div ref="modalBody" className="modal-body">
                                <form role="form">
                                { accessList }
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
