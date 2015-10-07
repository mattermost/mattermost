// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
        this.onHide = this.onHide.bind(this);
        this.onShow = this.onShow.bind(this);

        const state = this.getStateFromStoresForAudits();
        state.moreInfo = [];

        this.state = state;
    }
    getStateFromStoresForAudits() {
        return {
            audits: UserStore.getAudits()
        };
    }
    onShow() {
        AsyncClient.getAudits();
    }
    onHide() {
        $('#user_settings').modal('show');
        this.setState({moreInfo: []});
    }
    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);
        $(React.findDOMNode(this.refs.modal)).on('shown.bs.modal', this.onShow);

        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.onHide);
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

        for (var i = 0; i < this.state.audits.length; i++) {
            var currentAudit = this.state.audits[i];
            var currentDate = new Date(currentAudit.create_at);

            if (!currentAudit.session_id && currentAudit.action.search('/users/login') !== -1) {
                currentAudit.session_id = 'N/A (Login attempt)';
            }

            const currentActionURL = currentAudit.action.replace(/\/api\/v[1-9]/, '');

            let currentAuditDesc = '';

            /* Handle specific audit type formatting semi-individually and
                fall back to a best guess case if none exists

                Supported audits:
                    /channels
                    - Create Channel X
                    - Update Channel X
                    - Update Channel Description X
                    - Delete Channel X
                    - Add User to Channel X
                    - Remove User from Channel X

                    /oauth
                    - Register X
                    - Allow Attempt/Success/Failure X

                    /team
                    - Revoke All Sessions X (NO CORRESPONDING ADDRESS)

                    - Update (users - ?) X
                    - Update Notify (?) X
                    - Login Attempt X
                    - Login (success/failure) X
                    - Logout (/logout) X
            */
            switch (currentActionURL) {
            case '/channels/create':
                break;
            case '/channels/update':
                break;
            case '/channels/update_desc':
                break;
            case /\/channels\/[A-Za-z0-9]+\/delete/:
                break;
            case /\/channels\/[A-Za-z0-9]+\/add/:
                break;
            case /\/channels\/[A-Za-z0-9]+\/remove/:
                break;
            case '/oauth/register':
                break;
            case '/oauth/allow':
                break;
            case '/team/':
                break;
            default:
                let currentActionDesc = '';

                if (currentActionURL && currentActionURL.lastIndexOf('/') !== -1) {
                    currentActionDesc = currentActionURL.substring(currentActionURL.lastIndexOf('/') + 1).replace('_', ' ');
                    currentActionDesc = Utils.toTitleCase(currentActionDesc);
                }

                let currentExtraInfoDesc = '';
                if (currentAudit.extra_info) {
                    currentExtraInfoDesc = currentAudit.extra_info;

                    if (currentExtraInfoDesc.indexOf('=') !== -1) {
                        currentExtraInfoDesc = currentExtraInfoDesc.substring(currentExtraInfoDesc.indexOf('=') + 1);
                    }
                }

                currentAuditDesc = currentActionDesc + ' ' + currentExtraInfoDesc;
                break;
            }

            var moreInfo = (
                <a
                    href='#'
                    className='theme'
                    onClick={this.handleMoreInfo.bind(this, i)}
                >
                    {'More info'}
                </a>
            );

            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>{'Session ID: ' + currentAudit.session_id}</div>
                    </div>
                );
            }

            var divider = null;
            if (i < this.state.audits.length - 1) {
                divider = (<div className='divider-light'></div>);
            }

            accessList[i] = (
                <div
                    key={'accessHistoryEntryKey' + i}
                    className='access-history__table'
                >
                    <div className='access__report'>
                        <div className='report__time'>{currentDate.toDateString() + ' - ' + currentDate.toLocaleTimeString(navigator.language, {hour: '2-digit', minute: '2-digit'}) + ' | ' + currentAuditDesc + ' from ' + currentAudit.ip_address}</div>
                        <div className='report__info'>
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
                                    <span aria-hidden='true'>{'×'}</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {'Access History'}
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
