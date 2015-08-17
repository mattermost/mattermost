// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var utils = require('../utils/utils.jsx');

function getStateFromStoresForAudits() {
    return {
        audits: UserStore.getAudits()
    };
}

module.exports = React.createClass({
    displayName: 'AccessHistoryModal',
    componentDidMount: function() {
        UserStore.addAuditsChangeListener(this.onListenerChange);
        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function() {
            AsyncClient.getAudits();
        });

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function() {
            $('#user_settings').modal('show');
            self.setState({moreInfo: []});
        });
    },
    componentWillUnmount: function() {
        UserStore.removeAuditsChangeListener(this.onListenerChange);
    },
    onListenerChange: function() {
        var newState = getStateFromStoresForAudits();
        if (!utils.areStatesEqual(newState.audits, this.state.audits)) {
            this.setState(newState);
        }
    },
    handleMoreInfo: function(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
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
                newDate = (<div> {currentHistoryDate.toDateString()} </div>);
            }

            if (!currentAudit.session_id && currentAudit.action.search('/users/login') !== -1) {
                currentAudit.session_id = 'N/A (Login attempt)';
            }

            var moreInfo = (<a href='#' className='theme' onClick={this.handleMoreInfo.bind(this, i)}>More info</a>);
            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>{'Session ID: ' + currentAudit.session_id}</div>
                        <div>{'URL: ' + currentAudit.action.replace(/\/api\/v[1-9]/, '')}</div>
                    </div>
                );
            }

            var divider = null;
            if (i < this.state.audits.length - 1) {
                divider = (<div className='divider-light'></div>)
            }

            accessList[i] = (
                <div className='access-history__table'>
                    <div className='access__date'>{newDate}</div>
                    <div className='access__report'>
                        <div className='report__time'>{newHistoryDate.toLocaleTimeString(navigator.language, {hour: '2-digit', minute: '2-digit'})}</div>
                        <div className='report__info'>
                            <div>{'IP: ' + currentAudit.ip_address}</div>
                            {moreInfo}
                        </div>
                        {divider}
                    </div>
                </div>
            );
        }

        var content;
        if (this.state.audits.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (<form role='form'>{accessList}</form>);
        }

        return (
            <div>
                <div className='modal fade' ref='modal' id='access-history' tabIndex='-1' role='dialog' aria-hidden='true'>
                    <div className='modal-dialog modal-lg'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                                <h4 className='modal-title' id='myModalLabel'>Access History</h4>
                            </div>
                            <div ref='modalBody' className='modal-body'>
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
