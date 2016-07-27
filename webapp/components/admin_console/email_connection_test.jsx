// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class EmailConnectionTestButton extends React.Component {
    static get propTypes() {
        return {
            config: React.PropTypes.object.isRequired,
            disabled: React.PropTypes.bool.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleTestConnection = this.handleTestConnection.bind(this);

        this.state = {
            testing: false,
            success: false,
            fail: null
        };
    }

    handleTestConnection(e) {
        e.preventDefault();

        this.setState({
            testing: true,
            success: false,
            fail: null
        });

        Client.testEmail(
            this.props.config,
            () => {
                this.setState({
                    testing: false,
                    success: true
                });
            },
            (err) => {
                let fail = err.message;
                if (err.detailed_error) {
                    fail += ' - ' + err.detailed_error;
                }

                this.setState({
                    testing: false,
                    fail
                });
            }
        );
    }

    render() {
        let testMessage = null;
        if (this.state.success) {
            testMessage = (
                <div className='alert alert-success'>
                    <i className='fa fa-check'></i>
                    <FormattedMessage
                        id='admin.email.emailSuccess'
                        defaultMessage='No errors were reported while sending an email.  Please check your inbox to make sure.'
                    />
                </div>
            );
        } else if (this.state.fail) {
            testMessage = (
                <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.email.emailFail'
                        defaultMessage='Connection unsuccessful: {error}'
                        values={{
                            error: this.state.fail
                        }}
                    />
                </div>
            );
        }

        let contents = null;
        if (this.state.testing) {
            contents = (
                <span>
                    <span className='fa fa-refresh icon--rotate'/>
                    {Utils.localizeMessage('admin.email.testing', 'Testing...')}
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.email.connectionSecurityTest'
                    defaultMessage='Test Connection'
                />
            );
        }

        return (
            <div className='form-group email-connection-test'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div className='help-text'>
                        <button
                            className='btn btn-default'
                            onClick={this.handleTestConnection}
                            disabled={this.props.disabled}
                        >
                            {contents}
                        </button>
                        {testMessage}
                    </div>
                </div>
            </div>
        );
    }
}