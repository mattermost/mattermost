// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {getConfig} from 'utils/async_client.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class ReloadConfigButton extends React.Component {
    constructor(props) {
        super(props);

        this.handleReloadConfig = this.handleReloadConfig.bind(this);

        this.state = {
            loading: false,
            fail: null
        };
    }

    handleReloadConfig(e) {
        e.preventDefault();

        this.setState({
            loading: true,
            fail: null
        });

        Client.reloadConfig(
            () => {
                getConfig();
                this.setState({
                    loading: false
                });
            },
            (err) => {
                this.setState({
                    loading: false,
                    fail: err.message + ' - ' + err.detailed_error
                });
            }
        );
    }

    render() {
        if (global.window.mm_license.IsLicensed !== 'true') {
            return <div></div>;
        }

        let testMessage = null;
        if (this.state.fail) {
            testMessage = (
                <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.reload.reloadFail'
                        defaultMessage='Reload unsuccessful: {error}'
                        values={{
                            error: this.state.fail
                        }}
                    />
                </div>
            );
        }

        let helpText = (
            <FormattedHTMLMessage
                id='admin.reload.reloadDescription'
                defaultMessage='Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the <b>Reload Configuration from Disk</b> feature to load the new settings while the server is running. The administrator should then use the <a href="../advanced/database"><b>Database > Recycle Database Connections</b></a> feature to recycle the database connections based on the new settings.'
            />
        );

        let contents = null;
        if (this.state.loading) {
            contents = (
                <span>
                    <span className='fa fa-refresh icon--rotate'/>
                    {Utils.localizeMessage('admin.reload.loading', ' Loading...')}
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.reload.button'
                    defaultMessage='Reload Configuration From Disk'
                />
            );
        }

        return (
            <div className='form-group reload-config'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div>
                        <button
                            className='btn btn-default'
                            onClick={this.handleReloadConfig}
                        >
                            {contents}
                        </button>
                        {testMessage}
                    </div>
                    <div className='help-text'>
                        {helpText}
                    </div>
                </div>
            </div>
        );
    }
}
