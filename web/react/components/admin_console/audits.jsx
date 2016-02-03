// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from '../loading_screen.jsx';
import AuditTable from '../audit_table.jsx';

import AdminStore from '../../stores/admin_store.jsx';

import * as AsyncClient from '../../utils/async_client.jsx';

import {FormattedMessage} from 'mm-intl';

export default class Audits extends React.Component {
    constructor(props) {
        super(props);

        this.onAuditListenerChange = this.onAuditListenerChange.bind(this);
        this.reload = this.reload.bind(this);

        this.state = {
            audits: AdminStore.getAudits()
        };
    }

    componentDidMount() {
        AdminStore.addAuditChangeListener(this.onAuditListenerChange);
        AsyncClient.getServerAudits();
    }

    componentWillUnmount() {
        AdminStore.removeAuditChangeListener(this.onAuditListenerChange);
    }

    onAuditListenerChange() {
        this.setState({
            audits: AdminStore.getAudits()
        });
    }

    reload() {
        AdminStore.saveAudits(null);
        this.setState({
            audits: null
        });

        AsyncClient.getServerAudits();
    }

    render() {
        var content = null;

        if (global.window.mm_license.IsLicensed !== 'true') {
            return <div/>;
        }

        if (this.state.audits === null) {
            content = <LoadingScreen />;
        } else {
            content = (
                <div style={{margin: '10px'}}>
                <AuditTable
                    audits={this.state.audits}
                    oneLine={true}
                    showUserId={true}
                />
                </div>
            );
        }

        return (
            <div className='panel'>
                <h3>
                    <FormattedMessage
                        id='admin.audits.title'
                        defaultMessage='Server Audits'
                    />
                </h3>
                <button
                    type='submit'
                    className='btn btn-primary'
                    onClick={this.reload}
                >
                    <FormattedMessage
                        id='admin.audits.reload'
                        defaultMessage='Reload'
                    />
                </button>
                <div className='log__panel'>
                    {content}
                </div>
            </div>
        );
    }
}
