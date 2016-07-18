// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class SyncNowButton extends React.Component {
    static get propTypes() {
        return {
            disabled: React.PropTypes.bool
        };
    }
    constructor(props) {
        super(props);

        this.handleSyncNow = this.handleSyncNow.bind(this);

        this.state = {
            buisy: false,
            fail: null
        };
    }

    handleSyncNow(e) {
        e.preventDefault();

        this.setState({
            buisy: true,
            fail: null
        });

        Client.ldapSyncNow(
            () => {
                this.setState({
                    buisy: false
                });
            },
            (err) => {
                this.setState({
                    buisy: false,
                    fail: err.message + ' - ' + err.detailed_error
                });
            }
        );
    }

    render() {
        let failMessage = null;
        if (this.state.fail) {
            failMessage = (
                <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.ldap.syncFailure'
                        defaultMessage='Sync Failure: {error}'
                        values={{
                            error: this.state.fail
                        }}
                    />
                </div>
            );
        }

        let helpText = (
            <FormattedHTMLMessage
                id='admin.ldap.syncNowHelpText'
                defaultMessage='Initiates an LDAP synchronization immediately.'
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
                    id='admin.ldap.sync_button'
                    defaultMessage='LDAP Synchronize Now'
                />
            );
        }

        return (
            <div className='form-group reload-config'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div>
                        <button
                            className='btn btn-default'
                            onClick={this.handleSyncNow}
                            disabled={this.props.disabled}
                        >
                            {contents}
                        </button>
                        {failMessage}
                    </div>
                    <div className='help-text'>
                        {helpText}
                    </div>
                </div>
            </div>
        );
    }
}
