// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var Utils = require('../utils/utils.jsx');

export default class AccessHistoryModal extends React.Component {
    constructor(props) {
        super(props);

        this.onAuditChange = this.onAuditChange.bind(this);
        this.handleMoreInfo = this.handleMoreInfo.bind(this);

        this.state = this.getStateFromStoresForAudits();
        this.state.moreInfo = [];
    }
    getStateFromStoresForAudits() {
        return {
            audits: UserStore.getAudits()
        };
    }
    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);
        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function show() {
            AsyncClient.getAudits();
        });

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function hide() {
            $('#user_settings').modal('show');
            self.setState({moreInfo: []});
        });
    }
    componentWillUnmount() {
        UserStore.removeAuditsChangeListener(this.onAuditChange);
    }
    onAuditChange() {
        var newState = this.getStateFromStoresForAudits();
        if (!Utils.areStatesEqual(newState.audits, this.state.audits)) {
            this.setState(newState);
        }
    }
    handleMoreInfo(index) {
        var newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }
    render() {
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

            var moreInfo = (
                <a
                    href='#'
                    className='theme'
                    onClick={this.handleMoreInfo.bind(this, i)}
                >
                    More info
                </a>
            );

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
                divider = (<div className='divider-light'></div>);
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
                <div
                    className='modal fade'
                    ref='modal'
                    id='access-history'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog modal-lg'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label='Close'
                                >
                                    <span aria-hidden='true'>&times;</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    Access History
                                </h4>
                            </div>
                            <div
                                ref='modalBody'
                                className='modal-body'
                            >
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
